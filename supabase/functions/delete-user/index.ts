import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  try {
    // Vérifier l'authentification de l'appelant
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return err(401, 'Non authentifié');

    const caller = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser } } = await caller.auth.getUser();
    if (!callerUser) return err(401, 'Session invalide');

    const { data: callerProfile } = await caller.from('profiles').select('is_admin, role').eq('id', callerUser.id).single();
    if (!callerProfile?.is_admin) return err(403, 'Réservé aux administrateurs');

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { target_user_id } = await req.json();
    if (!target_user_id) return err(400, 'target_user_id manquant');
    if (target_user_id === callerUser.id) return err(400, 'Impossible de supprimer votre propre compte');

    // 1. Récupérer le profil complet de l'utilisateur à supprimer
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', target_user_id)
      .single();

    const { data: { user: authUser } } = await admin.auth.admin.getUserById(target_user_id);
    if (!authUser) return err(404, 'Utilisateur introuvable');

    // 2. Récupérer les logs RGPD de cet utilisateur
    const { data: auditLogs } = await admin
      .from('audit_logs')
      .select('*')
      .eq('user_id', target_user_id)
      .order('created_at', { ascending: false });

    // 3. Construire l'archive JSON
    const archive = {
      meta: {
        archive_version: '1.0',
        archived_at: new Date().toISOString(),
        archived_by: callerUser.id,
        raison_conservation: 'Conservation légale 5 ans (Art. L123-22 C.com)',
        delete_after: new Date(Date.now() + 5 * 365.25 * 24 * 3600 * 1000).toISOString(),
      },
      identite: {
        id: target_user_id,
        email: authUser.email,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
      },
      profil: profile || {},
      journal_rgpd: auditLogs || [],
    };

    // 4. Nom du fichier : prenom-nom-mandat.json
    const prenom  = (profile?.prenom || 'inconnu').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const nom     = (profile?.nom    || 'inconnu').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const mandat  = (profile?.numero_mandat || target_user_id.slice(0, 8)).replace(/[^a-z0-9]/gi, '-');
    const filename = `${prenom}-${nom}-${mandat}.json`;
    const storagePath = `utilisateurs/${filename}`;

    const jsonBytes = new TextEncoder().encode(JSON.stringify(archive, null, 2));
    const { error: uploadError } = await admin.storage
      .from('archives')
      .upload(storagePath, jsonBytes, {
        contentType: 'application/json',
        upsert: true,
      });
    if (uploadError) return err(500, 'Erreur upload archive : ' + uploadError.message);

    // 5. Insérer les métadonnées en base
    await admin.from('archived_users').insert({
      original_user_id: target_user_id,
      email:            authUser.email,
      prenom:           profile?.prenom,
      nom:              profile?.nom,
      numero_mandat:    profile?.numero_mandat,
      role:             profile?.role,
      manager_id:       profile?.dci_parent_id,
      storage_path:     storagePath,
      archived_by:      callerUser.id,
    });

    // 6. Trouver le repreneur : dci_parent_id ou premier admin
    let repreneurId: string | null = profile?.dci_parent_id || null;
    if (!repreneurId) {
      const { data: admins } = await admin
        .from('profiles')
        .select('id')
        .eq('is_admin', true)
        .neq('id', target_user_id)
        .limit(1);
      repreneurId = admins?.[0]?.id || callerUser.id;
    }

    // 7. Réassigner contacts et contrats
    await admin.from('contacts').update({ created_by: repreneurId }).eq('created_by', target_user_id);
    await admin.from('contracts').update({ created_by: repreneurId }).eq('created_by', target_user_id);

    // 8. Supprimer le compte Auth (cascade → profil)
    const { error: deleteError } = await admin.auth.admin.deleteUser(target_user_id);
    if (deleteError) return err(500, 'Erreur suppression Auth : ' + deleteError.message);

    return new Response(JSON.stringify({
      ok: true,
      storage_path: storagePath,
      repreneur_id: repreneurId,
      contacts_reassignes: true,
    }), { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });

  } catch (e) {
    return err(500, String(e));
  }
});

function err(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://crm.safe-digitalisation.fr',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
