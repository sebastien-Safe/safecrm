/* ═══════════════ Formation DDA — Vue Programmes ═══════════════════════════ */

let _programmesCache = [];

async function loadProgrammes() {
  fillCollabSelect(document.getElementById('assign-collab'));
  document.getElementById('assign-annee').value = new Date().getFullYear();

  const el = document.getElementById('programmes-list');
  el.innerHTML = '<div class="empty-state">Chargement…</div>';

  const { data, error } = await sb.from('dda_programmes').select('id, nom, perimetre_cible, version, created_at').order('created_at');
  if (error) { el.innerHTML = '<div class="empty-state">Erreur de chargement.</div>'; console.error(error); return; }

  _programmesCache = data || [];

  el.innerHTML = '<table><thead><tr><th>Nom</th><th>Périmètre cible</th><th>Version</th></tr></thead><tbody>' +
    _programmesCache.map(p => '<tr><td>' + p.nom + '</td><td>' + (p.perimetre_cible?.join(', ') || '—') + '</td><td>' + p.version + '</td></tr>').join('') +
    '</tbody></table>';

  const progSelect = document.getElementById('assign-programme');
  progSelect.innerHTML = _programmesCache.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
  const dupSelect = document.getElementById('dup-source');
  dupSelect.innerHTML = _programmesCache.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-assign').addEventListener('submit', async (e) => {
    e.preventDefault();
    const collaborateur_id = document.getElementById('assign-collab').value;
    const programme_id = document.getElementById('assign-programme').value;
    const annee_civile = Number(document.getElementById('assign-annee').value);
    const heures_requises = Number(document.getElementById('assign-heures').value);

    // heures_realisees/statut volontairement absents : ne jamais écraser la progression
    // déjà enregistrée d'une obligation existante en cas de réassignation.
    const { error } = await sb.from('dda_obligations')
      .upsert({ collaborateur_id, programme_id, annee_civile, heures_requises },
        { onConflict: 'collaborateur_id,annee_civile', ignoreDuplicates: false });

    if (error) { alert('Erreur : ' + error.message); return; }
    alert('Programme assigné.');
    loadPerimetre();
  });

  document.getElementById('form-duplicate').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sourceId = document.getElementById('dup-source').value;
    const source = _programmesCache.find(p => p.id === sourceId);
    if (!source) return;

    const { data: full } = await sb.from('dda_programmes').select('contenu').eq('id', sourceId).single();
    const nom = document.getElementById('dup-nom').value.trim();
    const perimetre_cible = document.getElementById('dup-perimetre').value.split(',').map(s => s.trim()).filter(Boolean);

    const { error } = await sb.from('dda_programmes').insert({ nom, perimetre_cible, contenu: full.contenu });
    if (error) { alert('Erreur : ' + error.message); return; }
    alert('Programme dupliqué.');
    document.getElementById('form-duplicate').reset();
    loadProgrammes();
  });
});
