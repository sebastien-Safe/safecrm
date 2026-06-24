// Edge Function — Envoi rapport audit gratuit via Brevo (template ID 12)
// Appelée depuis les pages mission prospection-terrain (sans auth Supabase)
// Protégée par un secret partagé AUDIT_SECRET (env var)

const CORS = {
  "Access-Control-Allow-Origin": "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "content-type, x-audit-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: CORS });

  const BREVO        = Deno.env.get("BREVO");
  const AUDIT_SECRET = Deno.env.get("AUDIT_SECRET");

  if (!BREVO) return new Response(JSON.stringify({ error: "BREVO non configuré" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });

  // Vérification secret partagé
  const secret = req.headers.get("x-audit-secret");
  if (AUDIT_SECRET && secret !== AUDIT_SECRET) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }); }

  const { to_email, to_name, params } = body as {
    to_email: string;
    to_name: string;
    params: Record<string, string>;
  };

  if (!to_email || !to_name || !params) {
    return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const payload = {
    to: [{ email: to_email, name: to_name }],
    templateId: 12,
    params,
    replyTo: { email: "contact@safe-digitalisation.fr", name: "S@FE Safe Digitalisation" },
  };

  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("Brevo error:", err);
    return new Response(JSON.stringify({ error: "Erreur Brevo", detail: err }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
});
