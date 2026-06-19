// ==========================================================================
// S@FE CRM — Interface utilisateur du module Contrats
// Extrait de app.js
// ==========================================================================

// ---------------------------------------------------------
// CONTRATS
// ---------------------------------------------------------
function getFilteredContracts() {
  const statut = $('#contracts-filter-statut').value;
  const recurrence = $('#contracts-filter-recurrence').value;
  return state.contracts.filter(ct => {
    if (statut && ct.statut !== statut) return false;
    if (recurrence && ct.recurrence !== recurrence) return false;
    return true;
  });
}

function renderContracts() {
  const list = getFilteredContracts();
  const tbody = $('#contracts-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">Aucun contrat ne correspond aux filtres.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(ct => {
    const montant = Number(ct.montant) || 0;
    const remise = Number(ct.remise) || 0;
    const net = Math.max(0, montant - remise);
    const montantCell = remise > 0
      ? `${formatMoney(net)}<br><span class="mut" style="font-size:.74rem">(remise -${formatMoney(remise)})</span>`
      : formatMoney(montant);
    return `
    <tr style="cursor:pointer" onclick="openContractModal('${ct.id}')">
      <td>${escapeHtml(contactName(ct.contact_id))}</td>
      <td>${escapeHtml(ct.type)}</td>
      <td>${escapeHtml(ct.formule || '—')}</td>
      <td>${montantCell}</td>
      <td>${escapeHtml(ct.recurrence)}</td>
      <td>${formatDate(ct.date_debut)}</td>
      <td class="${isOverdue(ct.date_echeance, ct.statut) ? 'overdue' : ''}">${formatDate(ct.date_echeance)}</td>
      <td><span class="badge ${CONTRACT_STATUT_BADGE[ct.statut] || 'badge-gray'}">${escapeHtml(ct.statut)}</span>${ct.resilié_at ? '<br><span style="font-size:.7rem;color:#fc8181;font-weight:600">🔔 Résiliation demandée</span>' : ''}</td>
      <td class="nowrap">${escapeHtml(creatorName(ct.created_by))}</td>
    </tr>`;
  }).join('');
}

function populateContactSelects() {
  const opts = state.contacts.map(c => `<option value="${c.id}">${escapeHtml(contactName(c.id))}</option>`).join('');
  $('#ct-contact').innerHTML = '<option value="">— Sélectionner un contact —</option>' + opts;
  $('#t-contact').innerHTML = '<option value="">— Aucun —</option>' + opts;
}

function populateContractSelects() {
  const opts = state.contracts.map(ct => `<option value="${ct.id}">${escapeHtml(contractLabel(ct))}</option>`).join('');
  $('#t-contract').innerHTML = '<option value="">— Aucun —</option>' + opts;
}

function openContractModal(id = null) {
  // Toujours rafraîchir les selects avant ouverture (les contacts peuvent
  // avoir été ajoutés/modifiés depuis le dernier rendu)
  populateContactSelects();

  const ct = id ? state.contracts.find(x => x.id === id) : null;
  $('#contract-modal-title').textContent = ct ? 'Modifier le contrat' : 'Nouveau contrat';
  $('#ct-id').value = ct?.id || '';
  $('#ct-contact').value = ct?.contact_id || '';
  $('#ct-type').value = ct?.type || '';
  updateContractTypeIcon({ value: ct?.type || '' });
  $('#ct-montant').value = ct?.montant ?? '';
  $('#ct-recurrence').value = ct?.recurrence || 'Ponctuel';
  const mepField = $('#ct-frais-mise-en-place');
  const engField = $('#ct-engagement-mois');
  if (mepField) mepField.value = ct?.frais_mise_en_place ?? '';
  if (engField) engField.value = ct?.engagement_mois ?? '';
  $('#ct-date-debut').value = ct?.date_debut || '';
  $('#ct-date-echeance').value = ct?.date_echeance || '';
  $('#ct-statut').value = ct?.statut || 'En attente de signature';
  const statutDisplay = $('#ct-statut-display');
  if (statutDisplay) statutDisplay.value = ct?.statut || 'En attente de signature';
  // Case Résilier visible uniquement pour les admins
  const resilierWrap = $('#ct-resilier-wrap');
  const resilierCheck = $('#ct-resilier');
  if (resilierWrap && resilierCheck) {
    const canResilier = isAdmin() && ct && ct.statut !== 'Résilié' && ct.statut !== 'Terminé';
    resilierWrap.style.display = canResilier ? '' : 'none';
    resilierCheck.checked = false;
  }
  $('#ct-notes').value = ct ? (ct.notes || '') : '';

  populateFormuleSelect(ct?.type || '', ct?.formule || null);

  const remise = Number(ct?.remise) || 0;
  $('#ct-remise-check').checked = remise > 0;
  $('#ct-remise').value = remise > 0 ? remise : '';
  $('#ct-remise').style.display = remise > 0 ? '' : 'none';
  updateNetDisplay();

  // Verrouillage si l'utilisateur n'est pas propriétaire du contrat
  const editable = !ct || isAdmin() || ct.created_by === state.user?.id;
  const fieldIds = ['ct-contact', 'ct-type', 'ct-formule-select', 'ct-formule-custom', 'ct-montant', 'ct-recurrence', 'ct-frais-mise-en-place', 'ct-engagement-mois', 'ct-date-debut', 'ct-date-echeance', 'ct-statut', 'ct-notes', 'ct-remise-check', 'ct-remise'];
  fieldIds.forEach(fid => { const el = $('#' + fid); if (el) el.disabled = !editable; });
  $('#contract-save-btn').style.display = editable ? '' : 'none';
  $('#contract-delete-btn').style.display = (ct && editable) ? 'inline-flex' : 'none';
  $('#contract-pdf-btn').style.display = ct ? 'inline-flex' : 'none';
  const sendBtn = $('#contract-send-btn');
  if (sendBtn) sendBtn.style.display = (ct && editable) ? 'inline-flex' : 'none';
  // Bouton Résilier : visible si abonnement mensuel actif avec stripe_subscription_id
  const resilierBtn = $('#contract-resilier-btn');
  if (resilierBtn) {
    const canResilier = ct
      && ct.recurrence === 'Mensuel'
      && ct.stripe_subscription_id
      && !ct.resilié_at
      && ct.statut !== 'Terminé'
      && (isAdmin() || ct.created_by === state.user?.id);
    resilierBtn.style.display = canResilier ? 'inline-flex' : 'none';
    resilierBtn.dataset.contractId = ct?.id || '';
  }
  // Bouton Portail client : visible si abonnement mensuel avec stripe_subscription_id
  const portalBtn = $('#contract-portal-btn');
  if (portalBtn) {
    const canPortal = ct
      && ct.recurrence === 'Mensuel'
      && ct.stripe_subscription_id
      && (isAdmin() || ct.created_by === state.user?.id);
    portalBtn.style.display = canPortal ? 'inline-flex' : 'none';
    portalBtn.dataset.contractId = ct?.id || '';
  }
  $('#contract-modal').classList.add('show');
}

function closeContractModal() {
  $('#contract-modal').classList.remove('show');
}
