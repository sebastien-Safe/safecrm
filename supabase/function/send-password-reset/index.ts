import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ⚠️ Mettre à jour avec l'ID du template créé dans Brevo
const BREVO_TEMPLATE_ID = 10;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'bad_method' }, 405);

  const BREVO       = Deno.env.get('BREBO');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!BREVO)       return json({ error: 'BREVO non configuré' }, 500);
  if (!SERVICE_ROLE) return json({ error: 'Service role manquant' }, 500);

  let body: Record<string, string>;
  try   { body = await req.json(); }
  catch { return json({ error: 'JSON invalide' }, 400); }

  const email      = (body.email || '').trim().toLowerCase();
  const redirectTo = body.redirectTo || SUPABASE_URL;

  if (!email || !email.includes('@')) return json({ error: 'email_invalide' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Générer le lien de réinitialisation via l'API Admin Supabase
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:    'recovery',
    email,
    options: { redirectTo },
  });

  // Sécurité : on répond toujours OK pour ne pas révéler si l'email existe
  if (linkErr || !linkData?.properties?.action_link) {
    console.warn('generateLink: email inconnu ou erreur —', linkErr?.message);
    return json({ ok: true });
  }

  const resetUrl = linkData.properties.action_link;

  // Récupérer le prénom depuis le profil (confort de l'email)
  const { data: profile } = await admin
    .from('profiles')
    .select('prenom')
    .eq('id', linkData.user.id)
    .single();
  const prenom = profile?.prenom || '';

  // Envoyer via Brevo
  const brevoPayload = {
    sender:     { name: 'S@FE CRM', email: 'noreply@safe-digitalisation.fr' },
    to:         [{ email, name: prenom || email }],
    templateId: BREVO_TEMPLATE_ID,
    params: {
      PRENOM:             prenom || 'Utilisateur',
      RESET_URL:          resetUrl,
      EXPIRATION_HEURES:  '24',
    },
  };

  const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'api-key': BREVO, 'Content-Type': 'application/json' },
    body:    JSON.stringify(brevoPayload),
  });

  if (!brevoRes.ok) {
    const errTxt = await brevoRes.text();
    console.error('Brevo error:', brevoRes.status, errTxt);
    return json({ error: 'email_non_envoye' }, 500);
  }

  return json({ ok: true });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
