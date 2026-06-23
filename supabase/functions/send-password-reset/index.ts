import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TEMPLATE_RESET        = 10; // Demande de réinitialisation
const TEMPLATE_CONFIRMATION = 11; // Confirmation changement réussi — ⚠️ à mettre à jour après création dans Brevo

const CORS = {
  'Access-Control-Allow-Origin':  'https://crm.safe-digitalisation.fr',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'bad_method' }, 405);

  const BREVO        = Deno.env.get('BREVO');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!BREVO)        return json({ error: 'BREVO non configuré' }, 500);
  if (!SERVICE_ROLE) return json({ error: 'Service role manquant' }, 500);

  let body: Record<string, string>;
  try   { body = await req.json(); }
  catch { return json({ error: 'JSON invalide' }, 400); }

  const action = body.action || 'reset';
  const email  = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return json({ error: 'email_invalide' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── ACTION : confirmation de changement réussi ────────────────────────────
  if (action === 'confirmation') {
    const { data: { users } } = await admin.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);
    const prenom = user
      ? (await admin.from('profiles').select('prenom').eq('id', user.id).single()).data?.prenom || ''
      : '';

    const now = new Date().toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
    });

    await sendBrevo(BREVO, {
      templateId: TEMPLATE_CONFIRMATION,
      to: { email, name: prenom || email },
      params: { PRENOM: prenom || 'Utilisateur', DATE_HEURE: now },
    });

    return json({ ok: true });
  }

  // ── ACTION : demande de réinitialisation (défaut) ─────────────────────────
  const redirectTo = body.redirectTo || SUPABASE_URL;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:    'recovery',
    email,
    options: { redirectTo },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    console.warn('generateLink: email inconnu ou erreur —', linkErr?.message);
    return json({ ok: true });
  }

  const resetUrl = linkData.properties.action_link;
  const { data: profile } = await admin
    .from('profiles').select('prenom').eq('id', linkData.user.id).single();
  const prenom = profile?.prenom || '';

  await sendBrevo(BREVO, {
    templateId: TEMPLATE_RESET,
    to: { email, name: prenom || email },
    params: { PRENOM: prenom || 'Utilisateur', RESET_URL: resetUrl, EXPIRATION_HEURES: '24' },
  });

  return json({ ok: true });
});

async function sendBrevo(
  apiKey: string,
  opts: { templateId: number; to: { email: string; name: string }; params: Record<string, string> },
) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender:     { name: 'S@FE CRM', email: 'noreply@safe-digitalisation.fr' },
      to:         [opts.to],
      templateId: opts.templateId,
      params:     opts.params,
    }),
  });
  if (!res.ok) console.error('Brevo error:', res.status, await res.text());
  return res.ok;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
