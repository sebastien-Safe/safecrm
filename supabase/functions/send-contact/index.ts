import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SMTPClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Gestion CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pdf_base64, filename, client_email, client_name, subject, body, ref_unique } = await req.json()

    console.log("=== DÉBUT DU DÉBOGAGE ===")

    // --- 1. LECTURE ET VÉRIFICATION DES VARIABLES ---
    const kdriveId = Deno.env.get('KDRIVE_ID')
    const kdriveFolderName = Deno.env.get('KDRIVE_FOLDER_NAME')
    const kdriveUser = Deno.env.get('KDRIVE_USER')
    const kdrivePass = Deno.env.get('KDRIVE_APP_PASSWORD') // Nom exact de la variable

    const smtpHost = Deno.env.get('SMTP_HOST') ?? 'smtp.ionos.fr'
    const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '465')
    const smtpUser = Deno.env.get('SMTP_USER') ?? 'contact@safe-digitalisation.fr'
    const smtpPass = Deno.env.get('SMTP_PASS') // Ou SMTP_PASSWORD selon votre config
    const fromName = Deno.env.get('SMTP_FROM_NAME') ?? 'S@FE Digitalisation'

    // Affichage sécurisé dans les logs (on masque les mots de passe)
    console.log("VARIABLES KDRIVE:", {
      id: kdriveId,
      folder: kdriveFolderName,
      user: kdriveUser,
      pass_set: !!kdrivePass // true si défini, false si vide
    })

    console.log("VARIABLES SMTP:", {
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      pass_set: !!smtpPass,
      from: fromName
    })

    // Vérification bloquante si variable manquante
    if (!kdrivePass) throw new Error("KDRIVE_APP_PASSWORD est manquant dans les variables Supabase.")
    if (!smtpPass) throw new Error("SMTP_PASS (ou SMTP_PASSWORD) est manquant dans les variables Supabase.")
    if (!kdriveFolderName) throw new Error("KDRIVE_FOLDER_NAME est manquant (mettez le NOM du dossier, pas l'ID).")

    // --- 2. PRÉPARATION DU FICHIER PDF ---
    const binaryString = atob(pdf_base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' })
    
    // Construction URL WebDAV
    const encodedFolder = encodeURIComponent(kdriveFolderName)
    const encodedFilename = encodeURIComponent(filename)
    const webdavUrl = `https://${kdriveId}.connect.kdrive.infomaniak.com/${encodedFolder}/${encodedFilename}`
    console.log("URL WebDAV cible:", webdavUrl)

    // --- 3. TEST UPLOAD KDRIVE (WebDAV) ---
    console.log("Tentative d'upload kDrive...")
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
    console.log("✅ Upload kDrive réussi!")

    // --- 4. TEST ENVOI SMTP (IONOS) ---
    console.log(`Tentative de connexion SMTP à ${smtpHost}:${smtpPort}...`)
    
    const client = new SMTPClient()
    try {
      // Connexion TLS (pour le port 465) ou STARTTLS (pour 587)
      // La librairie deno-smtp gère automatiquement le TLS si on utilise connectTLS
      await client.connectTLS({
        hostname: smtpHost,
        port: smtpPort,
        username: smtpUser,
        password: smtpPass,
      })
      console.log("✅ Connexion SMTP réussie!")

      // Envoi de l'email
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

    // --- 5. RÉPONSE SUCCÈS ---
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Contrat signé, déposé sur kDrive et envoyé par email.",
        kdrive: { url: webdavUrl },
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
        debug: "Vérifiez les logs Supabase pour le détail des variables."
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
