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

// ── Qualification des métriques Core Web Vitals ────────────────────────────

function rateMetric(value: number, thresholds: [number, number]): "good" | "needs-improvement" | "poor" {
  if (value <= thresholds[0]) return "good";
  if (value <= thresholds[1]) return "needs-improvement";
  return "poor";
}

// Seuils officiels Google : [good, needs-improvement]
const THRESHOLDS = {
  lcp: [2500, 4000],   // ms
  cls: [0.1,  0.25],   // sans unité
  tbt: [200,  600],    // ms (proxy FID/INP)
  fcp: [1800, 3000],   // ms
  si:  [3400, 5800],   // ms
};

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")   return new Response("method not allowed", { status: 405, headers: CORS });

  const SB_URL  = Deno.env.get("SUPABASE_URL")!;
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SB_SRV  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PS_KEY  = Deno.env.get("PAGESPEED_API_KEY");

  // ── Auth utilisateur ───────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Non authentifié" }, 401);

  const sbUser = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) return json({ error: "Non authentifié" }, 401);

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: { url?: string; strategy?: string } = {};
  try { body = await req.json(); } catch { /* body vide */ }

  const url      = (body.url ?? "").trim();
  const strategy = body.strategy === "desktop" ? "desktop" : "mobile";

  if (!url) return json({ error: "Paramètre 'url' manquant" }, 400);
  if (!/^https?:\/\//i.test(url)) return json({ error: "URL invalide — doit commencer par http:// ou https://" }, 400);

  // ── Vérification du connecteur ─────────────────────────────────────────────
  const sbSrv = createClient(SB_URL, SB_SRV);
  const { data: conn } = await sbSrv
    .from("safe_connectors")
    .select("statut")
    .eq("service_key", "pagespeed")
    .maybeSingle();

  if (!conn) return json({ error: "Connecteur PageSpeed non trouvé en base" }, 404);

  const isSimule = conn.statut === "simule";
  const isActif  = conn.statut === "actif";

  if (!isActif && !isSimule) {
    return json({ error: "Connecteur PageSpeed non actif — activez-le dans Paramètres → Connecteurs" }, 403);
  }

  // ── Mode simulation ────────────────────────────────────────────────────────
  if (isSimule) {
    const simulatedResult = {
      simulated: true,
      strategy,
      url,
      performance: 74,
      metrics: {
        fcp:  { value: 2100, rating: "good",              label: "First Contentful Paint", display: "2,1 s" },
        lcp:  { value: 3200, rating: "needs-improvement", label: "Largest Contentful Paint", display: "3,2 s" },
        tbt:  { value: 280,  rating: "needs-improvement", label: "Total Blocking Time",       display: "280 ms" },
        cls:  { value: 0.08, rating: "good",              label: "Cumulative Layout Shift",   display: "0,08" },
        si:   { value: 4100, rating: "needs-improvement", label: "Speed Index",               display: "4,1 s" },
      },
      vitesse_ok:  false,
      cwv_ok:      false,
      verdict: {
        vitesse: "partiel",
        cwv:     "partiel",
      },
    };

    await sbSrv.from("safe_connectors_log").insert({
      connector_key: "pagespeed",
      action:        "api_call",
      done_by:       user.id,
      notes:         `[SIMULATION] analyse ${strategy} — ${url}`,
    });

    return json(simulatedResult);
  }

  // ── Appel API Google PageSpeed Insights ────────────────────────────────────
  if (!PS_KEY) {
    return json({
      error: "Secret PAGESPEED_API_KEY manquant — à configurer dans Supabase Dashboard → Edge Functions → Secrets",
    }, 500);
  }

  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
    `?url=${encodeURIComponent(url)}` +
    `&strategy=${strategy}` +
    `&key=${PS_KEY}` +
    `&category=performance`;

  let psData: Record<string, unknown>;
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const err = await res.text();
      return json({ error: `Google PageSpeed API : ${res.status} — ${err}` }, 502);
    }
    psData = await res.json();
  } catch (e) {
    return json({ error: `Impossible de joindre l'API Google : ${e}` }, 502);
  }

  // ── Extraction des métriques ───────────────────────────────────────────────
  const lhr      = (psData.lighthouseResult as Record<string, unknown>) ?? {};
  const audits   = (lhr.audits as Record<string, Record<string, unknown>>) ?? {};
  const cats     = (lhr.categories as Record<string, Record<string, unknown>>) ?? {};

  const perfScore = Math.round(((cats.performance?.score as number) ?? 0) * 100);

  function getAudit(key: string) {
    const a = audits[key] ?? {};
    return {
      value:   (a.numericValue  as number) ?? 0,
      display: (a.displayValue  as string) ?? "—",
      score:   (a.score         as number) ?? 0,
    };
  }

  const fcpAudit = getAudit("first-contentful-paint");
  const lcpAudit = getAudit("largest-contentful-paint");
  const tbtAudit = getAudit("total-blocking-time");
  const clsAudit = getAudit("cumulative-layout-shift");
  const siAudit  = getAudit("speed-index");

  const metrics = {
    fcp: { value: fcpAudit.value, rating: rateMetric(fcpAudit.value, THRESHOLDS.fcp as [number,number]), label: "First Contentful Paint", display: fcpAudit.display },
    lcp: { value: lcpAudit.value, rating: rateMetric(lcpAudit.value, THRESHOLDS.lcp as [number,number]), label: "Largest Contentful Paint", display: lcpAudit.display },
    tbt: { value: tbtAudit.value, rating: rateMetric(tbtAudit.value, THRESHOLDS.tbt as [number,number]), label: "Total Blocking Time",       display: tbtAudit.display },
    cls: { value: clsAudit.value, rating: rateMetric(clsAudit.value, THRESHOLDS.cls as [number,number]), label: "Cumulative Layout Shift",   display: clsAudit.display },
    si:  { value: siAudit.value,  rating: rateMetric(siAudit.value,  THRESHOLDS.si  as [number,number]), label: "Speed Index",               display: siAudit.display },
  };

  // Vitesse : FCP < 3 000 ms (mobile) = conforme, 3 000-4 500 = partiel, > 4 500 = non_conforme
  const vitesse_ok  = fcpAudit.value <= 3000;
  const vitesse_partiel = fcpAudit.value <= 4500;

  // CWV : LCP + CLS + TBT tous "good" = conforme, au moins un "needs-improvement" = partiel, au moins un "poor" = non_conforme
  const cwvRatings = [metrics.lcp.rating, metrics.cls.rating, metrics.tbt.rating];
  const cwv_all_good   = cwvRatings.every(r => r === "good");
  const cwv_none_poor  = cwvRatings.every(r => r !== "poor");

  const result = {
    simulated:   false,
    strategy,
    url,
    performance: perfScore,
    metrics,
    vitesse_ok,
    cwv_ok: cwv_all_good,
    verdict: {
      vitesse: vitesse_ok ? "conforme" : vitesse_partiel ? "partiel" : "non_conforme",
      cwv:     cwv_all_good ? "conforme" : cwv_none_poor ? "partiel" : "non_conforme",
    },
  };

  // ── Log (fire-and-forget) ──────────────────────────────────────────────────
  sbSrv.from("safe_connectors_log").insert({
    connector_key: "pagespeed",
    action:        "api_call",
    done_by:       user.id,
    notes:         `analyse ${strategy} — score ${perfScore}% — ${url}`,
  }).then(() => {}, () => {});

  return json(result);
});
