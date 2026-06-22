import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLE_TITRE: Record<string, string> = {
  super_admin: "Président",
  admin:       "Président",
  dci:         "Directeur Commercial Indépendant",
  niveau_1:    "Votre interlocuteur attitré",
  niveau_2:    "Votre interlocuteur attitré",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("not allowed", { status: 405 });

  const SB_URL  = Deno.env.get("SUPABASE_URL")!;
  const SB_SRV  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const BREVO   = Deno.env.get("BREBO");

  if (!BREVO) {
    return new Response(JSON.stringify({ error: "BREVO non configuré" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("unauthorized", { status: 401, headers: CORS });

  const sbAnon = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await sbAnon.auth.getUser();
  if (authErr || !user) return new Response("unauthorized", { status: 401, headers: CORS });

  const sb = createClient(SB_URL, SB_SRV);

  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) return new Response("forbidden", { status: 403, headers: CORS });

  const body = await req.json();
  const { type } = body;

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function getCommercial(userId: string) {
    const fallback = { prenom: "Michel", nom: "Alonso", titre: "Président", email: "contact@safe-digitalisation.fr" };
    if (!userId) return fallback;
    try {
      const [{ data: p }, { data: u }] = await Promise.all([
        sb.from("profiles").select("prenom, nom, role").eq("id", userId).maybeSingle(),
        sb.auth.admin.getUserById(userId),
      ]);
      return {
        prenom: p?.prenom || fallback.prenom,
        nom:    p?.nom    || fallback.nom,
        titre:  ROLE_TITRE[p?.role ?? ""] || "Votre interlocuteur attitré",
        email:  u?.user?.email || fallback.email,
      };
    } catch { return fallback; }
  }

  function eur(n: number) { return n.toFixed(2).replace(".", ",") + " €"; }

  function escTs(s: unknown): string {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  async function sendBrevoHtml(
    subject:     string,
    to:          { email: string; name: string },
    htmlContent: string,
    replyTo?:    { email: string; name: string },
    attachment?: { name: string; content: string },
  ) {
    const payload: Record<string, unknown> = {
      sender:      { name: "S@FE", email: "noreply@safe-digitalisation.fr" },
      to:          [to],
      subject,
      htmlContent,
    };
    if (replyTo)    payload.replyTo    = replyTo;
    if (attachment) payload.attachment = [attachment];
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method:  "POST",
      headers: { "api-key": BREVO!, "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) console.error("Brevo HTML error:", res.status, await res.text());
    return res.ok;
  }

  async function sendBrevo(
    templateId: number,
    to:         { email: string; name: string },
    params:     Record<string, unknown>,
    replyTo?:   { email: string; name: string },
    attachment?: { name: string; content: string },
  ) {
    const payload: Record<string, unknown> = {
      sender:     { name: "S@FE", email: "noreply@safe-digitalisation.fr" },
      to:         [to],
      templateId,
      params,
    };
    if (replyTo)    payload.replyTo    = replyTo;
    if (attachment) payload.attachment = [attachment];

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO!, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("Brevo error:", res.status, txt);
    }
    return res.ok;
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  // ── RÉSILIATION CLIENT ────────────────────────────────────────────────────
  if (type === "resiliation") {
    const { contract_id, date_fin } = body;

    const { data: ct } = await sb.from("contracts")
      .select("type, formule, contact_id, created_by")
      .eq("id", contract_id)
      .maybeSingle();

    if (!ct) return json({ error: "Contrat introuvable" }, 404);

    const [{ data: contact }, commercial] = await Promise.all([
      sb.from("contacts").select("nom, prenom, email, entreprise").eq("id", ct.contact_id).maybeSingle(),
      getCommercial(ct.created_by),
    ]);

    if (!contact?.email) return json({ ok: true, skipped: "no contact email" });

    const clientNom = contact.entreprise || `${contact.prenom || ""} ${contact.nom || ""}`.trim();
    const firstName = contact.prenom || contact.nom || "Client";
    const service   = [ct.type, ct.formule].filter(Boolean).join(" — ");
    const dateFin   = date_fin
      ? new Date(date_fin).toLocaleDateString("fr-FR")
      : "à l'échéance en cours";

    await sendBrevo(
      3,
      { email: contact.email, name: clientNom },
      {
        FIRST_NAME:      firstName,
        SERVICE:         service,
        HIGHLIGHT_TEXT:  `Votre contrat ${service} prendra fin le ${dateFin}.`,
        COMMERCIAL_PRENOM: commercial.prenom,
        COMMERCIAL_NOM:    commercial.nom,
        COMMERCIAL_TITRE:  commercial.titre,
      },
      { email: commercial.email, name: `${commercial.prenom} ${commercial.nom}` },
    );

    return json({ ok: true });
  }

  // ── BORDEREAU DE COMMISSION ───────────────────────────────────────────────
  if (type === "bordereau") {
    const { user_id, periode, montant_ttc, nb_contrats, pdf_base64 } = body;

    const [{ data: p }, { data: u }] = await Promise.all([
      sb.from("profiles").select("prenom, nom, role").eq("id", user_id).maybeSingle(),
      sb.auth.admin.getUserById(user_id),
    ]);

    const commercial = {
      prenom: p?.prenom || "Commercial",
      nom:    p?.nom    || "",
      titre:  ROLE_TITRE[p?.role ?? ""] || "Votre interlocuteur attitré",
      email:  u?.user?.email || "",
    };

    if (!commercial.email) return json({ ok: true, skipped: "no commercial email" });

    const periodeLabel = periode
      ? new Date(periode + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : "";
    const montantStr = montant_ttc ? eur(Number(montant_ttc)) : "—";
    const nb = Number(nb_contrats) || 0;

    const attachment = pdf_base64 ? {
      name:    `Bordereau_${commercial.prenom}_${periode || "comm"}.pdf`,
      content: pdf_base64,
    } : undefined;

    await sendBrevo(
      4,
      { email: commercial.email, name: `${commercial.prenom} ${commercial.nom}`.trim() },
      {
        FIRST_NAME:          commercial.prenom,
        MONTANT:             montantStr,
        SERVICE:             `${nb} contrat${nb > 1 ? "s" : ""} — ${periodeLabel}`,
        HIGHLIGHT_BLUE_TEXT: `Total TTC à percevoir : ${montantStr}. Versement sous 15 jours.`,
        COMMERCIAL_PRENOM:   commercial.prenom,
        COMMERCIAL_NOM:      commercial.nom,
        COMMERCIAL_TITRE:    commercial.titre,
      },
      undefined,
      attachment,
    );

    return json({ ok: true });
  }

  // ── PAIEMENT DES COMMISSIONS ──────────────────────────────────────────────
  if (type === "commission_payee") {
    const { bordereau_id } = body;

    const { data: bord } = await sb.from("bordereau_log")
      .select("user_id, periode, montant_total")
      .eq("id", bordereau_id)
      .maybeSingle();

    if (!bord) return json({ error: "Bordereau introuvable" }, 404);

    const [{ data: p }, { data: u }] = await Promise.all([
      sb.from("profiles").select("prenom, nom, role").eq("id", bord.user_id).maybeSingle(),
      sb.auth.admin.getUserById(bord.user_id),
    ]);

    const commercial = {
      prenom: p?.prenom || "Commercial",
      nom:    p?.nom    || "",
      titre:  ROLE_TITRE[p?.role ?? ""] || "Votre interlocuteur attitré",
      email:  u?.user?.email || "",
    };

    if (!commercial.email) return json({ ok: true, skipped: "no commercial email" });

    const periodeLabel = bord.periode
      ? new Date(bord.periode + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : "";
    const montantStr  = bord.montant_total ? eur(Number(bord.montant_total)) : "—";
    const dateVirement = new Date().toLocaleDateString("fr-FR");

    await sendBrevo(
      0, // ⚠️ templateId à renseigner — ID 6 est pris (Clause publique) — utiliser l'ID suivant disponible dans Brevo
      { email: commercial.email, name: `${commercial.prenom} ${commercial.nom}`.trim() },
      {
        FIRST_NAME:          commercial.prenom,
        MONTANT:             montantStr,
        SERVICE:             periodeLabel,
        HIGHLIGHT_BLUE_TEXT: `Virement de ${montantStr} effectué le ${dateVirement}.`,
        COMMERCIAL_PRENOM:   commercial.prenom,
        COMMERCIAL_NOM:      commercial.nom,
        COMMERCIAL_TITRE:    commercial.titre,
      },
    );

    return json({ ok: true });
  }

  // ── RAPPORT DPO PAR EMAIL ─────────────────────────────────────────────
  if (type === "rapport_dpo") {
    const { contact_id, objet, contenu, pdf_base64 } = body;

    const [{ data: contact }, commercial] = await Promise.all([
      sb.from("contacts").select("nom, prenom, email, entreprise").eq("id", contact_id).maybeSingle(),
      getCommercial(user.id),
    ]);

    if (!contact?.email) return json({ ok: true, skipped: "no contact email" });

    const clientNom   = contact.entreprise || `${contact.prenom || ""} ${contact.nom || ""}`.trim();
    const firstName   = contact.prenom || contact.nom || "Client";
    const dateRapport = new Date().toLocaleDateString("fr-FR");
    const sujet       = String(objet || `Rapport RGPD — ${dateRapport}`);

    // Markdown léger → HTML + préserve les sauts de ligne
    const htmlContenu = escTs(contenu || "")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escTs(sujet)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%">

  <!-- EN-TÊTE -->
  <tr><td style="background:#0d1b36;padding:28px 32px;text-align:center">
    <div style="font-family:Arial,sans-serif;font-size:26px;font-weight:800;color:#b8952a;letter-spacing:.02em">
      S<span style="color:#ffffff">@</span>FE
    </div>
    <div style="color:#94a3b8;font-size:12px;margin-top:6px;letter-spacing:.08em;text-transform:uppercase">
      Rapport RGPD — Protection des données
    </div>
  </td></tr>

  <!-- CORPS -->
  <tr><td style="padding:36px 36px 28px">
    <p style="color:#1e293b;font-size:15px;margin:0 0 18px">
      Bonjour <strong>${escTs(firstName)}</strong>,
    </p>
    <p style="color:#475569;font-size:14px;margin:0 0 20px;line-height:1.6">
      Suite à notre analyse RGPD du <strong>${dateRapport}</strong>,
      veuillez trouver ci-dessous votre rapport de conformité.
    </p>

    <!-- Objet du rapport -->
    <div style="border-left:3px solid #b8952a;padding:10px 16px;background:#fafbfc;
      border-radius:2px;margin-bottom:22px">
      <span style="font-size:13px;font-weight:700;color:#1e293b">${escTs(sujet)}</span>
    </div>

    <!-- Contenu du rapport -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
      padding:24px 28px;font-size:14px;color:#334155;line-height:1.75">
      ${htmlContenu}
    </div>

    <!-- Signature -->
    <div style="margin-top:32px;padding-top:22px;border-top:1px solid #e2e8f0">
      <p style="color:#475569;font-size:14px;margin:0 0 6px">Cordialement,</p>
      <p style="color:#1e293b;font-size:14px;font-weight:700;margin:0">
        ${escTs(commercial.prenom)} ${escTs(commercial.nom)}
      </p>
      <p style="color:#64748b;font-size:12px;margin:4px 0 0">
        ${escTs(commercial.titre)} — S@FE Digitalisation
      </p>
    </div>
  </td></tr>

  <!-- PIED DE PAGE -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;text-align:center">
    <p style="color:#94a3b8;font-size:11px;margin:0 0 4px">
      Ce rapport est confidentiel et destiné uniquement à ${escTs(clientNom)}.
    </p>
    <p style="color:#94a3b8;font-size:11px;margin:0">
      S@FE Digitalisation — Conformité RGPD pour TPE/PME
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const dpoAttachment = pdf_base64
      ? { name: `Rapport-RGPD-${clientNom.replace(/[^a-z0-9]/gi, "_")}-${dateRapport.replace(/\//g, "-")}.pdf`, content: String(pdf_base64) }
      : undefined;

    await sendBrevoHtml(
      sujet,
      { email: contact.email, name: clientNom },
      html,
      { email: commercial.email, name: `${commercial.prenom} ${commercial.nom}` },
      dpoAttachment,
    );

    return json({ ok: true });
  }

  // ── RAPPORT SEO PAR EMAIL ─────────────────────────────────────────────
  if (type === "rapport_seo") {
    const { contact_id, objet, contenu, pdf_base64 } = body;

    const [{ data: contact }, commercial] = await Promise.all([
      sb.from("contacts").select("nom, prenom, email, entreprise").eq("id", contact_id).maybeSingle(),
      getCommercial(user.id),
    ]);

    if (!contact?.email) return json({ ok: true, skipped: "no contact email" });

    const clientNom   = contact.entreprise || `${contact.prenom || ""} ${contact.nom || ""}`.trim();
    const firstName   = contact.prenom || contact.nom || "Client";
    const dateRapport = new Date().toLocaleDateString("fr-FR");
    const sujet       = String(objet || `Rapport SEO — ${dateRapport}`);

    const htmlContenu = escTs(contenu || "")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escTs(sujet)}</title>
</head>
<body style="margin:0;padding:0;background:#f0faf5;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0faf5;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%">

  <!-- EN-TÊTE -->
  <tr><td style="background:#064e3b;padding:28px 32px;text-align:center">
    <div style="font-family:Arial,sans-serif;font-size:26px;font-weight:800;color:#6ee7b7;letter-spacing:.02em">
      S<span style="color:#ffffff">@</span>FE
    </div>
    <div style="color:#a7f3d0;font-size:12px;margin-top:6px;letter-spacing:.08em;text-transform:uppercase">
      Rapport SEO — Référencement local
    </div>
  </td></tr>

  <!-- BANDEAU DATE -->
  <tr><td style="background:#ecfdf5;border-bottom:2px solid #d1fae5;padding:12px 36px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:#065f46;font-weight:600">🔍 Analyse SEO locale</td>
        <td style="text-align:right;font-size:12px;color:#6b7280">Rapport du ${dateRapport}</td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPS -->
  <tr><td style="padding:36px 36px 28px">
    <p style="color:#1e293b;font-size:15px;margin:0 0 18px">
      Bonjour <strong>${escTs(firstName)}</strong>,
    </p>
    <p style="color:#475569;font-size:14px;margin:0 0 20px;line-height:1.6">
      Voici votre rapport de suivi SEO du <strong>${dateRapport}</strong>.
      Ce document synthétise nos recommandations pour améliorer votre visibilité en ligne.
    </p>

    <!-- Objet du rapport -->
    <div style="border-left:3px solid #10b981;padding:10px 16px;background:#f0fdf4;
      border-radius:2px;margin-bottom:22px">
      <span style="font-size:13px;font-weight:700;color:#065f46">${escTs(sujet)}</span>
    </div>

    <!-- Contenu du rapport -->
    <div style="background:#f8fafc;border:1px solid #d1fae5;border-radius:8px;
      padding:24px 28px;font-size:14px;color:#334155;line-height:1.75">
      ${htmlContenu}
    </div>

    <!-- Rappel services -->
    <div style="margin-top:24px;background:#ecfdf5;border-radius:8px;padding:16px 20px">
      <p style="font-size:12px;color:#065f46;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em">
        🌐 Nos services SEO local
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:12px;color:#374151;padding:3px 0">📍 Google Business Profile</td>
          <td style="font-size:12px;color:#374151;padding:3px 0">🔑 Mots-clés locaux</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#374151;padding:3px 0">✍️ Rédaction SEO</td>
          <td style="font-size:12px;color:#374151;padding:3px 0">🔗 Netlinking local</td>
        </tr>
      </table>
    </div>

    <!-- Signature -->
    <div style="margin-top:32px;padding-top:22px;border-top:1px solid #e2e8f0">
      <p style="color:#475569;font-size:14px;margin:0 0 6px">Cordialement,</p>
      <p style="color:#1e293b;font-size:14px;font-weight:700;margin:0">
        ${escTs(commercial.prenom)} ${escTs(commercial.nom)}
      </p>
      <p style="color:#64748b;font-size:12px;margin:4px 0 0">
        ${escTs(commercial.titre)} — S@FE Digitalisation
      </p>
    </div>
  </td></tr>

  <!-- PIED DE PAGE -->
  <tr><td style="background:#ecfdf5;border-top:1px solid #d1fae5;padding:18px 36px;text-align:center">
    <p style="color:#6b7280;font-size:11px;margin:0 0 4px">
      Ce rapport est confidentiel et destiné uniquement à ${escTs(clientNom)}.
    </p>
    <p style="color:#6b7280;font-size:11px;margin:0">
      S@FE Digitalisation — Référencement local pour TPE/PME
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const seoAttachment = pdf_base64
      ? { name: `Rapport-SEO-${clientNom.replace(/[^a-z0-9]/gi, "_")}-${dateRapport.replace(/\//g, "-")}.pdf`, content: String(pdf_base64) }
      : undefined;

    await sendBrevoHtml(
      sujet,
      { email: contact.email, name: clientNom },
      html,
      { email: commercial.email, name: `${commercial.prenom} ${commercial.nom}` },
      seoAttachment,
    );

    return json({ ok: true });
  }

  return json({ error: "Type inconnu" }, 400);
});
