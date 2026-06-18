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

function populateFormuleSelect(type, currentFormule) {
  const sel = $('#ct-formule-select');
  const customInput = $('#ct-formule-custom');
  const presets = FORMULE_PRESETS[type] || [];

  let opts = presets.map(f => {
    const unit = f.recurrence === 'Mensuel' ? '/mois' : (f.recurrence === 'Annuel' ? '/an' : ' (forfait)');
    const setup = f.setup ? ` + ${f.setup} € mise en place` : '';
    return `<option value="${escapeHtml(f.label)}">${escapeHtml(f.label)} — ${f.montant} € HT${unit}${setup}</option>`;
  }).join('');
  opts += `<option value="${FORMULE_CUSTOM}">Personnalisé / Sur devis</option>`;
  sel.innerHTML = opts;

  const match = presets.find(f => f.label === currentFormule);
  if (match) {
    sel.value = match.label;
    customInput.style.display = 'none';
    customInput.value = '';
  } else {
    sel.value = FORMULE_CUSTOM;
    customInput.style.display = '';
    customInput.value = currentFormule || '';
  }
}

function onFormuleChange(applyPreset = true) {
  const sel = $('#ct-formule-select');
  const type = $('#ct-type').value.trim();
  const customInput = $('#ct-formule-custom');

  if (sel.value === FORMULE_CUSTOM) {
    customInput.style.display = '';
    updateNetDisplay();
    return;
  }
  customInput.style.display = 'none';
  customInput.value = '';

  if (!applyPreset) { updateNetDisplay(); return; }

  const preset = (FORMULE_PRESETS[type] || []).find(f => f.label === sel.value);
  if (preset) {
    $('#ct-montant').value = preset.montant;
    $('#ct-recurrence').value = preset.recurrence;
    const mepEl = $('#ct-frais-mise-en-place');
    const engEl = $('#ct-engagement-mois');
    if (mepEl) mepEl.value = preset.setup || 0;
    if (engEl) engEl.value = preset.engagement || 0;
    const note = $('#ct-notes');
    const extraNotes = [];
    if (preset.setup) {
      extraNotes.push(`Frais de mise en place : ${preset.setup} € HT (facturés au 1er mois, non remboursables).`);
    }
    if (preset.engagement) {
      extraNotes.push(`Engagement minimum : ${preset.engagement} mois.`);
    }
    extraNotes.forEach(n => {
      const key = n.split(' :')[0];
      if (!note.value.includes(key)) {
        note.value = note.value ? note.value + '\n' + n : n;
      }
    });
  }
  updateNetDisplay();
  autoCalcEcheance();
}

function updateNetDisplay() {
  const montant = Number($('#ct-montant').value) || 0;
  const remiseActive = $('#ct-remise-check').checked;
  const remise = remiseActive ? (Number($('#ct-remise').value) || 0) : 0;
  const net = Math.max(0, montant - remise);
$('#ct-net-wrap').style.display = (remiseActive && remise > 0) ? '' : 'none';
  $('#ct-net-display').value = formatMoney(net);
}

function autoCalcEcheance() {
  const type = $('#ct-type').value.trim();
  const formuleSel = $('#ct-formule-select').value;
  const preset = (FORMULE_PRESETS[type] || []).find(f => f.label === formuleSel);
  const dateDebut = $('#ct-date-debut').value;
  if (!preset || !dateDebut) return;
  const d = new Date(dateDebut + 'T00:00:00');
  if (preset.engagement) {
    d.setMonth(d.getMonth() + preset.engagement);
  } else if (preset.deliveryDays) {
    d.setDate(d.getDate() + preset.deliveryDays);
  } else {
    return;
  }
  $('#ct-date-echeance').value = d.toISOString().slice(0, 10);
}

function onContractTypeChange() {
  populateFormuleSelect($('#ct-type').value.trim(), null);
  onFormuleChange(true);
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
  $('#ct-notes').value = ct ? (ct.notes || '') : ''; // Vide pour nouveau contrat

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
    // Stocker le payload pour l'utiliser après confirmation
    window._pendingResilierContractId = id;
    window._pendingResilierPayload    = payload;
    document.getElementById('resilier-contract-id').value = id;
    document.getElementById('resilier-modal').classList.add('show');
    return; // Ne pas sauvegarder tant que pas confirmé
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

