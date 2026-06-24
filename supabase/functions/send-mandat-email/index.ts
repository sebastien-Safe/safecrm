import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@^1.0.0/base64";

const CORS = {
  "Access-Control-Allow-Origin": "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STORAGE_BASE =
  "https://qdjmzietysukediqkebg.supabase.co/storage/v1/object/public/contrats-pdf/WORK/Force-de-vente/documents-contractuels";

const STATIC_DOCS = [
  { name: "Mandat DCI Vierge.pdf",                file: "mandat-dci-vierge.pdf" },
  { name: "Grille de commissionnement 2026.pdf",   file: "grille-commissionnement-2026.pdf" },
  { name: "CGV S@FE 2026.pdf",                     file: "cgv-safe-2026.pdf" },
  { name: "Charte sous-traitance RGPD.pdf",        file: "charte-rgpd-2026.pdf" },
  { name: "Fiche Referencement Local.pdf",         file: "fiche-referencement-local.pdf" },
  { name: "Fiche Click & Collect.pdf",             file: "fiche-click-collect.pdf" },
  { name: "Fiche Cybersecurite.pdf",               file: "fiche-cybersecurite.pdf" },
  { name: "Fiche RGPD & DPO Externalise.pdf",      file: "fiche-rgpd-conformite.pdf" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("not allowed", { status: 405 });

  const SB_URL  = Deno.env.get("SUPABASE_URL")!;
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const BREVO   = Deno.env.get("BREVO");

  if (!BREVO) {
    return new Response(JSON.stringify({ error: "BREVO non configuré" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("unauthorized", { status: 401, headers: CORS });

  const sbAnon = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await sbAnon.auth.getUser();
  if (authErr || !user) return new Response("unauthorized", { status: 401, headers: CORS });

  const body = await req.json();
  const { prenom, nom, numero, signed_at, pdf_base64 } = body;

  const firstName = prenom || "Agent commercial";
  const fullName  = `${prenom || ""} ${nom || ""}`.trim();
  const dateStr   = signed_at
    ? new Date(signed_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" })
    : new Date().toLocaleDateString("fr-FR");

  // Signed mandat PDF (always first attachment)
  const attachments: { name: string; content: string }[] = [];
  if (pdf_base64) {
    attachments.push({
      name:    `Mandat_${(nom || "agent").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
      content: pdf_base64,
    });
  }

  // Fetch static commercial documents from storage (fire-and-forget per file)
  await Promise.all(
    STATIC_DOCS.map(async (doc) => {
      try {
        const res = await fetch(`${STORAGE_BASE}/${doc.file}`);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          attachments.push({ name: doc.name, content: encodeBase64(new Uint8Array(buf)) });
        } else {
          console.warn(`Doc non disponible (${res.status}): ${doc.file}`);
        }
      } catch (e) {
        console.warn(`Fetch doc ${doc.file} échoué:`, e);
      }
    }),
  );

  const payload = {
    sender:     { name: "S@FE", email: "noreply@safe-digitalisation.fr" },
    to:         [{ email: user.email!, name: fullName }],
    bcc:        [{ email: "contact@safe-digitalisation.fr", name: "S@FE Admin" }],
    replyTo:    { email: "contact@safe-digitalisation.fr", name: "Michel Alonso" },
    templateId: Number(Deno.env.get("BREVO_TEMPLATE_MANDAT") ?? 5),
    params: {
      FIRST_NAME:        firstName,
      NUMERO:            numero || "",
      DATE_SIGNATURE:    dateStr,
      COMMERCIAL_PRENOM: "Michel",
      COMMERCIAL_NOM:    "Alonso",
      COMMERCIAL_TITRE:  "Président",
    },
    ...(attachments.length ? { attachment: attachments } : {}),
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("Brevo error:", res.status, txt);
    return new Response(JSON.stringify({ error: txt }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, attachments: attachments.length }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
