// =========================================================
// Edge Function : send-contract
// =========================================================
// Reçoit du CRM (utilisateur authentifié) un PDF de bon de
// commande signé, et :
//   1. dépose ce PDF sur le kDrive Infomaniak du compte S@FE
//   2. envoie ce PDF par e-mail au client (via SMTP iCloud)
//
// Les secrets vivent UNIQUEMENT dans Supabase (Project
// Settings → Edge Functions → Secrets). Jamais dans le
// navigateur, jamais dans GitHub Pages.
//
// Secrets requis :
//   - KDRIVE_TOKEN          : token API Infomaniak
//   - KDRIVE_ID             : 3217898 (votre kDrive)
//   - KDRIVE_FOLDER_ID      : 149 (dossier "Bons de commande signés")
//   - SMTP_HOST             : smtp.mail.me.com
//   - SMTP_PORT             : 587
//   - SMTP_USER             : contact@safe-digitalisation.fr
//   - SMTP_PASSWORD         : mot de passe d'app iCloud
//   - SMTP_FROM_NAME        : "S@FE Digitalisation"
//
// Déploiement :
//   supabase functions deploy send-contract --no-verify-jwt
//   (la vérification du JWT est faite manuellement dans le
//   handler pour pouvoir retourner des erreurs explicites)
// =========================================================

// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ---- Authentification de l'utilisateur appelant ----
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "unauthorized" }, 401);

  // ---- Lecture du payload ----
  let payload: {
    pdf_base64: string; filename: string; ref_unique: string;
    client_email: string; client_name?: string;
    contract_id?: string; contact_id?: string;
    subject?: string; body?: string;
  };
  try { payload = await req.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  if (!payload.pdf_base64 || !payload.filename || !payload.client_email) {
    return json({ error: "missing_fields", required: ["pdf_base64", "filename", "client_email"] }, 400);
  }

  // ---- Décodage du PDF (base64 → Uint8Array) ----
  const pdfBytes = Uint8Array.from(atob(payload.pdf_base64), c => c.charCodeAt(0));

  // ---- Étape 1 : Upload kDrive Infomaniak ----
  const kdriveId = Deno.env.get("KDRIVE_ID");
  const kdriveFolder = Deno.env.get("KDRIVE_FOLDER_ID");
  const kdriveToken = Deno.env.get("KDRIVE_TOKEN");
  if (!kdriveId || !kdriveFolder || !kdriveToken) {
    return json({ error: "kdrive_not_configured" }, 500);
  }

  const kdriveUrl = `https://api.infomaniak.com/2/drive/${kdriveId}/upload`
    + `?directory_id=${kdriveFolder}`
    + `&file_name=${encodeURIComponent(payload.filename)}`
    + `&total_size=${pdfBytes.length}`
    + `&conflict=rename`;

  let kdriveResponse: { id?: string; name?: string; url?: string } | null = null;
  try {
    const r = await fetch(kdriveUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${kdriveToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: pdfBytes,
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error("kdrive_upload_failed", r.status, txt);
      return json({ error: "kdrive_upload_failed", status: r.status, details: txt }, 502);
    }
    const j = await r.json();
    // Réponse Infomaniak : { result: "success", data: { id, name, ... } }
    const data = j?.data || j;
    kdriveResponse = {
      id: data?.id,
      name: data?.name || payload.filename,
      url: data?.id
        ? `https://ksuite.infomaniak.com/kdrive/app/drive/${kdriveId}/files/${data.id}`
        : undefined,
    };
  } catch (e) {
    console.error("kdrive_error", e);
    return json({ error: "kdrive_error", details: String(e) }, 502);
  }

  // ---- Étape 2 : Envoi par e-mail au client ----
  const smtpHost = Deno.env.get("SMTP_HOST") ?? "smtp.mail.me.com";
  const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? 587);
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "S@FE Digitalisation";

  if (!smtpUser || !smtpPassword) {
    return json({ error: "smtp_not_configured", kdrive: kdriveResponse }, 500);
  }

  const client = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      tls: smtpPort === 465,
      auth: { username: smtpUser, password: smtpPassword },
    },
  });

  try {
    await client.send({
      from: `${fromName} <${smtpUser}>`,
      to: payload.client_email,
      cc: smtpUser, // copie au compte S@FE pour traçabilité
      subject: payload.subject ?? `Votre bon de commande S@FE — ${payload.ref_unique}`,
      content: payload.body ?? "Veuillez trouver ci-joint votre bon de commande S@FE signé.",
      attachments: [
        {
          filename: payload.filename,
          content: pdfBytes,
          contentType: "application/pdf",
        },
      ],
    });
    await client.close();
  } catch (e) {
    try { await client.close(); } catch (_) {}
    console.error("smtp_send_failed", e);
    return json({ error: "smtp_send_failed", details: String(e), kdrive: kdriveResponse }, 502);
  }

  return json({
    ok: true,
    kdrive: kdriveResponse,
    sent_to: payload.client_email,
  });
});
