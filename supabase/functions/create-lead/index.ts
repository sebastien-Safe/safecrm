// Edge Function publique — Créer un prospect depuis un formulaire de contact
// (safe-assurances.fr / safe-digitalisation.fr → CRM safecrm)
// POST /functions/v1/create-lead
// Body : { site, nom, email, telephone?, entreprise?, sujet?, message, consent_telephone, honeypot? }

import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = [
  "https://www.safe-assurances.fr",
  "https://www.safe-digitalisation.fr",
];

const MARQUES: Record<string, { label: string; email: string }> = {
  assurances:     { label: "S@FE Assurances",     email: "contact@safe-assurances.fr" },
  digitalisation: { label: "S@FE Digitalisation", email: "contact@safe-digitalisation.fr" },
};

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("not allowed", { status: 405, headers: CORS });

  const BREVO = Deno.env.get("BREVO");
  const sb    = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }); }

  const { site, nom, email, telephone, entreprise, sujet, message, consent_telephone, honeypot } = body as Record<string, string | boolean | undefined>;

  // Piège à spam : champ caché qui doit rester vide pour un humain
  if (honeypot) {
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const marque = typeof site === "string" ? MARQUES[site] : undefined;
  if (!marque || !nom || !email || !message) {
    return new Response(JSON.stringify({ error: "Champs obligatoires manquants" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const canalAcquisition = `Site web — ${marque.label}`;
  const notes = sujet ? `${sujet}\n\n${message}` : String(message);

  // Créer le prospect (non affecté — visible de tous, récupérable via transfert)
  const { data: contact, error: cErr } = await sb
    .from("contacts")
    .insert({
      nom, email,
      telephone:  telephone  || null,
      entreprise: entreprise || null,
      notes,
      statut:            "Prospect",
      kanban_col:        "prospect",
      canal_acquisition: canalAcquisition,
      qualification:     "non_qualifié",
      consent_telephone: !!consent_telephone,
      created_by:        null,
    })
    .select("id")
    .single();

  if (cErr) return new Response(JSON.stringify({ error: "Erreur création prospect", detail: cErr.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });

  // Tâche de suivi pour qu'un commercial qualifie le prospect
  await sb.from("tasks").insert({
    contact_id:  contact.id,
    titre:       `Qualifier ce prospect web — ${nom}`,
    description: `Reçu via le formulaire de contact ${marque.label}.\nEmail : ${email}${telephone ? "\nTél : " + telephone : ""}${sujet ? "\nSujet : " + sujet : ""}\n\nMessage :\n${message}`,
    type_tache:  "Premier contact",
    statut:      "À faire",
    priorite:    "Normale",
    created_by:  null,
  });

  // Journal RGPD — apparaît automatiquement dans l'onglet Journal RGPD (audit_logs)
  await sb.from("audit_logs").insert({
    user_id:            null,
    user_role:          "Système",
    action:             "contact_cree_web",
    module:             "Contacts",
    entity_type:        "contact",
    entity_id:          contact.id,
    donnees_concernees: "nom, email, téléphone, message, consentement démarchage téléphonique",
    criticite:          "Info",
    resultat:           "Succès",
    details: {
      user_nom: `Formulaire web — ${marque.label}`,
      site,
      consent_telephone: !!consent_telephone,
    },
  });

  // Notification email à l'équipe (non bloquant)
  if (BREVO) {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [{ email: marque.email }],
        subject: `🌐 Nouveau prospect web — ${nom}`,
        htmlContent: `
          <h2 style="color:#0a1628">Nouveau prospect via le formulaire de contact</h2>
          <p><strong>Marque :</strong> ${marque.label}</p>
          <p><strong>Nom :</strong> ${nom}${entreprise ? ` (${entreprise})` : ""}</p>
          <p><strong>Email :</strong> ${email}</p>
          ${telephone ? `<p><strong>Téléphone :</strong> ${telephone}</p>` : ""}
          ${sujet ? `<p><strong>Sujet :</strong> ${sujet}</p>` : ""}
          <p><strong>Message :</strong><br>${String(message).replace(/\n/g, "<br>")}</p>
          <p><strong>Consentement démarchage téléphonique :</strong> ${consent_telephone ? "Oui" : "Non"}</p>
          <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb">
          <p style="font-size:12px;color:#9ca3af">S@FE — Fiche créée automatiquement dans la CRM.</p>
        `,
        replyTo: { email: String(email), name: String(nom) },
      }),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 201, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
