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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// COMMENTEZ L'IMPORT SMTP POUR LE TEST
// import { SMTPClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("=== DÉBUT DU DÉBOGAGE ===") // Ce log DOIT apparaître

    const { pdf_base64, filename, client_email, client_name, subject, body, ref_unique } = await req.json()
    
    // ... (Gardez tout le code de vérification des variables et d'upload kDrive) ...
    // ... (Commentez toute la partie SMTP pour l'instant) ...

    // Simulez une réussite pour tester
    return new Response(JSON.stringify({ success: true, message: "Test réussi (SMTP désactivé)" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    });

  } catch (error) {
    console.error("=== ERREUR GLOBALE ===", error)
    return new Response(JSON.stringify({ error: error.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 
    })
  }
})


    // --- 1. LECTURE ET VÉRIFICATION DES VARIABLES ---
    const kdriveId = Deno.env.get('KDRIVE_ID')
    const kdriveFolderName = Deno.env.get('KDRIVE_FOLDER_NAME')
    const kdriveUser = Deno.env.get('KDRIVE_USER')
    const kdrivePass = Deno.env.get('KDRIVE_APP_PASSWORD')

    // Gestion flexible du nom de variable mot de passe SMTP
    let smtpPass = Deno.env.get('SMTP_PASS')
    if (!smtpPass) smtpPass = Deno.env.get('SMTP_PASSWORD')

    const smtpHost = Deno.env.get('SMTP_HOST') ?? 'smtp.ionos.fr'
    let smtpPort = Number(Deno.env.get('SMTP_PORT'))
    if (!smtpPort || smtpPort === 0) smtpPort = 465 
    
    const smtpUser = Deno.env.get('SMTP_USER') ?? 'contact@safe-digitalisation.fr'
    const fromName = Deno.env.get('SMTP_FROM_NAME') ?? 'S@FE Digitalisation'

    // --- VÉRIFICATION CRITIQUE DU DOSSIER ---
    const DOSSIER_ATTENDU = "Clients";
    
    console.log("VARIABLES KDRIVE:", {
      id: kdriveId,
      folder_recu: kdriveFolderName,
      folder_attendu: DOSSIER_ATTENDU,
      user: kdriveUser,
      pass_set: !!kdrivePass
    })

    if (!kdrivePass) throw new Error("KDRIVE_APP_PASSWORD est manquant.")
    if (!smtpPass) throw new Error("SMTP_PASS (ou SMTP_PASSWORD) est manquant.")
    if (!kdriveFolderName) throw new Error("KDRIVE_FOLDER_NAME est manquant.")
    
    // Vérifie que le dossier configuré est bien 'Clients'
    if (kdriveFolderName !== DOSSIER_ATTENDU) {
      throw new Error(`ERREUR DE CONFIGURATION : Le dossier configuré est "${kdriveFolderName}" mais doit être impérativement "${DOSSIER_ATTENDU}". Vérifiez la variable KDRIVE_FOLDER_NAME dans Supabase.`)
    }

    if (!filename) throw new Error("Le nom du fichier (filename) est manquant dans la requête.")

    // --- 2. PRÉPARATION DU FICHIER PDF ---
    const binaryString = atob(pdf_base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' })
    
    // Construction URL WebDAV vers le dossier 'Clients'
    const encodedFolder = encodeURIComponent(kdriveFolderName)
    const encodedFilename = encodeURIComponent(filename)
    const webdavUrl = `https://${kdriveId}.connect.kdrive.infomaniak.com/${encodedFolder}/${encodedFilename}`
    
    console.log("📂 Destination finale:", webdavUrl)

    // --- 3. TEST UPLOAD KDRIVE (WebDAV) ---
    console.log("Tentative d'upload kDrive dans le dossier 'Clients'...")
    const credentials = btoa(`${kdriveUser}:${kdrivePass}`)
    
    const uploadResponse = await fetch(webdavUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBlob.size)
      },
      body: pdfBlob
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error("ÉCHEC KDRIVE:", uploadResponse.status, errorText)
      throw new Error(`Échec kDrive (${uploadResponse.status}): ${errorText}`)
    }
    console.log("✅ Upload kDrive réussi dans le dossier 'Clients' !")

    // --- 4. TEST ENVOI SMTP (IONOS) ---
    console.log(`Tentative de connexion SMTP à ${smtpHost}:${smtpPort}...`)
    
    const client = new SMTPClient()
    try {
      await client.connectTLS({
        hostname: smtpHost,
        port: smtpPort,
        username: smtpUser,
        password: smtpPass,
      })
      console.log("✅ Connexion SMTP réussie!")

      await client.send({
        from: `${fromName} <${smtpUser}>`,
        to: client_email,
        subject: subject || `Votre bon de commande S@FE — ${ref_unique}`,
        content: body || `Bonjour ${client_name}, veuillez trouver ci-joint votre document.`,
        attachments: [
          {
            filename: filename,
            content: bytes,
          },
        ],
      })
      console.log("✅ Email envoyé avec succès!")
      
    } catch (smtpError) {
      console.error("ÉCHEC SMTP DÉTAILLÉ:", smtpError)
      throw new Error(`Échec SMTP: ${smtpError.message}`)
    } finally {
      await client.close()
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Contrat signé, déposé dans le dossier 'Clients' sur kDrive et envoyé par email.",
        kdrive: { url: webdavUrl, folder: DOSSIER_ATTENDU },
        email: { sent_to: client_email }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error("=== ERREUR GLOBALE ===", error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        debug: "Vérifiez les logs Supabase."
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
