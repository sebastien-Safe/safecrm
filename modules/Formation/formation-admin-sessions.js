/* ═══════════════ Formation DDA — Vue Sessions (saisie externe/pair) ═══════ */

function loadSessionsForm() {
  fillCollabSelect(document.getElementById('sess-collab'));
  document.getElementById('sess-annee').value = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-session').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const collaborateur_id = document.getElementById('sess-collab').value;
      const annee_civile = Number(document.getElementById('sess-annee').value);

      const { data: obligation, error: obligationErr } = await sb
        .from('dda_obligations').select('id')
        .eq('collaborateur_id', collaborateur_id).eq('annee_civile', annee_civile)
        .maybeSingle();

      if (obligationErr || !obligation) {
        alert('Aucune obligation trouvée pour ce collaborateur sur cette année — assignez d\'abord un programme (onglet Programmes).');
        return;
      }

      const duree = Number(document.getElementById('sess-duree').value);
      const themes = document.getElementById('sess-themes').value.split(',').map(s => s.trim()).filter(Boolean);
      const fichier = document.getElementById('sess-fichier').files[0];

      let attestation_path = null;
      if (fichier) {
        const path = collaborateur_id + '/justificatifs/' + Date.now() + '_' + fichier.name;
        const { error: uploadErr } = await sb.storage.from('formation-docs').upload(path, fichier, { contentType: 'application/pdf' });
        if (uploadErr) { alert('Erreur upload justificatif : ' + uploadErr.message); return; }
        attestation_path = path;
      }

      const { error } = await sb.from('dda_sessions').insert({
        obligation_id: obligation.id,
        entite_formatrice: document.getElementById('sess-entite').value,
        formateur_nom: document.getElementById('sess-formateur-nom').value || null,
        formateur_qualification: document.getElementById('sess-formateur-qualif').value || null,
        type_formation: document.getElementById('sess-type').value,
        modalite: document.getElementById('sess-modalite').value,
        date_debut: document.getElementById('sess-date-debut').value,
        date_fin: document.getElementById('sess-date-fin').value,
        duree_heures: duree,
        duree_effective_heures: duree, // session déjà réalisée, saisie a posteriori
        themes,
        attestation_path,
      });

      if (error) { alert('Erreur : ' + error.message); return; }
      alert('Session enregistrée.');
      document.getElementById('form-session').reset();
      loadSessionsForm();
    } finally {
      submitBtn.disabled = false;
    }
  });
});
