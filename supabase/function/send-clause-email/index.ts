import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// templateId 7 = Clause Collaborateur (CRM user)
// templateId 8 = Clause Publique (external)
// IDs à confirmer après création dans Brevo
const TEMPLATE: Record<string, number> = {
  collaborateur: 7, // à confirmer après création dans Brevo
  public:        6,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("not allowed", { status: 405 });

  const BREVO = Deno.env.get("BREVO");
  if (!BREVO) {
    return new Response(JSON.stringify({ error: "BREVO non configuré" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }

  const { type, nom, prenom, email, date_signature, pdf_base64 } = body;

  if (!email || !type || !(type in TEMPLATE)) {
    return json({ error: "Paramètres invalides (email, type requis — type: collaborateur | public)" }, 400);
  }

  const firstName = prenom || nom || "Signataire";
  const fullName  = [prenom, nom].filter(Boolean).join(" ") || "Signataire";

  const dateStr = date_signature
    ? new Date(date_signature).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" })
    : new Date().toLocaleDateString("fr-FR");

  const attachments: { name: string; content: string }[] = [];
  if (pdf_base64) {
    attachments.push({
      name:    `Clause-Confidentialite-SAFE-${fullName.replace(/\s+/g, "_")}.pdf`,
      content: pdf_base64,
    });
  }

  const payload = {
    sender:     { name: "S@FE", email: "noreply@safe-digitalisation.fr" },
    to:         [{ email, name: fullName }],
    bcc:        [{ email: "contact@safe-digitalisation.fr", name: "S@FE Admin" }],
    replyTo:    { email: "contact@safe-digitalisation.fr", name: "Michel Alonso" },
    templateId: TEMPLATE[type],
    params: {
      FIRST_NAME:        firstName,
      NOM:               nom || "",
      DATE_SIGNATURE:    dateStr,
      COMMERCIAL_PRENOM: "Michel",
      COMMERCIAL_NOM:    "Alonso",
      COMMERCIAL_TITRE:  "Président",
    },
    ...(attachments.length ? { attachment: attachments } : {}),
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO!, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("Brevo error:", res.status, txt);
    return json({ error: txt }, 500);
  }

  return json({ ok: true });
});
