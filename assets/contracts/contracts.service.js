// ==========================================================================
// S@FE CRM — Service Contrats (accès Supabase)
// Extrait de app.js
// ==========================================================================

async function loadContracts() {
  const { data, error } = await sb.from('contracts').select('*, stripe_subscription_id, resilié_at').order('created_at', { ascending: false });
  if (error) return alert('Erreur chargement contrats : ' + error.message);
  state.contracts = data || [];
}

async function saveContract() {
  const id = $('#ct-id').value;
  const contact_id = $('#ct-contact').value;
  const type = $('#ct-type').value.trim();
  if (!contact_id || !type) { alert('Le contact et le type de prestation sont obligatoires.'); return; }
  const montant = $('#ct-montant').value;
  const formuleSel = $('#ct-formule-select').value;
  const formule = formuleSel === FORMULE_CUSTOM
    ? ($('#ct-formule-custom').value.trim() || null)
    : formuleSel;
  const remise = $('#ct-remise-check').checked ? (Number($('#ct-remise').value) || 0) : 0;
  const fraisMep = $('#ct-frais-mise-en-place')?.value;
  const engagement = $('#ct-engagement-mois')?.value;
  const payload = {
    contact_id,
    type,
    formule,
    montant: montant === '' ? null : Number(montant),
    remise,
    recurrence: $('#ct-recurrence').value,
    date_debut: $('#ct-date-debut').value || null,
    date_echeance: $('#ct-date-echeance').value || null,
    statut: $('#ct-statut').value || 'En attente de signature',
    notes: $('#ct-notes').value.trim() || null,
  };
  // Colonnes ajoutées en v13 — on ne les envoie que si elles existent dans le HTML ET en base
  if (fraisMep !== undefined) payload.frais_mise_en_place = fraisMep === '' ? null : Number(fraisMep);
  if (engagement !== undefined) payload.engagement_mois = engagement === '' ? null : Number(engagement);
  // Si la case Résilier est cochée → afficher confirmation AVANT de sauvegarder
  if ($('#ct-resilier')?.checked && id) {
    window._pendingResilierContractId = id;
    window._pendingResilierPayload    = payload;
    document.getElementById('resilier-contract-id').value = id;
    document.getElementById('resilier-modal').classList.add('show');
    return;
  }

  let error;
  if (id) {
    ({ error } = await sb.from('contracts').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('contracts').insert({ ...payload, created_by: state.user.id }));
  }
  if (error) return alert('Erreur : ' + error.message);

  closeContractModal();
  await loadAll();
}

async function deleteContract() {
  const id = $('#ct-id').value;
  if (!id) return;
  if (!confirm('Supprimer ce contrat ?')) return;
  const { error } = await sb.from('contracts').delete().eq('id', id);
  if (error) return alert('Erreur : ' + error.message);
  closeContractModal();
  await loadAll();
}
