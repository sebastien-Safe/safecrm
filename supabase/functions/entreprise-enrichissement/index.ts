import { createClient } from "@supabase/supabase-js";

// ── CORS (identique aux autres fonctions) ──────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_TARGETS         = 5; // aligné sur la limite "5 étapes par tournée" du module
const CACHE_MAX_AGE_DAYS  = 90;
const EMAIL_COURTIER      = "contact@safe-assurances.fr";

type Target = {
  source: "sirene" | "google_places";
  label: string;
  adresse?: string;
  siret?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type CseItem = { title: string; link: string; snippet: string };

// Codes INSEE "tranche_effectif_salarie" → libellé lisible (identique au front)
const TRANCHE_EFFECTIF: Record<string, string> = {
  "00": "0 salarié", "01": "1 à 2 salariés", "02": "3 à 5 salariés", "03": "6 à 9 salariés",
  "11": "10 à 19 salariés", "12": "20 à 49 salariés", "21": "50 à 99 salariés", "22": "100 à 199 salariés",
  "31": "200 à 249 salariés", "32": "250 à 499 salariés", "41": "500 à 999 salariés",
  "42": "1 000 à 1 999 salariés", "51": "2 000 à 4 999 salariés", "52": "5 000 à 9 999 salariés",
  "53": "10 000 salariés et plus",
};

function hvKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Résolution du SIREN ──────────────────────────────────────────────────────
// Cible SIRENE : SIREN connu directement (siret tronqué). Cible Google Places :
// recherche par dénomination + rapprochement par distance GPS (rayon 2 km).
async function resolveSiren(target: Target): Promise<string | null> {
  if (target.source === "sirene" && target.siret) return target.siret.slice(0, 9);

  try {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(target.label)}&per_page=5`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const results = d.results || [];
    if (!results.length) return null;
    if (target.lat == null || target.lng == null) return results[0].siren || null;

    let best: { siren: string } | null = null;
    let bestDist = Infinity;
    for (const res of results) {
      const rl = res.siege?.latitude, rlng = res.siege?.longitude;
      if (rl == null || rlng == null) continue;
      const dist = hvKm(target.lat, target.lng, parseFloat(rl), parseFloat(rlng));
      if (dist < bestDist) { bestDist = dist; best = res; }
    }
    return (best && bestDist <= 2) ? best.siren : null;
  } catch {
    return null;
  }
}

async function fetchSireneBySiren(siren: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siren)}&per_page=1`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    return d.results?.[0] || null;
  } catch {
    return null;
  }
}

function caFromFinances(finances: unknown): { montant: string; annee: string } | null {
  if (!finances || typeof finances !== "object") return null;
  const f = finances as Record<string, { ca?: number }>;
  const annees = Object.keys(f).filter(a => f[a]?.ca != null).sort().reverse();
  if (!annees.length) return null;
  const annee = annees[0];
  const ca = f[annee].ca as number;
  const fmt = ca >= 1_000_000 ? (ca / 1_000_000).toFixed(1).replace(".0", "") + " M€"
            : ca >= 1_000     ? Math.round(ca / 1_000) + " k€"
            : ca + " €";
  return { montant: `${fmt} (${annee})`, annee };
}

async function googleCseSearch(apiKey: string, cx: string, q: string): Promise<CseItem[]> {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&num=5&gl=fr&hl=fr&q=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items || []).map((it: { title: string; link: string; snippet: string }) => ({
      title: it.title, link: it.link, snippet: it.snippet,
    }));
  } catch {
    return [];
  }
}

