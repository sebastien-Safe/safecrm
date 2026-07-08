// Edge Function publique — Créer un prospect depuis un formulaire de contact ou de devis
// (safe-assurances.fr / safe-digitalisation.fr → CRM safecrm)
// POST /functions/v1/create-lead
// Body contact : { site, form_type: 'contact', nom, email, telephone?, sujet?, message, rgpd, consent_telephone?, honeypot? }
// Body devis   : { site: 'assurances', form_type: 'devis', raison_sociale, secteur, chiffre_affaires, effectif,
//                  garanties?, contact_nom, email, telephone, message?, rgpd, honeypot? }

import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = [
  "https://www.safe-assurances.fr",
  "https://safe-assurances.fr",
  "https://www.safe-digitalisation.fr",
  "https://safe-digitalisation.fr",
];

const MARQUES: Record<string, { label: string; email: string }> = {
  assurances:     { label: "S@FE Assurances",     email: "contact@safe-assurances.fr" },
  digitalisation: { label: "S@FE Digitalisation", email: "contact@safe-digitalisation.fr" },
};

// Texte de consentement exact affiché sur chaque formulaire — codé en dur ici
// (preuve juridique non falsifiable depuis le front) plutôt que reçu du client.
const RGPD_TEXTE: Record<string, string> = {
  contact: "J'accepte que mes données soient traitées pour répondre à ma demande.",
  devis:   "J'accepte que S@FE Assurances traite mes données dans le cadre de cette demande de devis.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_MAX_PER_HOUR = 20;

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

function jsonResponse(body: Record<string, unknown>, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("not allowed", { status: 405, headers: CORS });

  const BREVO = Deno.env.get("BREVO");
  const sb    = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return jsonResponse({ error: "JSON invalide" }, 400, CORS); }

  // ── Rate limit par IP (anti-abus, avant tout traitement) ──
  const ip       = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rlKey    = `formintake_ip:${ip}`;
  const rlWindow = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();

  const { data: rl } = await sb.from("rate_limits")
    .select("count, window_at").eq("action", rlKey).maybeSingle();

  if (rl && rl.window_at?.slice(0, 13) === rlWindow.slice(0, 13)) {
    if (rl.count >= RATE_LIMIT_MAX_PER_HOUR) return jsonResponse({ error: "rate_limit" }, 429, CORS);
    await sb.from("rate_limits").update({ count: rl.count + 1, updated_at: new Date().toISOString() }).eq("action", rlKey);
  } else {
    await sb.from("rate_limits").upsert({ action: rlKey, count: 1, window_at: rlWindow }, { onConflict: "action" });
  }

  const { site, form_type, honeypot } = body as Record<string, string | undefined>;

  // Piège à spam : champ caché qui doit rester vide pour un humain — rejet silencieux
  if (honeypot) return jsonResponse({ ok: true }, 201, CORS);

  const marque = typeof site === "string" ? MARQUES[site] : undefined;
  const type   = form_type === "devis" ? "devis" : "contact";
  if (!marque) return jsonResponse({ error: "Site inconnu" }, 400, CORS);

  // Le consentement RGPD général n'est exigé (et tracé) que pour S@FE Assurances :
  // le site S@FE Digitalisation n'a pas (encore) de case dédiée dans son formulaire —
  // le rendre obligatoire ici casserait sa soumission en production.
  const rgpd = body.rgpd === true;
  if (marque.label === "S@FE Assurances" && !rgpd) {
    return jsonResponse({ error: "Consentement RGPD requis" }, 400, CORS);
  }

  let nom: string, email: string, telephone: string | null, entreprise: string | null, notes: string;
  let canalAcquisition: string, donneesConcernees: string, tacheTitre: string, tacheDescription: string;
  let emailSubject: string, emailBodyHtml: string;

  if (type === "devis") {
    if (marque.label !== "S@FE Assurances") return jsonResponse({ error: "Formulaire devis non disponible pour ce site" }, 400, CORS);

    const {
      raison_sociale, secteur, chiffre_affaires, effectif,
      contact_nom, telephone: tel, email: mail, message, garanties,
    } = body as Record<string, string | string[] | undefined>;

    if (!raison_sociale || !secteur || !chiffre_affaires || !effectif || !contact_nom || !tel || !mail) {
      return jsonResponse({ error: "Champs obligatoires manquants" }, 400, CORS);
    }
    if (typeof mail !== "string" || !EMAIL_RE.test(mail)) return jsonResponse({ error: "Email invalide" }, 400, CORS);

    const garantiesListe = Array.isArray(garanties) && garanties.length ? garanties.join(", ") : "non précisé";

    nom        = String(contact_nom);
    email      = mail;
    telephone  = String(tel);
    entreprise = String(raison_sociale);
    notes      = `Demande de devis — secteur : ${secteur}, CA : ${chiffre_affaires}, effectif : ${effectif}\nGaranties souhaitées : ${garantiesListe}${message ? `\n\n${message}` : ""}`;

    canalAcquisition  = "site_assurances_devis";
    donneesConcernees = "raison sociale, secteur, CA, effectif, garanties souhaitées, contact, email, téléphone, message, consentement RGPD";
    tacheTitre        = `Qualifier cette demande de devis — ${nom}`;
    tacheDescription  = `Reçu via le formulaire de devis ${marque.label}.\nEntreprise : ${entreprise}\nEmail : ${email}\nTél : ${telephone}\nSecteur : ${secteur}, CA : ${chiffre_affaires}, effectif : ${effectif}\nGaranties souhaitées : ${garantiesListe}${message ? `\n\nMessage :\n${message}` : ""}`;

    emailSubject  = `📋 Nouvelle demande de devis — ${nom}`;
    emailBodyHtml = `
      <h2 style="color:#0a1628">Nouvelle demande de devis</h2>
      <p><strong>Entreprise :</strong> ${entreprise}</p>
      <p><strong>Contact :</strong> ${nom}</p>
      <p><strong>Email :</strong> ${email}</p>
      <p><strong>Téléphone :</strong> ${telephone}</p>
      <p><strong>Secteur :</strong> ${secteur}</p>
      <p><strong>Chiffre d'affaires :</strong> ${chiffre_affaires}</p>
      <p><strong>Effectif :</strong> ${effectif}</p>
      <p><strong>Garanties souhaitées :</strong> ${garantiesListe}</p>
      ${message ? `<p><strong>Précisions :</strong><br>${String(message).replace(/\n/g, "<br>")}</p>` : ""}
      <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb">
      <p style="font-size:12px;color:#9ca3af">S@FE — Fiche créée automatiquement dans la CRM.</p>
    `;
  } else {
    const { nom: n, email: mail, telephone: tel, sujet, message, consent_telephone } = body as Record<string, string | boolean | undefined>;

    if (!n || !mail || !message) return jsonResponse({ error: "Champs obligatoires manquants" }, 400, CORS);
    if (typeof mail !== "string" || !EMAIL_RE.test(mail)) return jsonResponse({ error: "Email invalide" }, 400, CORS);

    nom        = String(n);
    email      = mail;
    telephone  = tel ? String(tel) : null;
    entreprise = null;
    notes      = sujet ? `${sujet}\n\n${message}` : String(message);

    canalAcquisition  = marque.label === "S@FE Assurances" ? "site_assurances_contact" : `Site web — ${marque.label}`;
    donneesConcernees = "nom, email, téléphone, message, consentement RGPD, consentement démarchage téléphonique";
    tacheTitre        = `Qualifier ce prospect web — ${nom}`;
    tacheDescription  = `Reçu via le formulaire de contact ${marque.label}.\nEmail : ${email}${telephone ? "\nTél : " + telephone : ""}${sujet ? "\nSujet : " + sujet : ""}\n\nMessage :\n${message}`;

    emailSubject  = `🌐 Nouveau prospect web — ${nom}`;
    emailBodyHtml = `
      <h2 style="color:#0a1628">Nouveau prospect via le formulaire de contact</h2>
      <p><strong>Marque :</strong> ${marque.label}</p>
      <p><strong>Nom :</strong> ${nom}</p>
      <p><strong>Email :</strong> ${email}</p>
      ${telephone ? `<p><strong>Téléphone :</strong> ${telephone}</p>` : ""}
      ${sujet ? `<p><strong>Sujet :</strong> ${sujet}</p>` : ""}
      <p><strong>Message :</strong><br>${String(message).replace(/\n/g, "<br>")}</p>
      <p><strong>Consentement démarchage téléphonique :</strong> ${consent_telephone ? "Oui" : "Non"}</p>
      <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb">
      <p style="font-size:12px;color:#9ca3af">S@FE — Fiche créée automatiquement dans la CRM.</p>
    `;
  }

  const nowIso = new Date().toISOString();

  // Créer le prospect (non affecté — visible de tous, récupérable via transfert)
  const { data: contact, error: cErr } = await sb
    .from("contacts")
    .insert({
      nom, email, telephone, entreprise, notes,
      statut:              "Prospect",
      kanban_col:          "prospect",
      canal_acquisition:   canalAcquisition,
      qualification:       "non_qualifié",
      consent_telephone:   type === "contact" ? !!(body as Record<string, unknown>).consent_telephone : false,
      consent_rgpd:        rgpd,
      consent_rgpd_at:     rgpd ? nowIso : null,
      consent_rgpd_texte:  rgpd ? RGPD_TEXTE[type] : null,
      created_by:          null,
    })
    .select("id")
    .single();

  if (cErr) return jsonResponse({ error: "Erreur création prospect", detail: cErr.message }, 500, CORS);

  // Tâche de suivi pour qu'un commercial qualifie le prospect
  await sb.from("tasks").insert({
    contact_id:  contact.id,
    titre:       tacheTitre,
    description: tacheDescription,
    type_tache:  "Premier contact",
    statut:      "À faire",
    priorite:    "Normale",
    created_by:  null,
  });

  // Journal RGPD — apparaît automatiquement dans l'onglet Journal RGPD (audit_logs)
  await sb.from("audit_logs").insert({
    user_id:            null,
    user_role:          "Système",
    action:             type === "devis" ? "devis_cree_web" : "contact_cree_web",
    module:             "Contacts",
    entity_type:        "contact",
    entity_id:          contact.id,
    donnees_concernees: donneesConcernees,
    criticite:          "Info",
    resultat:           "Succès",
    details: {
      user_nom:     `Formulaire web — ${marque.label}`,
      site,
      form_type:    type,
      consent_rgpd: rgpd,
    },
  });

  // Notification email à l'équipe (non bloquant — l'insertion CRM prime)
  if (BREVO) {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [{ email: marque.email }],
        subject: emailSubject,
        htmlContent: emailBodyHtml,
        replyTo: { email, name: nom },
      }),
    }).catch(() => {});
  }

  return jsonResponse({ ok: true }, 201, CORS);
});
