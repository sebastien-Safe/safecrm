import { createClient } from "@supabase/supabase-js";

// ── Limites ────────────────────────────────────────────────────────────────
const USER_MONTHLY_LIMIT   = 20;
const GLOBAL_MONTHLY_LIMIT = 5000;

// ── CORS (identique aux autres fonctions) ──────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── Helpers ────────────────────────────────────────────────────────────────
function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// ── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET")     return new Response("method not allowed", { status: 405, headers: CORS });

  const SB_URL  = Deno.env.get("SUPABASE_URL")!;
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SB_SRV  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GKEY    = Deno.env.get("GOOGLE_PLACES_API_KEY");

  if (!GKEY) return json({ error: "Google Places API non configurée" }, 503);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Non authentifié" }, 401);

  const sbUser = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) return json({ error: "Non authentifié" }, 401);

  // ── Paramètre de recherche ─────────────────────────────────────────────────
  const url = new URL(req.url);
  const q   = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return json({ error: "Requête trop courte (min 2 caractères)" }, 400);

  // ── Rate limiting (service role pour contourner RLS en lecture) ────────────
  const sbSrv = createClient(SB_URL, SB_SRV);
  const start = monthStart();

  const [{ count: userCount }, { count: globalCount }] = await Promise.all([
    sbSrv
      .from("places_search_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", start),
    sbSrv
      .from("places_search_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", start),
  ]);

  const uUsed = userCount   ?? 0;
  const gUsed = globalCount ?? 0;

  if (uUsed >= USER_MONTHLY_LIMIT) {
    return json({
      error:   "quota_user",
      message: `Quota mensuel atteint : ${USER_MONTHLY_LIMIT} recherches/mois par utilisateur.`,
      quota:   { user: { used: uUsed, limit: USER_MONTHLY_LIMIT }, global: { used: gUsed, limit: GLOBAL_MONTHLY_LIMIT } },
    }, 429);
  }

  if (gUsed >= GLOBAL_MONTHLY_LIMIT) {
    return json({
      error:   "quota_global",
      message: `Quota global mensuel atteint (${GLOBAL_MONTHLY_LIMIT} recherches/mois).`,
      quota:   { user: { used: uUsed, limit: USER_MONTHLY_LIMIT }, global: { used: gUsed, limit: GLOBAL_MONTHLY_LIMIT } },
    }, 429);
  }

  // ── Appel Google Places Text Search ───────────────────────────────────────
  // RGPD : appel serveur → la clé n'est jamais exposée au client
  const googleUrl =
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${encodeURIComponent(q)}` +
    `&key=${GKEY}` +
    `&language=fr` +
    `&region=fr` +
    `&type=establishment`;

  let googleData: { status: string; results?: Record<string, unknown>[] };
  try {
    const res = await fetch(googleUrl);
    googleData = await res.json();
  } catch (e) {
    return json({ error: "Erreur de connexion à Google Places" }, 502);
  }

  if (googleData.status !== "OK" && googleData.status !== "ZERO_RESULTS") {
    return json({ error: `Google Places : ${googleData.status}` }, 502);
  }

  // ── Filtrage RGPD : champs minimaux, pas de stockage des résultats ─────────
  type PlaceResult = {
    place_id?: string;
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
    business_status?: string;
    rating?: number;
    user_ratings_total?: number;
  };

  const results = ((googleData.results ?? []) as PlaceResult[])
    .slice(0, 10)
    .map((p) => ({
      place_id: p.place_id,
      name:     p.name,
      address:  p.formatted_address,
      lat:      p.geometry?.location?.lat,
      lng:      p.geometry?.location?.lng,
      types:    (p.types ?? []).slice(0, 3),
      status:   p.business_status,
      rating:   p.rating,
      ratings_total: p.user_ratings_total,
    }));

  // ── Log RGPD : requête + nombre de résultats UNIQUEMENT (jamais les données) ─
  await sbSrv.from("places_search_logs").insert({
    user_id:       user.id,
    query:         q,
    results_count: results.length,
  });

  return json({
    results,
    quota: {
      user:   { used: uUsed + 1, limit: USER_MONTHLY_LIMIT },
      global: { used: gUsed + 1, limit: GLOBAL_MONTHLY_LIMIT },
    },
  });
});
