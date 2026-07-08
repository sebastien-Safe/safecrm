/* ═══════════════ Formation DDA — Vue Documents (PDF + export ACPR) ════════ */

let _docsContext = null; // { collaborateur_id, annee_civile, obligation, sessions }

function loadDocumentsForm() {
  fillCollabSelect(document.getElementById('doc-collab'));
  document.getElementById('doc-annee').value = new Date().getFullYear();
  document.getElementById('doc-collab').onchange = refreshDocumentsContext;
  document.getElementById('doc-annee').onchange = refreshDocumentsContext;
  refreshDocumentsContext();
}

async function refreshDocumentsContext() {
  const collaborateur_id = document.getElementById('doc-collab').value;
  const annee_civile = Number(document.getElementById('doc-annee').value);
  const statusEl = document.getElementById('documents-status');
  const listEl = document.getElementById('documents-sessions');
  statusEl.textContent = 'Chargement…';

  const { data: obligation } = await sb
    .from('dda_obligations')
    .select('id, heures_requises, heures_realisees, statut, profiles(prenom, nom), dda_programmes(nom)')
    .eq('collaborateur_id', collaborateur_id).eq('annee_civile', annee_civile)
    .maybeSingle();

  if (!obligation) {
    statusEl.textContent = 'Aucune obligation pour ce collaborateur sur cette année.';
    listEl.innerHTML = '';
    _docsContext = null;
    return;
  }

  const { data: sessions } = await sb
    .from('dda_sessions')
    .select('id, entite_formatrice, modalite, type_formation, date_debut, date_fin, duree_heures, duree_effective_heures, themes, score_qcm, attestation_path')
    .eq('obligation_id', obligation.id)
    .order('date_debut');

  _docsContext = { collaborateur_id, annee_civile, obligation, sessions: sessions || [] };

  statusEl.textContent = Number(obligation.heures_realisees).toFixed(1) + 'h / ' + obligation.heures_requises + 'h — statut ' + obligation.statut;
  listEl.innerHTML = '<table><thead><tr><th>Entité</th><th>Dates</th><th>Durée réelle</th><th>Attestation</th></tr></thead><tbody>' +
    _docsContext.sessions.map(s => '<tr><td>' + s.entite_formatrice + '</td><td>' + s.date_debut + ' → ' + s.date_fin + '</td>' +
      '<td>' + (s.duree_effective_heures !== null ? Number(s.duree_effective_heures).toFixed(2) + 'h' : 'en cours') + '</td>' +
      '<td>' + (s.attestation_path ? '✅' : '—') + '</td></tr>').join('') +
    '</tbody></table>';
}

function nomCollaborateur() {
  const p = _docsContext.obligation.profiles;
  return (p?.prenom || '') + ' ' + (p?.nom || '');
}

function genererAttestationPDF(session) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 22;

  doc.setFillColor(3, 13, 38);
  doc.rect(0, 0, W, 297, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(201, 162, 75);
  doc.text('S@FE Assurances', M, 26);
  doc.setFontSize(10); doc.setTextColor(124, 151, 196);
  doc.text('Attestation de formation continue DDA', M, 33);
  doc.setDrawColor(201, 162, 75); doc.setLineWidth(0.4);
  doc.line(M, 38, W - M, 38);

  let y = 52;
  doc.setFontSize(9); doc.setTextColor(230, 230, 230); doc.setFont('helvetica', 'normal');
  const champs = [
    ['Collaborateur', nomCollaborateur()],
    ['Entité formatrice', session.entite_formatrice],
    ['Type de formation', session.type_formation],
    ['Modalité', session.modalite],
    ['Période', session.date_debut + ' au ' + session.date_fin],
    ['Durée effective', Number(session.duree_effective_heures || 0).toFixed(2) + ' heures'],
    ['Thèmes couverts (arrêté 26/09/2018)', (session.themes || []).join(', ') || 'non renseigné'],
    ['Score QCM', session.score_qcm !== null && session.score_qcm !== undefined ? session.score_qcm + '%' : 'N/A'],
  ];
  champs.forEach(([label, val]) => {
    doc.setTextColor(201, 162, 75); doc.setFont('helvetica', 'bold');
    doc.text(label, M, y); y += 5;
    doc.setTextColor(230, 230, 230); doc.setFont('helvetica', 'normal');
    doc.splitTextToSize(String(val), W - 2 * M).forEach(l => { doc.text(l, M, y); y += 5; });
    y += 3;
  });

  y += 6;
  doc.setDrawColor(201, 162, 75, 0.3); doc.line(M, y, W - M, y); y += 8;
  doc.setFontSize(8); doc.setTextColor(124, 151, 196);
  doc.text('Délivrée en application de l\'article A.512-8 du Code des assurances (obligation de formation continue de 15h/an).', M, y, { maxWidth: W - 2 * M });
  y += 10;
  doc.text('S@FE SASU — Formateur : Sébastien Alonso, Président et DPO, IAS Niveau 1.', M, y);

  return doc.output('blob');
}

function genererRecapPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 22;
  const o = _docsContext.obligation;

  doc.setFillColor(3, 13, 38); doc.rect(0, 0, W, 297, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(201, 162, 75);
  doc.text('S@FE Assurances', M, 26);
  doc.setFontSize(10); doc.setTextColor(124, 151, 196);
  doc.text('Récapitulatif annuel de formation continue DDA — ' + _docsContext.annee_civile, M, 33);
  doc.line(M, 38, W - M, 38);

  let y = 52;
  doc.setFontSize(9); doc.setTextColor(230, 230, 230);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(201, 162, 75);
  doc.text('Collaborateur : ', M, y); doc.setTextColor(230, 230, 230); doc.setFont('helvetica', 'normal');
  doc.text(nomCollaborateur(), M + 32, y); y += 6;
  doc.setFont('helvetica', 'bold'); doc.setTextColor(201, 162, 75);
  doc.text('Programme : ', M, y); doc.setTextColor(230, 230, 230); doc.setFont('helvetica', 'normal');
  doc.text(o.dda_programmes?.nom || '—', M + 32, y); y += 6;
  doc.setFont('helvetica', 'bold'); doc.setTextColor(201, 162, 75);
  doc.text('Heures : ', M, y); doc.setTextColor(230, 230, 230); doc.setFont('helvetica', 'normal');
  doc.text(Number(o.heures_realisees).toFixed(2) + ' / ' + o.heures_requises + 'h — statut ' + o.statut, M + 32, y); y += 10;

  doc.setDrawColor(201, 162, 75, 0.3); doc.line(M, y, W - M, y); y += 8;
  doc.setFont('helvetica', 'bold'); doc.setTextColor(201, 162, 75); doc.setFontSize(10);
  doc.text('Sessions', M, y); y += 7;
  doc.setFontSize(8);
  _docsContext.sessions.forEach(s => {
    if (y > 270) { doc.addPage(); doc.setFillColor(3, 13, 38); doc.rect(0, 0, W, 297, 'F'); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setTextColor(201, 162, 75);
    doc.text(s.entite_formatrice, M, y); y += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(230, 230, 230);
    doc.text(s.date_debut + ' au ' + s.date_fin + ' — ' + s.modalite + ' — ' +
      (s.duree_effective_heures !== null ? Number(s.duree_effective_heures).toFixed(2) + 'h' : 'en cours'), M, y);
    y += 7;
  });

  return doc;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-recap').addEventListener('click', () => {
    if (!_docsContext) { alert('Sélectionnez un collaborateur/année.'); return; }
    const doc = genererRecapPDF();
    doc.save('recapitulatif-dda-' + nomCollaborateur().replace(/\s+/g, '_') + '-' + _docsContext.annee_civile + '.pdf');
  });

  document.getElementById('btn-attestations').addEventListener('click', async () => {
    if (!_docsContext) { alert('Sélectionnez un collaborateur/année.'); return; }
    const statusEl = document.getElementById('documents-status');
    const aTraiter = _docsContext.sessions.filter(s => s.duree_effective_heures !== null && !s.attestation_path);
    if (!aTraiter.length) { alert('Aucune attestation manquante.'); return; }

    let done = 0;
    for (const session of aTraiter) {
      statusEl.textContent = 'Génération attestation ' + (++done) + '/' + aTraiter.length + '…';
      const blob = genererAttestationPDF(session);
      const path = _docsContext.collaborateur_id + '/attestations/' + session.id + '.pdf';
      const { error: upErr } = await sb.storage.from('formation-docs').upload(path, blob, { contentType: 'application/pdf', upsert: true });
      if (upErr) { alert('Erreur upload : ' + upErr.message); return; }
      await sb.from('dda_sessions').update({ attestation_path: path }).eq('id', session.id);
    }
    statusEl.textContent = done + ' attestation(s) générée(s).';
    refreshDocumentsContext();
  });

  document.getElementById('btn-export-zip').addEventListener('click', async () => {
    if (!_docsContext) { alert('Sélectionnez un collaborateur/année.'); return; }
    const statusEl = document.getElementById('documents-status');
    statusEl.textContent = 'Préparation de l\'export…';

    const zip = new JSZip();
    const recapDoc = genererRecapPDF();
    zip.file('recapitulatif-annuel.pdf', recapDoc.output('blob'));

    for (const session of _docsContext.sessions) {
      if (!session.attestation_path) continue;
      const { data, error } = await sb.storage.from('formation-docs').download(session.attestation_path);
      if (error) { console.error('download attestation', error); continue; }
      zip.file('attestations/' + session.id + '.pdf', data);
    }

    zip.file('donnees.json', JSON.stringify(_docsContext, null, 2));

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dossier-acpr-' + nomCollaborateur().replace(/\s+/g, '_') + '-' + _docsContext.annee_civile + '.zip';
    a.click();
    URL.revokeObjectURL(url);
    statusEl.textContent = 'Export terminé.';
  });
});
