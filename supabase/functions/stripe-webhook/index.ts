import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// ── Signature commerciale : role → titre affiché ──────────────────────────
const ROLE_TITRE: Record<string, string> = {
  super_admin: "Président",
  admin:       "Président",
  dci:         "Directeur Commercial Indépendant",
  niveau_1:    "Votre interlocuteur attitré",
  niveau_2:    "Votre interlocuteur attitré",
};

// ── Utilitaires ───────────────────────────────────────────────────────────
function eur(n: number) { return n.toFixed(2).replace(".", ",") + " €"; }

function dateFR(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("fr-FR");
}

async function nextNumero(sb: ReturnType<typeof createClient>) {
  const year = new Date().getFullYear();
  const { count } = await sb.from("factures")
    .select("id", { count: "exact", head: true })
    .like("numero", `FACT-${year}-%`);
  return `FACT-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
}

async function fetchCommercial(sb: ReturnType<typeof createClient>, userId: string | null) {
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

// ── Génération PDF facture ────────────────────────────────────────────────
async function genererPDF(d: {
  numero: string; dateStr: string; stripeRef: string;
  client: { nom: string; prenom: string; entreprise: string; siret: string; adresse: string; cp_ville: string };
  service: { type: string; formule: string; recurrence: string };
  ht: number; tva: number; ttc: number;
}) {
  const doc  = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const W    = page.getWidth();
  const H    = page.getHeight();
  const fB   = await doc.embedFont(StandardFonts.HelveticaBold);
  const fR   = await doc.embedFont(StandardFonts.Helvetica);

  const cBleu  = rgb(0.055, 0.067, 0.118);
  const cGold  = rgb(0.855, 0.647, 0.122);
  const cGrey  = rgb(0.50, 0.50, 0.50);
  const cBlack = rgb(0, 0, 0);
  const cWhite = rgb(1, 1, 1);

  let y = H - 60;

  // En-tête
  page.drawText("S@FE", { x: 50, y, font: fB, size: 28, color: cBleu });
  page.drawText("Digitalisation", { x: 50, y: y - 20, font: fR, size: 10, color: cGrey });
  page.drawText("Référencement • Cybersécurité • RGPD", { x: 50, y: y - 33, font: fR, size: 8, color: cGrey });
  page.drawText("FACTURE", { x: 390, y, font: fB, size: 22, color: cBleu });
  page.drawText(`N° ${d.numero}`, { x: 390, y: y - 20, font: fR, size: 10, color: cBlack });
  page.drawText(`Date : ${d.dateStr}`, { x: 390, y: y - 34, font: fR, size: 10, color: cBlack });

  y -= 58;
  page.drawLine({ start: { x: 50, y }, end: { x: W - 50, y }, thickness: 2, color: cGold });

  // Émetteur / Client
  y -= 26;
  page.drawText("ÉMETTEUR", { x: 50, y, font: fB, size: 8, color: cGrey });
  page.drawText("CLIENT",   { x: 320, y, font: fB, size: 8, color: cGrey });

  const rows: [string, string][] = [
    ["S@FE SAS", d.client.entreprise || `${d.client.prenom} ${d.client.nom}`.trim()],
    ["66 avenue des Champs-Élysées", d.client.adresse],
    ["75008 Paris", d.client.cp_ville],
    ["SIRET : 104 699 558 00011", d.client.siret ? `SIRET : ${d.client.siret}` : ""],
    ["TVA : FR76 104 699 558", ""],
    ["ORIAS : N° 26008536", ""],
  ];
  for (const [left, right] of rows) {
    y -= 14;
    if (left) page.drawText(left.substring(0, 40), { x: 50, y, font: fR, size: 9, color: cBlack });
    if (right) page.drawText(right.substring(0, 40), { x: 320, y, font: fR, size: 9, color: cBlack });
  }

  // En-tête tableau
  y -= 40;
  page.drawRectangle({ x: 50, y: y - 5, width: W - 100, height: 22, color: cBleu });
  page.drawText("Désignation",  { x: 58,  y: y + 4, font: fB, size: 9, color: cWhite });
  page.drawText("Qté",          { x: 375, y: y + 4, font: fB, size: 9, color: cWhite });
  page.drawText("PU HT",        { x: 410, y: y + 4, font: fB, size: 9, color: cWhite });
  page.drawText("Total HT",     { x: 498, y: y + 4, font: fB, size: 9, color: cWhite });

  y -= 24;
  const rec  = d.service.recurrence !== "Ponctuel" ? ` — ${d.service.recurrence}` : "";
  const desc = `${d.service.type} — ${d.service.formule}${rec}`;
  page.drawText(desc.substring(0, 62), { x: 58, y, font: fR, size: 9, color: cBlack });
  page.drawText("1",        { x: 378, y, font: fR, size: 9, color: cBlack });
  page.drawText(eur(d.ht),  { x: 405, y, font: fR, size: 9, color: cBlack });
  page.drawText(eur(d.ht),  { x: 492, y, font: fR, size: 9, color: cBlack });

  y -= 20;
  page.drawLine({ start: { x: 50, y }, end: { x: W - 50, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });

  // Totaux
  y -= 18;
  page.drawText("Total HT :",  { x: 388, y: y + 10, font: fR, size: 10, color: cBlack });
  page.drawText(eur(d.ht),     { x: 490, y: y + 10, font: fR, size: 10, color: cBlack });
  page.drawText("TVA (20 %) :", { x: 388, y: y - 4, font: fR, size: 10, color: cBlack });
  page.drawText(eur(d.tva),    { x: 490, y: y - 4,  font: fR, size: 10, color: cBlack });
  page.drawRectangle({ x: 370, y: y - 30, width: W - 420, height: 22, color: cGold });
  page.drawText("Total TTC :", { x: 388, y: y - 20, font: fB, size: 11, color: cBleu });
  page.drawText(eur(d.ttc),    { x: 485, y: y - 20, font: fB, size: 11, color: cBleu });

  // Confirmation paiement
  y -= 65;
  page.drawLine({ start: { x: 50, y }, end: { x: W - 50, y }, thickness: 0.5, color: cGold });
  y -= 14;
  page.drawText(`Paiement confirmé le ${d.dateStr} — Réf. Stripe : ${d.stripeRef}`, { x: 50, y, font: fR, size: 8, color: cGrey });

  // Pied de page
  y = 55;
  page.drawLine({ start: { x: 50, y }, end: { x: W - 50, y }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) });
  page.drawText(
    "S@FE SAS • 66 av. des Champs-Élysées 75008 Paris • contact@safe-digitalisation.fr • www.safe-digitalisation.fr",
    { x: 50, y: y - 14, font: fR, size: 7, color: cGrey }
  );
  page.drawText(
    "SIRET 104 699 558 00011 • TVA FR76 104 699 558 • ORIAS N° 26008536",
    { x: 50, y: y - 25, font: fR, size: 7, color: cGrey }
  );

  return await doc.save();
}

// ── Envoi facture (PDF + Brevo) ───────────────────────────────────────────
async function envoyerFacture(sb: ReturnType<typeof createClient>, opts: {
  contractId: string; contactId: string; createdBy: string | null;
  amountTtcCents: number; stripeEventId: string; stripeRef: string; dateTs: number;
}) {
  // Idempotence : si cet event a déjà généré une facture, on skip
  const { data: existing } = await sb.from("factures")
    .select("id").eq("stripe_event_id", opts.stripeEventId).maybeSingle();
  if (existing) return;

  const [{ data: contact }, { data: contrat }, commercial, numero] = await Promise.all([
    sb.from("contacts").select("nom, prenom, entreprise, email, siret, adresse, code_postal_ville").eq("id", opts.contactId).maybeSingle(),
    sb.from("contracts").select("type, formule, recurrence").eq("id", opts.contractId).maybeSingle(),
    fetchCommercial(sb, opts.createdBy),
    nextNumero(sb),
  ]);

  if (!contact?.email) return;

  const ttc    = opts.amountTtcCents / 100;
  const ht     = Math.round((ttc / 1.2) * 100) / 100;
  const tva    = Math.round((ttc - ht) * 100) / 100;
  const dateStr = dateFR(opts.dateTs);
  const dateFile = new Date(opts.dateTs * 1000).toISOString().slice(0, 10);

  const pdfBytes = await genererPDF({
    numero, dateStr, stripeRef: opts.stripeRef,
    client: {
      nom:        contact.nom        || "",
      prenom:     contact.prenom     || "",
      entreprise: contact.entreprise || "",
      siret:      contact.siret      || "",
      adresse:    contact.adresse    || "",
      cp_ville:   contact.code_postal_ville || "",
    },
    service: {
      type:       contrat?.type       || "Prestation S@FE",
      formule:    contrat?.formule    || "",
      recurrence: contrat?.recurrence || "Mensuel",
    },
    ht, tva, ttc,
  });

  // Upload storage
  const siret    = (contact.siret || "").replace(/\s/g, "") || "client";
  const filePath = `PDF/FACTURES/CLIENT/${siret}/facture_${dateFile}_${Date.now()}.pdf`;
  await sb.storage.from("contrats-pdf").upload(filePath, pdfBytes, { contentType: "application/pdf" });
  const { data: urlData } = sb.storage.from("contrats-pdf").getPublicUrl(filePath);
  const pdfUrl = urlData?.publicUrl ?? null;

  // Insérer en base
  await sb.from("factures").insert({
    numero, contract_id: opts.contractId, contact_id: opts.contactId,
    commercial_id: opts.createdBy, montant_ht: ht, tva, montant_ttc: ttc,
    stripe_event_id: opts.stripeEventId, pdf_url: pdfUrl,
  });

  // Envoi Brevo
  const BREVO = Deno.env.get("BREVO");
  if (!BREVO) return;

  const clientNom    = contact.entreprise || `${contact.prenom || ""} ${contact.nom || ""}`.trim();
  const firstName    = contact.prenom || contact.nom || "Client";
  const serviceLabel = [contrat?.type, contrat?.formule].filter(Boolean).join(" — ") || "Votre service S@FE";
  const pdfBase64    = btoa(String.fromCharCode(...pdfBytes));

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender:     { name: "S@FE", email: "noreply@safe-digitalisation.fr" },
      to:         [{ email: contact.email, name: clientNom }],
      replyTo:    { email: commercial.email, name: `${commercial.prenom} ${commercial.nom}` },
      templateId: 2,
      params: {
        document_type:       "Facture",
        reference:           numero,
        firstname:           firstName,
        FIRST_NAME:          firstName,
        SUBJECT_DYNAMIC:     `Votre facture S@FE — ${serviceLabel}`,
        MONTANT:             eur(ttc),
        SERVICE:             serviceLabel,
        NUMERO:              numero,
        SHOW_HIGHLIGHT:      false,
        HIGHLIGHT_TEXT:      "",
        SHOW_HIGHLIGHT_BLUE: true,
        HIGHLIGHT_BLUE_TEXT: `Paiement de ${eur(ttc)} confirmé le ${dateStr} via Stripe.`,
        COMMERCIAL_PRENOM:   commercial.prenom,
        COMMERCIAL_NOM:      commercial.nom,
        COMMERCIAL_TITRE:    commercial.titre,
      },
      attachment: [{ name: `${numero}.pdf`, content: pdfBase64 }],
    }),
  });

  await sb.from("factures").update({ email_sent_at: new Date().toISOString() })
    .eq("stripe_event_id", opts.stripeEventId);
}

// ═════════════════════════════════════════════════════════════════════════
// WEBHOOK PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method !== "POST") return new Response("not allowed", { status: 405 });

  const STRIPE_KEY     = Deno.env.get("STRIPE_SECRET_KEY")!;
  const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const SB_URL         = Deno.env.get("SUPABASE_URL")!;
  const SB_KEY         = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-04-10" });
  const sb     = createClient(SB_URL, SB_KEY);
  const body   = await req.text();
  const now    = new Date().toISOString();

  if (!WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET manquant — webhook rejeté");
    return new Response("webhook not configured", { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing sig", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (e) {
    console.error("Webhook signature error:", e);
    return new Response("bad sig", { status: 400 });
  }

  async function contractBySubId(subId: string) {
    const { data } = await sb.from("contracts")
      .select("id, statut, contact_id, created_by")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    return data;
  }

  async function log(action: string, entityId: string, details: Record<string, unknown>) {
    await sb.from("audit_logs").insert({
      user_id: null, action, entity_type: "contract", entity_id: entityId, details,
    });
  }

  // ── 1. checkout.session.completed ────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const contractId = session.metadata?.contract_id;
    if (contractId) {
      const update: Record<string, unknown> = { statut: "Contrat en cours" };
      if (session.subscription) {
        update.stripe_subscription_id = typeof session.subscription === "string"
          ? session.subscription : session.subscription.id;
      }
      await sb.from("contracts").update(update).eq("id", contractId);
      await log("paiement_confirme", contractId, {
        session_id: session.id, subscription: session.subscription, mode: session.mode,
      });

      // Avancer le pipeline : Devis envoyé → En cours
      const { data: ct } = await sb.from("contracts")
        .select("contact_id, created_by").eq("id", contractId).maybeSingle();
      if (ct?.contact_id) {
        await sb.from("contacts").update({ kanban_col: "en_cours" }).eq("id", ct.contact_id);
      }

      // Facture uniquement pour paiements ponctuels (les abonnements → invoice.paid)
      if (session.mode === "payment" && session.amount_total && ct) {
        await envoyerFacture(sb, {
          contractId,
          contactId:      ct.contact_id,
          createdBy:      ct.created_by,
          amountTtcCents: session.amount_total,
          stripeEventId:  event.id,
          stripeRef:      (typeof session.payment_intent === "string" ? session.payment_intent : session.id),
          dateTs:         Math.floor(Date.now() / 1000),
        });
      }
    }
  }

  // ── 2. invoice.paid ──────────────────────────────────────────────────
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = typeof invoice.subscription === "string"
      ? invoice.subscription : invoice.subscription?.id;
    if (subId) {
      const ct = await contractBySubId(subId);
      if (ct) {
        if (ct.statut === "Paiement échoué") {
          await sb.from("contracts").update({ statut: "Contrat en cours" }).eq("id", ct.id);
          await log("paiement_recouvre", ct.id, { invoice_id: invoice.id, amount_paid: invoice.amount_paid });
        } else {
          await log("renouvellement_confirme", ct.id, {
            invoice_id: invoice.id, amount_paid: invoice.amount_paid, period_end: (invoice as any).period_end,
          });
        }
        // Facture pour tous les paiements d'abonnement (1er + renouvellements)
        if (invoice.amount_paid > 0) {
          await envoyerFacture(sb, {
            contractId:    ct.id,
            contactId:     ct.contact_id,
            createdBy:     ct.created_by,
            amountTtcCents: invoice.amount_paid,
            stripeEventId:  event.id,
            stripeRef:      invoice.id,
            dateTs:         invoice.created || Math.floor(Date.now() / 1000),
          });
        }
      }
    }
  }

  // ── 3. invoice.payment_failed ────────────────────────────────────────
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = typeof invoice.subscription === "string"
      ? invoice.subscription : invoice.subscription?.id;
    if (subId) {
      const ct = await contractBySubId(subId);
      if (ct && !["Résilié", "Terminé"].includes(ct.statut)) {
        await sb.from("contracts").update({ statut: "Paiement échoué" }).eq("id", ct.id);
        const nextAttemptStr = invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString("fr-FR") : "";
        await sb.from("interactions").insert({
          contact_id: ct.contact_id, created_by: ct.created_by, type: "Autre",
          date: now.slice(0, 10), objet: "Échec de paiement Stripe",
          contenu: `Stripe a signalé un échec de paiement (tentative n°${invoice.attempt_count}). Prochaine tentative : ${nextAttemptStr || "—"}.`,
          suite_a_donner: "Contacter le client pour régulariser le moyen de paiement.",
        });
        await log("paiement_echoue", ct.id, {
          invoice_id: invoice.id, attempt_count: invoice.attempt_count,
          next_payment_attempt: invoice.next_payment_attempt,
        });
        // Email client : paiement refusé
        const BREVO = Deno.env.get("BREVO");
        if (BREVO && ct.contact_id) {
          const [{ data: contact }, commercial] = await Promise.all([
            sb.from("contacts").select("nom, prenom, entreprise, email").eq("id", ct.contact_id).maybeSingle(),
            fetchCommercial(sb, ct.created_by),
          ]);
          const { data: contrat } = await sb.from("contracts").select("type, formule").eq("id", ct.id).maybeSingle();
          if (contact?.email) {
            const clientNom    = contact.entreprise || `${contact.prenom || ""} ${contact.nom || ""}`.trim();
            const firstName    = contact.prenom || contact.nom || "Client";
            const serviceLabel = [contrat?.type, contrat?.formule].filter(Boolean).join(" — ") || "Votre service S@FE";
            const montantStr   = invoice.amount_due ? eur(invoice.amount_due / 100) : "";
            await fetch("https://api.brevo.com/v3/smtp/email", {
              method: "POST",
              headers: { "api-key": BREVO, "Content-Type": "application/json" },
              body: JSON.stringify({
                sender:     { name: "S@FE", email: "noreply@safe-digitalisation.fr" },
                to:         [{ email: contact.email, name: clientNom }],
                replyTo:    { email: commercial.email, name: `${commercial.prenom} ${commercial.nom}` },
                templateId: 1,
                params: {
                  FIRST_NAME:    firstName,
                  MONTANT:       montantStr,
                  SERVICE:       serviceLabel,
                  NEXT_ATTEMPT:  nextAttemptStr,
                  COMMERCIAL_PRENOM: commercial.prenom,
                  COMMERCIAL_NOM:    commercial.nom,
                  COMMERCIAL_TITRE:  commercial.titre,
                },
              }),
            });
          }
        }
      }
    }
  }

  // ── 4. customer.subscription.updated ────────────────────────────────
  if (event.type === "customer.subscription.updated") {
    const sub  = event.data.object as Stripe.Subscription;
    const prev = (event.data as any).previous_attributes as Partial<Stripe.Subscription>;
    const ct   = await contractBySubId(sub.id);
    if (ct && prev?.cancel_at_period_end !== undefined) {
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10) : null;
      if (sub.cancel_at_period_end && !prev.cancel_at_period_end) {
        if (!["Résilié", "Terminé"].includes(ct.statut)) {
          await sb.from("contracts").update({
            statut: "Résilié", resilié_at: now, date_echeance: periodEnd,
            resiliation_stripe_checked_at: now,
          }).eq("id", ct.id);
          await sb.from("contacts").update({ kanban_col: "resilie" }).eq("id", ct.contact_id);
          await log("resiliation_programmee_stripe", ct.id, { via: "customer.subscription.updated", period_end: periodEnd });
        }
      } else if (!sub.cancel_at_period_end && prev.cancel_at_period_end) {
        if (ct.statut === "Résilié") {
          await sb.from("contracts").update({
            statut: "Contrat en cours", resilié_at: null, resiliation_validee_at: null,
          }).eq("id", ct.id);
          await sb.from("contacts").update({ kanban_col: "en_cours" }).eq("id", ct.contact_id);
          await log("resiliation_annulee_stripe", ct.id, { via: "customer.subscription.updated" });
        }
      }
    }
  }

  // ── 5. customer.subscription.deleted ────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const ct  = await contractBySubId(sub.id);
    if (ct && ct.statut !== "Terminé") {
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10) : null;
      await sb.from("contracts").update({
        statut: "Résilié", resilié_at: now, date_echeance: periodEnd,
        resiliation_stripe_checked_at: now,
      }).eq("id", ct.id);
      await sb.from("contacts").update({ kanban_col: "resilie" }).eq("id", ct.contact_id);
      await log("resiliation_effective_stripe", ct.id, {
        via: "customer.subscription.deleted", period_end: periodEnd, sub_status: sub.status,
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
