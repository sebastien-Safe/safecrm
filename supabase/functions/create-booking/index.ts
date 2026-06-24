// Edge Function publique — Créer une réservation RDV
// POST /functions/v1/create-booking
// Body : { token, date, heure, nom, entreprise, email, telephone, message, adresse }

import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("not allowed", { status: 405, headers: CORS });

  const BREVO = Deno.env.get("BREVO");
  const sb    = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }); }

  const { token, date, heure, nom, entreprise, email, telephone, message, adresse } = body;

  if (!token || !date || !heure || !nom || !email) {
    return new Response(JSON.stringify({ error: "Champs obligatoires manquants" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Récupérer le commercial
  const { data: profile } = await sb
    .from("profiles")
    .select("id, prenom, nom, availability")
    .eq("booking_token", token)
    .maybeSingle();

  if (!profile) return new Response(JSON.stringify({ error: "Token invalide" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });

  // Vérifier que le créneau n'est pas déjà pris (double-booking guard)
  const { count } = await sb
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("commercial_id", profile.id)
    .eq("date", date)
    .eq("heure", heure)
    .eq("statut", "confirmé");

  if ((count ?? 0) > 0) {
    return new Response(JSON.stringify({ error: "Ce créneau vient d'être réservé, veuillez en choisir un autre." }), { status: 409, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Géocodage adresse via BAN (data.gouv.fr) — aucune clé API requise
  let lat: number | null = null, lng: number | null = null;
  if (adresse) {
    try {
      const banResp = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`);
      if (banResp.ok) {
        const banData = await banResp.json();
        const feat = banData.features?.[0];
        if (feat) { [lng, lat] = feat.geometry.coordinates; }
      }
    } catch { /* géocodage non bloquant */ }
  }

  // Créer la réservation
  const { data: booking, error: bErr } = await sb
    .from("bookings")
    .insert({ commercial_id: profile.id, date, heure, nom, entreprise: entreprise || null, email, telephone: telephone || null, message: message || null, adresse: adresse || null, lat, lng })
    .select("id")
    .single();

  if (bErr) return new Response(JSON.stringify({ error: "Erreur création réservation", detail: bErr.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });

  // Créer aussi une tâche RDV terrain dans le CRM
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  await sb.from("tasks").insert({
    created_by:  profile.id,
    contact_id:  null,
    titre:       `RDV ${nom}${entreprise ? " — " + entreprise : ""}`,
    description: `Réservé en ligne via lien booking.\nEmail : ${email}${telephone ? "\nTél : " + telephone : ""}${message ? "\nMessage : " + message : ""}${adresse ? "\nAdresse : " + adresse : ""}`,
    type_tache:  "RDV terrain",
    rdv_date:    date,
    rdv_heure:   heure,
    rdv_lieu:    adresse || null,
    statut:      "À faire",
    priorite:    "Normale",
  });

  // Notification email au commercial via Brevo (email simple, pas de template)
  if (BREVO) {
    const mapsUrl = adresse
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}&travelmode=driving`
      : null;

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [{ email: "contact@safe-digitalisation.fr", name: `${profile.prenom} ${profile.nom}` }],
        subject: `📅 Nouveau RDV — ${nom} — ${dateLabel} à ${heure}`,
        htmlContent: `
          <h2 style="color:#0a1628">Nouveau RDV réservé en ligne</h2>
          <p><strong>Prospect :</strong> ${nom}${entreprise ? ` (${entreprise})` : ""}</p>
          <p><strong>Email :</strong> ${email}</p>
          ${telephone ? `<p><strong>Téléphone :</strong> ${telephone}</p>` : ""}
          <p><strong>Date :</strong> ${dateLabel} à ${heure}</p>
          ${adresse ? `<p><strong>Adresse :</strong> ${adresse}</p>` : ""}
          ${message ? `<p><strong>Message :</strong> ${message}</p>` : ""}
          ${mapsUrl ? `<p><a href="${mapsUrl}" style="background:#f59e0b;color:#0a1628;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;margin-top:8px">🗺️ Voir l'itinéraire</a></p>` : ""}
          <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb">
          <p style="font-size:12px;color:#9ca3af">S@FE Safe Digitalisation — contact@safe-digitalisation.fr</p>
        `,
        replyTo: { email, name: nom },
      }),
    }).catch(() => {});
  }

  // URL itinéraire Google Maps pour la réponse (utilisée par booking.html)
  const mapsUrl = adresse
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}&travelmode=driving`
    : null;

  return new Response(JSON.stringify({ ok: true, booking_id: booking.id, maps_url: mapsUrl }), {
    status: 201, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
