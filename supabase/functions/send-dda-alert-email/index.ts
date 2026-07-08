import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "content-type, x-dda-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Alerte {
  nom: string;
  heures_realisees: number;
  heures_requises: number;
  statut: string;
  jours_restants: number;
}

function buildHtml(alertes: Alerte[]): string {
  const rows = alertes.map(a => `
    <tr>
      <td style="padding:9px 10px;border-bottom:1px solid #f3f4f6;font-size:13px">${esc(a.nom)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f3f4f6;font-size:13px">${esc(a.heures_realisees)}h / ${esc(a.heures_requises)}h</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f3f4f6;font-size:13px">${esc(a.statut)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f3f4f6;font-size:13px">${esc(a.jours_restants)} j</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6">
<tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
<tr><td style="background:#030D26;padding:20px 28px">
  <span style="color:#C9A24B;font-size:18px;font-weight:bold">S@FE Assurances</span><br>
  <span style="color:#7C97C4;font-size:12px">Formation DDA — Échéance à surveiller</span>
</td></tr>
<tr><td style="padding:24px 28px">
  <p style="font-size:14px;color:#1B2233">Les collaborateurs suivants sont à moins de 6 semaines du 31 décembre sans avoir atteint leur quota d'heures de formation continue DDA :</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px">
    <tr>
      <th style="text-align:left;padding:9px 10px;font-size:11px;text-transform:uppercase;color:#5A6478">Collaborateur</th>
      <th style="text-align:left;padding:9px 10px;font-size:11px;text-transform:uppercase;color:#5A6478">Heures</th>
      <th style="text-align:left;padding:9px 10px;font-size:11px;text-transform:uppercase;color:#5A6478">Statut</th>
      <th style="text-align:left;padding:9px 10px;font-size:11px;text-transform:uppercase;color:#5A6478">Restant</th>
    </tr>
    ${rows}
  </table>
  <p style="font-size:13px;color:#5A6478;margin-top:20px">Consultez l'espace formateur pour planifier une session ou relancer le collaborateur.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: CORS });

  const BREVO = Deno.env.get("BREVO");
  const DDA_ALERT_SECRET = Deno.env.get("DDA_ALERT_SECRET");
  const SB_URL = Deno.env.get("SUPABASE_URL")!;
  const SB_SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!BREVO) {
    return new Response(JSON.stringify({ error: "BREVO non configuré" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const secret = req.headers.get("x-dda-secret");
  if (DDA_ALERT_SECRET && secret !== DDA_ALERT_SECRET) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let body: { alertes?: Alerte[] };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }); }

  const alertes = body.alertes || [];
  if (!alertes.length) {
    return new Response(JSON.stringify({ ok: true, skipped: "no alerts" }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const sb = createClient(SB_URL, SB_SRV);
  const { data: formateurs } = await sb.from("profiles").select("id, prenom, nom").eq("is_formateur", true);

  if (!formateurs?.length) {
    return new Response(JSON.stringify({ ok: true, skipped: "no formateur" }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const htmlContent = buildHtml(alertes);
  const results = [];

  for (const f of formateurs) {
    const { data: u } = await sb.auth.admin.getUserById(f.id);
    const email = u?.user?.email;
    if (!email) continue;

    const payload = {
      sender: { name: "S@FE", email: "noreply@safe-digitalisation.fr" },
      to: [{ email, name: f.prenom || "Formateur" }],
      subject: `⏰ Formation DDA — ${alertes.length} collaborateur(s) à surveiller`,
      htmlContent,
    };

    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Brevo error:", err);
      results.push({ email, ok: false });
    } else {
      results.push({ email, ok: true });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
});
