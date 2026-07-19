import { createClient } from "@supabase/supabase-js";
import { PROVIDERS, PRIORITY, selectProvider } from "./lib.ts";

const CORS = {
  "Access-Control-Allow-Origin": "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")   return new Response("not allowed", { status: 405 });

  const SB_URL  = Deno.env.get("SUPABASE_URL")!;
  const SB_SRV  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  // ── Auth ─────────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response("unauthorized", { status: 401, headers: CORS });

  const sbAnon = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authErr } = await sbAnon.auth.getUser();
  if (authErr || !user) return new Response("unauthorized", { status: 401, headers: CORS });

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: { service_key?: string; system?: string; messages?: { role: string; content: string }[] };
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const { system = "", messages = [] } = body;
  let { service_key } = body;

  const sb = createClient(SB_URL, SB_SRV);

  // ── Résolution du connecteur ──────────────────────────────────────────────
  // Si service_key non fourni, prendre le premier actif selon priorité
  if (!service_key) {
    const { data: rows } = await sb.from("safe_connectors")
      .select("service_key, statut")
      .in("service_key", PRIORITY)
      .eq("statut", "actif");

    if (!rows?.length) return json({ error: "Aucun connecteur IA actif" }, 403);

    service_key = selectProvider(rows as Array<{ service_key: string }>);
  }

  if (!service_key) return json({ error: "Connecteur introuvable" }, 400);

  // Vérifier que le connecteur demandé est bien actif
  const { data: conn } = await sb.from("safe_connectors")
    .select("statut").eq("service_key", service_key).maybeSingle();

  if (!conn || conn.statut !== "actif") {
    return json({ error: `Connecteur "${service_key}" non actif` }, 403);
  }

  const provider = PROVIDERS[service_key];
  if (!provider) return json({ error: `Fournisseur "${service_key}" inconnu` }, 400);

  const apiKey = Deno.env.get(provider.keyEnv);
  if (!apiKey) return json({ error: `Secret ${provider.keyEnv} manquant — à configurer dans Supabase Dashboard → Edge Functions → Secrets` }, 500);

  // ── Appel API IA ──────────────────────────────────────────────────────────
  let reply = "";

  if (provider.format === "anthropic") {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 1024,
        system: system || "Tu es un assistant expert. Réponds en français, de manière concise et actionnable.",
        messages,
      }),
    });
    if (!res.ok) return json({ error: await res.text() }, 500);
    const data = await res.json();
    reply = data.content?.[0]?.text || "";

  } else {
    // Format OpenAI-compatible (Grok)
    const all = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    const res = await fetch(provider.url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: provider.model, messages: all, max_tokens: 1024 }),
    });
    if (!res.ok) return json({ error: await res.text() }, 500);
    const data = await res.json();
    reply = data.choices?.[0]?.message?.content || "";
  }

  // Log usage (fire-and-forget)
  sb.from("safe_connectors_log").insert({
    connector_key: service_key,
    action: "api_call",
    done_by: user.id,
    notes: `module call — ${messages.length} messages`,
  }).then(() => {}, () => {});

  return json({ reply, provider: service_key });
});