async function askClaude(
  apiKey: string,
  denomination: string,
  commune: string,
  sireneCA: { montant: string; annee: string } | null,
  trancheLabel: string,
  caSnippets: CseItem[],
  domainSnippets: CseItem[],
): Promise<{ chiffre_affaires: string | null; effectif_reel: string | null; nom_domaine: string | null; confiance: string }> {
  const system = `Tu es un assistant d'enrichissement de données B2B pour des conseillers en assurance qui prospectent des professionnels.
On te donne des informations officielles (SIRENE) et des extraits de recherche web limités à des annuaires d'entreprises (societe.com, pappers.fr, infogreffe.fr, verif.com, manageo.fr, kompass.com, linkedin.com/company, bfmbusiness, lefigaro.fr/societes).
Ta mission : déterminer le chiffre d'affaires le plus plausible, une estimation du nombre réel de salariés, et le nom de domaine du site officiel de l'entreprise.
Règles strictes :
- Ne jamais inventer une donnée absente. Si aucune source fiable, retourne null pour ce champ.
- Privilégie toujours le chiffre d'affaires SIRENE officiel s'il est fourni (confiance "haute").
- Sinon, ne retiens un chiffre d'affaires web que s'il apparaît de façon cohérente dans au moins 2 extraits distincts (confiance "moyenne"), sinon null.
- L'effectif réel doit rester cohérent avec la tranche officielle SIRENE fournie (ne jamais sortir de la tranche sauf incohérence flagrante confirmée par 2 sources).
- Le nom de domaine doit être un domaine simple sans "https://" ni "www." (ex: "exemple.fr"), uniquement s'il apparaît explicitement dans les extraits.
Réponds UNIQUEMENT avec un objet JSON strict, sans texte hors JSON, sans bloc markdown :
{"chiffre_affaires": "...ou null", "effectif_reel": "...ou null", "nom_domaine": "...ou null", "confiance": "haute|moyenne|faible"}`;

  const user = JSON.stringify({
    denomination, commune,
    ca_sirene_officiel: sireneCA?.montant || null,
    tranche_effectif_officielle: trancheLabel || null,
    extraits_recherche_ca: caSnippets,
    extraits_recherche_domaine: domainSnippets,
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const raw = (data.content?.[0]?.text || "").trim().replace(/^```json\s*|```$/g, "");
  try {
    return JSON.parse(raw);
  } catch {
    return { chiffre_affaires: null, effectif_reel: null, nom_domaine: null, confiance: "faible" };
  }
}

// ── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return new Response("method not allowed", { status: 405, headers: CORS });

  const SB_URL  = Deno.env.get("SUPABASE_URL")!;
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SB_SRV  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Non authentifié" }, 401);

  const sbUser = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) return json({ error: "Non authentifié" }, 401);

  const sbSrv = createClient(SB_URL, SB_SRV);

  let body: { targets?: Target[] } = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  const targets = (body.targets || []).slice(0, MAX_TARGETS);
  if (!targets.length) return json({ error: "Aucune cible fournie" }, 400);

  const CSE_KEY    = Deno.env.get("GOOGLE_CUSTOM_SEARCH");
  const CSE_CX     = Deno.env.get("GOOGLE_CSE_CX");
  const CLAUDE_KEY = Deno.env.get("ANTHROPIC_API_KEY");

  const rows = await Promise.all(targets.map(async (target) => {
    const blank = { siren: "", chiffre_affaires: "", effectif: "", nom_domaine: "", email_courtier: EMAIL_COURTIER, label: target.label };
    try {
      const siren = await resolveSiren(target);
      if (!siren) return blank;

      // Cache — évite de repayer Google/Claude pour une entreprise déjà enrichie récemment
      const { data: cached } = await sbSrv
        .from("entreprise_enrichissement_cache")
        .select("*")
        .eq("siren", siren)
        .maybeSingle();

      const fresh = cached && (Date.now() - new Date(cached.updated_at as string).getTime()) < CACHE_MAX_AGE_DAYS * 86_400_000;
      if (fresh) {
        return {
          siren,
          chiffre_affaires: (cached!.chiffre_affaires as string) || "",
          effectif:         (cached!.effectif_reel as string) || (cached!.effectif_tranche as string) || "",
          nom_domaine:      (cached!.nom_domaine as string) || "",
          email_courtier:   EMAIL_COURTIER,
          label:            (cached!.denomination as string) || target.label,
        };
      }

      const sireneRes      = await fetchSireneBySiren(siren);
      const denomination   = (sireneRes?.nom_complet as string) || target.label;
      const siege          = sireneRes?.siege as Record<string, unknown> | undefined;
      const commune        = (siege?.commune as string) || "";
      const trancheCode    = (sireneRes?.tranche_effectif_salarie as string) || (siege?.tranche_effectif_salarie as string) || "";
      const trancheLabel   = TRANCHE_EFFECTIF[trancheCode] || "";
      const sireneCA       = caFromFinances(sireneRes?.finances);

      let chiffreAffaires: string | null = sireneCA?.montant || null;
      let effectifReel:    string | null = null;
      let nomDomaine:      string | null = null;
      let confiance = sireneCA ? "haute" : "faible";

      if (CSE_KEY && CSE_CX && CLAUDE_KEY) {
        const [caResults, domResults] = await Promise.all([
          googleCseSearch(CSE_KEY, CSE_CX, `"${denomination}" chiffre d'affaires ${commune}`),
          googleCseSearch(CSE_KEY, CSE_CX, `"${denomination}" ${commune} site internet officiel`),
        ]);
        console.log(`[DEBUG ${denomination}] caResults=${caResults.length} domResults=${domResults.length}`, JSON.stringify({ caResults, domResults }));
        const ia = await askClaude(CLAUDE_KEY, denomination, commune, sireneCA, trancheLabel, caResults, domResults);
        console.log(`[DEBUG ${denomination}] ia=`, JSON.stringify(ia));
        chiffreAffaires = ia.chiffre_affaires || chiffreAffaires;
        effectifReel    = ia.effectif_reel || null;
        nomDomaine      = ia.nom_domaine || null;
        confiance       = ia.confiance || confiance;
      }

      await sbSrv.from("entreprise_enrichissement_cache").upsert({
        siren, denomination,
        chiffre_affaires: chiffreAffaires, chiffre_affaires_src: sireneCA ? "sirene" : "web",
        effectif_reel: effectifReel, effectif_tranche: trancheLabel,
        nom_domaine: nomDomaine, confiance,
        updated_at: new Date().toISOString(),
      });

      return {
        siren,
        chiffre_affaires: chiffreAffaires || "",
        effectif:         effectifReel || trancheLabel || "",
        nom_domaine:      nomDomaine || "",
        email_courtier:   EMAIL_COURTIER,
        label:            denomination,
      };
    } catch {
      return blank;
    }
  }));

  return json({ rows });
});
