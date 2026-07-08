/* ═══════════════ Formation DDA — Mon historique ═══════════════════════════ */

async function loadHistorique() {
  const panel = document.getElementById('panel-historique');
  panel.innerHTML = '<div class="empty-state">Chargement…</div>';

  const { data, error } = await sb
    .from('dda_sessions')
    .select('id, entite_formatrice, type_formation, modalite, date_debut, date_fin, duree_heures, duree_effective_heures, score_qcm, attestation_path, dda_obligations(annee_civile)')
    .order('date_debut', { ascending: false });

  if (error) {
    panel.innerHTML = '<div class="empty-state">Erreur de chargement de l\'historique.</div>';
    console.error('loadHistorique', error);
    return;
  }

  if (!data || !data.length) {
    panel.innerHTML = '<div class="empty-state"><h2>Aucune session enregistrée</h2><p>Votre historique de formation continue apparaîtra ici au fil de vos sessions.</p></div>';
    return;
  }

  let html = '<h2>Mon historique de formation continue</h2>' +
    '<table class="hist-table"><thead><tr>' +
    '<th>Année</th><th>Modalité</th><th>Type</th><th>Dates</th><th>Durée</th><th>Score QCM</th><th>Attestation</th>' +
    '</tr></thead><tbody>';

  data.forEach(s => {
    const termine = s.duree_effective_heures !== null;
    const duree = termine
      ? Number(s.duree_effective_heures).toFixed(2) + 'h'
      : (s.duree_heures ? Number(s.duree_heures).toFixed(2) + 'h (en cours)' : '—');
    const dates = s.date_debut + (s.date_fin && s.date_fin !== s.date_debut ? ' → ' + s.date_fin : '');
    html += '<tr>' +
      '<td>' + (s.dda_obligations?.annee_civile ?? '—') + '</td>' +
      '<td>' + s.modalite + '</td>' +
      '<td>' + s.type_formation + '</td>' +
      '<td>' + dates + '</td>' +
      '<td>' + duree + '</td>' +
      '<td>' + (s.score_qcm !== null && s.score_qcm !== undefined ? s.score_qcm + '%' : '—') + '</td>' +
      '<td>' + (s.attestation_path ? '<a href="#" data-path="' + s.attestation_path + '" class="dl-attestation">Télécharger</a>' : 'En attente de génération') + '</td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  panel.innerHTML = html;

  panel.querySelectorAll('.dl-attestation').forEach(a => {
    a.onclick = async (e) => {
      e.preventDefault();
      const path = a.dataset.path;
      const { data: signed, error: signErr } = await sb.storage.from('formation-docs').createSignedUrl(path, 60);
      if (signErr) { alert('Impossible de générer le lien de téléchargement.'); console.error(signErr); return; }
      window.open(signed.signedUrl, '_blank');
    };
  });
}
