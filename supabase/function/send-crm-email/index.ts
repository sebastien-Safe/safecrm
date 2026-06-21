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

  return json({ error: "Type inconnu" }, 400);
});
