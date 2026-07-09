import { createClient } from "@supabase/supabase-js";

const APP_URL = "https://crm.safe-digitalisation.fr/modules/SEO/module-seo-clients.html";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const redirect = (params: Record<string, string>) =>
  new Response(null, {
    status: 302,
    headers: { Location: `${APP_URL}?${new URLSearchParams(params).toString()}` },
  });

Deno.serve(async (req) => {
  const SB_URL  = Deno.env.get("SUPABASE_URL")!;
  const SB_SRV  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CLIENT_ID     = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const gErr  = url.searchParams.get("error");

  if (gErr)          return redirect({ gsc_error: gErr });
  if (!code || !state) return redirect({ gsc_error: "missing_code_or_state" });
  if (!CLIENT_ID || !CLIENT_SECRET) return redirect({ gsc_error: "oauth_non_configure" });

  const sbSrv = createClient(SB_URL, SB_SRV);

  // ── Vérification de l'état (anti-CSRF, usage unique) ────────────────────────
  const { data: stateRow } = await sbSrv
    .from("safe_gsc_oauth_state")
    .select("domaine_id, contact_id, created_by, created_at")
    .eq("state", state)
    .maybeSingle();

  if (!stateRow) return redirect({ gsc_error: "state_invalide" });

  await sbSrv.from("safe_gsc_oauth_state").delete().eq("state", state);

  const age = Date.now() - new Date(stateRow.created_at).getTime();
  if (age > STATE_TTL_MS) return redirect({ gsc_error: "state_expire" });

  // ── Échange du code contre les tokens ───────────────────────────────────────
  const redirectUri = `${SB_URL}/functions/v1/gsc-oauth-callback`;

  let tokenData: { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });
    tokenData = await res.json();
    if (!res.ok) return redirect({ gsc_error: tokenData.error ?? "token_exchange_failed" });
  } catch (_e) {
    return redirect({ gsc_error: "google_unreachable" });
  }

  if (!tokenData.access_token) return redirect({ gsc_error: "token_manquant" });

  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();

  // ── Persistance (le refresh_token n'est renvoyé qu'au premier consentement) ──
  const { data: existing } = await sbSrv
    .from("safe_gsc_tokens")
    .select("refresh_token")
    .eq("domaine_id", stateRow.domaine_id)
    .maybeSingle();

  const refreshToken = tokenData.refresh_token ?? existing?.refresh_token;
  if (!refreshToken) return redirect({ gsc_error: "refresh_token_absent_reconnecter" });

  await sbSrv.from("safe_gsc_tokens").upsert({
    domaine_id:    stateRow.domaine_id,
    refresh_token: refreshToken,
    access_token:  tokenData.access_token,
    expires_at:    expiresAt,
    connected_by:  stateRow.created_by,
    updated_at:    new Date().toISOString(),
  }, { onConflict: "domaine_id" });

  await sbSrv.from("seo_domaines").update({ gsc_connected: true }).eq("id", stateRow.domaine_id);

  await sbSrv.from("safe_connectors").update({
    statut: "actif", activated_by: stateRow.created_by, activated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("service_key", "google_gsc");

  await sbSrv.from("safe_connectors_log").insert({
    connector_key: "google_gsc",
    action:        "activated",
    done_by:       stateRow.created_by,
    notes:         `Connecté via OAuth pour domaine ${stateRow.domaine_id}`,
  });

  return redirect({ gsc: "connected", contact_id: stateRow.contact_id ?? "", domaine_id: stateRow.domaine_id });
});
