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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")   return new Response("method not allowed", { status: 405, headers: CORS });

  const SB_URL  = Deno.env.get("SUPABASE_URL")!;
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SB_SRV  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── Auth utilisateur ───────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Non authentifié" }, 401);

  const sbUser = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) return json({ error: "Non authentifié" }, 401);

  // ── Vérification admin ─────────────────────────────────────────────────────
  const sbSrv = createClient(SB_URL, SB_SRV);
  const { data: profile } = await sbSrv
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) return json({ error: "Accès réservé aux administrateurs" }, 403);

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: { service_key?: string; api_key?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Corps JSON invalide" }, 400); }

  const { service_key, api_key } = body;
  if (!service_key) return json({ error: "Paramètre 'service_key' manquant" }, 400);
  if (!api_key)     return json({ error: "Paramètre 'api_key' manquant" }, 400);

  // ── Vérifier que le connecteur existe ─────────────────────────────────────
  const { data: conn } = await sbSrv
    .from("safe_connectors")
    .select("service_key")
    .eq("service_key", service_key)
    .maybeSingle();

  if (!conn) return json({ error: `Connecteur '${service_key}' introuvable` }, 404);

  // ── Upsert dans safe_connector_secrets (service_role bypass RLS) ───────────
  const { error } = await sbSrv
    .from("safe_connector_secrets")
    .upsert({
      service_key,
      api_key,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "service_key" });

  if (error) return json({ error: error.message }, 500);

  // Log (fire-and-forget)
  sbSrv.from("safe_connectors_log").insert({
    connector_key: service_key,
    action: "key_updated",
    done_by: user.id,
    notes: "Clé enregistrée via connector-secret-store",
  }).then(() => {}, () => {});

  return json({ ok: true });
});
