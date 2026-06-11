// =========================================================
// S@FE CRM — Signature électronique modèle maison
// (canvas dessin + horodatage Paris + envoi via Edge
//  Function Supabase qui dépose sur kDrive et envoie le
//  mail au client avec le PDF en pièce jointe)
//
// Valeur juridique : signature électronique simple (art.
// 1367 C. civ. + art. 25 eIDAS). Pour les contrats à
// enjeu élevé, préférer un service eIDAS niveau substantiel
// (Yousign, DocuSign).
// =========================================================

window.ContractSign = (function () {

  let _signState = null;

  // ------- Initialisation du canvas -------
  function initCanvas() {
    const canvas = document.getElementById('sig-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0a1628';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let drawing = false, hasDrawn = false, lastX = 0, lastY = 0;

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const t = (e.touches && e.touches[0]) || e;
      return { x: (t.clientX - r.left) * (canvas.width / r.width),
               y: (t.clientY - r.top)  * (canvas.height / r.height) };
    }
    function start(e) { e.preventDefault(); drawing = true; const p = pos(e); lastX = p.x; lastY = p.y; }
    function move(e)  {
      if (!drawing) return; e.preventDefault();
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
      lastX = p.x; lastY = p.y; hasDrawn = true;
    }
    function end(e)   { drawing = false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move,  { passive: false });
    canvas.addEventListener('touchend', end);

    document.getElementById('sig-clear-btn').onclick = () => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
    };

    _signState = { canvas, ctx, get hasDrawn() { return hasDrawn; }, reset() { document.getElementById('sig-clear-btn').click(); } };
  }

  // ------- Ouverture de la modale signature -------
  function open(contract, contact, onClose) {
    if (!_signState) initCanvas();
    _signState.reset();
    const modal = document.getElementById('signature-modal');
    document.getElementById('sig-client-email').textContent = contact?.email || '—';
    document.getElementById('sig-client-email-input').value = contact?.email || '';
    document.getElementById('sig-client-name').value = contact?.nom || '';
    document.getElementById('sig-mention').value = '';
    document.getElementById('sig-error').style.display = 'none';
    document.getElementById('sig-status').style.display = 'none';
    document.getElementById('sig-timestamp').textContent = parisTimestamp();
    modal.classList.add('show');

    document.getElementById('sig-cancel-btn').onclick = () => modal.classList.remove('show');
    document.getElementById('sig-send-btn').onclick   = () => signAndSend(contract, contact, modal, onClose);

    // Refresh horodatage toutes les 30s tant que la modale est ouverte
    const t = setInterval(() => {
      if (!modal.classList.contains('show')) { clearInterval(t); return; }
      document.getElementById('sig-timestamp').textContent = parisTimestamp();
    }, 30000);
  }

  function parisTimestamp() {
    return new Date().toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }) + ' (Europe/Paris)';
  }

  // ------- Validation + envoi -------
  async function signAndSend(contract, contact, modal, onClose) {
    const err = document.getElementById('sig-error');
    const status = document.getElementById('sig-status');
    err.style.display = 'none';

    const clientName = document.getElementById('sig-client-name').value.trim();
    const clientEmail = document.getElementById('sig-client-email-input').value.trim();
    const mention = document.getElementById('sig-mention').value.trim();

    if (!clientName)  { err.textContent = "Indiquez le nom du signataire client."; err.style.display = 'block'; return; }
    if (!clientEmail || !/^.+@.+\..+$/.test(clientEmail)) { err.textContent = "E-mail destinataire invalide."; err.style.display = 'block'; return; }
    if (!/lu et approuv/i.test(mention)) { err.textContent = "La mention doit contenir « Lu et approuvé » suivi du nom."; err.style.display = 'block'; return; }
    if (!_signState.hasDrawn) { err.textContent = "Veuillez signer dans le cadre prévu."; err.style.display = 'block'; return; }

    const signedAt = new Date();
    const signatureDataUrl = _signState.canvas.toDataURL('image/png');

    // Régénération du PDF avec signature client
    if (!window.ContractPDF?.generateBlob) {
      // Si la version générique avec signature n'existe pas, on tombe sur le téléchargement classique
      window.ContractPDF.generate(contract, contact);
      err.textContent = "Le module PDF n'a pas pu intégrer la signature (recharger la page). PDF téléchargé sans signature.";
      err.style.display = 'block';
      return;
    }

    status.textContent = "Génération du PDF signé…";
    status.style.display = 'block';

    const { blob, filename, refUnique } = await window.ContractPDF.generateBlob(contract, contact, {
      signature: {
        client_name: clientName,
        mention: mention,
        signature_png: signatureDataUrl,
        signed_at_iso: signedAt.toISOString(),
        signed_at_paris: parisTimestamp(),
      },
    });

    // Conversion blob → base64 (sans le préfixe data:)
    const pdfBase64 = await blobToBase64(blob);

    status.textContent = "Envoi au client par e-mail et dépôt sur kDrive…";

    try {
      const { data, error } = await sb.functions.invoke('send-contract', {
        body: {
          pdf_base64: pdfBase64,
          filename: filename,
          ref_unique: refUnique,
          client_email: clientEmail,
          client_name: clientName,
          contract_id: contract.id,
          contact_id: contact?.id || null,
          subject: `Votre bon de commande S@FE — ${refUnique}`,
          body: bodyMail(clientName, contract, refUnique),
        },
      });
      if (error) throw error;
      status.textContent = `✅ Envoyé à ${clientEmail} — dépôt kDrive : ${data?.kdrive?.name || filename}`;

      // Mémorise l'envoi dans le contrat (table contracts si la colonne existe)
      try {
        await sb.from('contracts').update({
          sent_for_signature_at: signedAt.toISOString(),
          sent_for_signature_to: clientEmail,
          signed_pdf_kdrive_url: data?.kdrive?.url || null,
        }).eq('id', contract.id);
      } catch (e) { /* colonnes optionnelles — ignorer si absentes */ }

      setTimeout(() => { modal.classList.remove('show'); if (onClose) onClose(); }, 2500);

    } catch (e) {
      err.textContent = "Erreur d'envoi : " + (e.message || JSON.stringify(e));
      err.style.display = 'block';
      status.style.display = 'none';
      // Fallback : téléchargement local
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function bodyMail(clientName, contract, refUnique) {
    return `Bonjour ${clientName},

Veuillez trouver ci-joint votre bon de commande S@FE (référence ${refUnique}) pour la prestation ${contract.type || ''}${contract.formule ? ' — ' + contract.formule : ''}.

Ce document a été signé électroniquement le ${parisTimestamp()} dans notre CRM S@FE.

Pour toute question, vous pouvez répondre directement à cet e-mail ou nous joindre au 01 84 16 26 89.

Cordialement,
L'équipe S@FE Digitalisation
contact@safe-digitalisation.fr — safe-digitalisation.fr`;
  }

  return { open };
})();
