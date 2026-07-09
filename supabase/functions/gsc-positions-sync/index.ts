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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")   return new Response("method not allowed", { status: 405, headers: CORS });

  const SB_URL  = Deno.env.get("SUPABASE_URL")!;
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SB_SRV  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CLIENT_ID     = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Non authentifié" }, 401);

  const sbUser = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) return json({ error: "Non authentifié" }, 401);

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: { domaine_id?: string } = {};
  try { body = await req.json(); } catch { /* body vide */ }
  const domaineId = body.domaine_id;
  if (!domaineId) return json({ error: "Paramètre 'domaine_id' manquant" }, 400);

  const sbSrv = createClient(SB_URL, SB_SRV);

  const { data: domaine } = await sbSrv.from("seo_domaines").select("id, domaine").eq("id", domaineId).maybeSingle();
  if (!domaine) return json({ error: "Domaine introuvable" }, 404);

  const { data: tokenRow } = await sbSrv
    .from("safe_gsc_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("domaine_id", domaineId)
    .maybeSingle();

  if (!tokenRow) return json({ error: "Search Console non connecté pour ce domaine" }, 404);

  if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "Google OAuth non configuré" }, 503);

  // ── Rafraîchissement du token si nécessaire ─────────────────────────────────
  let accessToken = tokenRow.access_token;
  const expired = !tokenRow.expires_at || new Date(tokenRow.expires_at).getTime() - Date.now() < 60_000;

  if (expired) {
    let refreshData: { access_token?: string; expires_in?: number; error?: string };
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: tokenRow.refresh_token,
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type:    "refresh_token",
        }),
      });
      refreshData = await res.json();
      if (!res.ok || !refreshData.access_token) {
        return json({ error: `Impossible de rafraîchir le token Google : ${refreshData.error ?? res.status}` }, 502);
      }
    } catch (_e) {
      return json({ error: "Impossible de joindre Google (refresh token)" }, 502);
    }

    accessToken = refreshData.access_token;
    const expiresAt = new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString();
    await sbSrv.from("safe_gsc_tokens")
      .update({ access_token: accessToken, expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq("domaine_id", domaineId);
  }

  // ── Requête Search Analytics (28 derniers jours) ────────────────────────────
  const end   = new Date(); end.setDate(end.getDate() - 2);   // GSC : données à J-2/J-3 min
  const start = new Date(end); start.setDate(start.getDate() - 28);

  const siteUrl = domaine.domaine.endsWith("/") ? domaine.domaine : `${domaine.domaine}/`;

  let gscData: { rows?: { keys: string[]; position: number }[]; error?: { message?: string } };
  try {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate:  isoDate(start),
          endDate:    isoDate(end),
          dimensions: ["query"],
          rowLimit:   5000,
        }),
      }
    );
    gscData = await res.json();
    if (!res.ok) return json({ error: `Search Console : ${gscData.error?.message ?? res.status}` }, 502);
  } catch (_e) {
    return json({ error: "Impossible de joindre l'API Search Console" }, 502);
  }

  const positions = new Map<string, number>();
  for (const row of gscData.rows ?? []) {
    const q = (row.keys?.[0] ?? "").toLowerCase().trim();
    if (q) positions.set(q, row.position);
  }

  // ── Mise à jour des mots-clés déjà suivis pour ce domaine ───────────────────
  const { data: mcs } = await sbSrv
    .from("seo_client_mots_cles")
    .select("id, mot_cle, position_actuelle")
    .eq("domaine_id", domaineId);

  let updated = 0;
  const today = isoDate(new Date());

  for (const mc of mcs ?? []) {
    const pos = positions.get(mc.mot_cle.toLowerCase().trim());
    if (pos === undefined) continue;
    const rounded = Math.round(pos);
    if (rounded === mc.position_actuelle) continue;

    await sbSrv.from("seo_client_mots_cles").update({
      position_precedente: mc.position_actuelle,
      position_actuelle:   rounded,
      date_maj:            today,
      updated_at:          new Date().toISOString(),
    }).eq("id", mc.id);
    updated++;
  }

  sbSrv.from("safe_connectors_log").insert({
    connector_key: "google_gsc",
    action:        "api_call",
    done_by:       user.id,
    notes:         `sync positions — ${updated} mots-clés mis à jour — ${domaine.domaine}`,
  }).then(() => {}, () => {});

  return json({ updated, total_queries_gsc: gscData.rows?.length ?? 0 });
});
