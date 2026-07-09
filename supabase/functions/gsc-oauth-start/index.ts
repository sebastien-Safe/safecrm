import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin":  "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")   return new Response("method not allowed", { status: 405, headers: CORS });

  const SB_URL  = Deno.env.get("SUPABASE_URL")!;
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SB_SRV  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");

  if (!CLIENT_ID) return json({ error: "Google OAuth non configuré (GOOGLE_OAUTH_CLIENT_ID manquant)" }, 503);

  // ── Auth admin ─────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Non authentifié" }, 401);

  const sbUser = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) return json({ error: "Non authentifié" }, 401);

  const sbSrv = createClient(SB_URL, SB_SRV);

  const { data: profile } = await sbSrv.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) return json({ error: "Accès réservé aux administrateurs" }, 403);

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: { domaine_id?: string } = {};
  try { body = await req.json(); } catch { /* body vide */ }
  const domaineId = body.domaine_id;
  if (!domaineId) return json({ error: "Paramètre 'domaine_id' manquant" }, 400);

  const { data: domaine } = await sbSrv.from("seo_domaines").select("id, contact_id").eq("id", domaineId).maybeSingle();
  if (!domaine) return json({ error: "Domaine introuvable" }, 404);

  // ── État anti-CSRF, usage unique ────────────────────────────────────────────
  const { data: stateRow, error: stateErr } = await sbSrv
    .from("safe_gsc_oauth_state")
    .insert({ domaine_id: domaineId, contact_id: domaine.contact_id, created_by: user.id })
    .select("state")
    .single();

  if (stateErr || !stateRow) return json({ error: "Impossible de créer l'état OAuth" }, 500);

  const redirectUri = `${SB_URL}/functions/v1/gsc-oauth-callback`;

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&scope=${encodeURIComponent(SCOPE)}` +
    `&state=${stateRow.state}`;

  return json({ url: authUrl });
});
