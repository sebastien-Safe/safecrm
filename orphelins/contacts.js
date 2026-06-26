
// ---------------------------------------------------------
// CONTACTS
// ---------------------------------------------------------
function getFilteredContacts() {
  const search = $('#contacts-search').value.trim().toLowerCase();
  const activite = $('#contacts-filter-activite').value;
  return state.contacts.filter(c => {
    if (activite && !(c.activites || []).includes(activite)) return false;
    if (search) {
      const hay = [c.nom, c.entreprise, c.email, c.telephone].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function renderContacts() {
  const list = getFilteredContacts();
  const tbody = $('#contacts-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Aucun contact ne correspond aux filtres.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => {
    const editable = canEditContact(c);
    const label = c.rgpd_ko ? 'Voir' : (editable ? 'Modifier' : 'Voir');
    const lockBadge = (!editable && !c.rgpd_ko) ? ' <span class="badge badge-gray">🔒</span>' : '';
    return `<tr class="${c.rgpd_ko ? 'row-rgpd-ko' : ''}" style="cursor:pointer" onclick="openContactModal('${c.id}')">
      <td>${escapeHtml(c.nom)}${lockBadge}</td>
      <td>${escapeHtml(c.entreprise || '—')}</td>
      <td><div class="tag-row">${(c.activites || []).map(a => `<span class="badge ${ACTIVITE_BADGE[a] || 'badge-gray'}">${escapeHtml(a)}</span>`).join('') || '—'}</div></td>
      <td class="nowrap">${escapeHtml(c.telephone || '—')}</td>
      <td>${c.email ? `<a href="mailto:${escapeHtml(c.email)}" rel="noopener noreferrer" style="color:var(--accent)">${escapeHtml(c.email)}</a>` : '—'}</td>
      <td class="nowrap">${escapeHtml(creatorName(c.created_by))}</td>
    </tr>`;
  }).join('');
}

const CONTACT_FIELD_IDS = ['c-nom', 'c-entreprise', 'c-email', 'c-telephone', 'c-adresse', 'c-code-postal-ville', 'c-forme-juridique', 'c-siret', 'c-notes']; // c-source toujours readonly
const CONTACT_CONSENT_IDS = ['c-consent-telephone', 'c-consent-email', 'c-consent-courrier'];

function setContactFieldsLocked(locked) {
  // Un super-administrateur n'est jamais verrouillé.
  const reallyLocked = locked && !isAdmin();
  CONTACT_FIELD_IDS.forEach(id => { $('#' + id).disabled = reallyLocked; });
  $all('.c-activite').forEach(cb => { cb.disabled = reallyLocked; });
  CONTACT_CONSENT_IDS.forEach(id => { $('#' + id).disabled = reallyLocked; });
  $('#contact-save-btn').style.display = reallyLocked ? 'none' : '';
  $('#c-rgpd-locked-msg').style.display = reallyLocked ? 'block' : 'none';
}

// Détermine si l'utilisateur courant peut modifier ce contact
function canEditContact(contact) {
  if (!contact) return true; // nouveau contact (création)
  if (isAdmin()) return true;
  return contact.created_by === state.user?.id;
}

function openContactModal(id = null) {
  const c = id ? state.contacts.find(x => x.id === id) : null;
  $('#contact-modal-title').textContent = c ? 'Modifier le contact' : 'Nouveau contact';
  $('#c-id').value = c?.id || '';
  $('#c-nom').value = c?.nom || '';
  $('#c-entreprise').value = c?.entreprise || '';
  $('#c-email').value = c?.email || '';
  if ($('#c-prenom')) $('#c-prenom').value = c?.prenom || '';
  if ($('#c-linkedin')) $('#c-linkedin').value = c?.linkedin || '';
  $('#c-telephone').value = c?.telephone || '';
  $('#c-adresse').value = c?.adresse || '';
  // Split code_postal_ville en deux champs
  const cpv = c?.code_postal_ville || '';
  const cpMatch = cpv.match(/^(\d{5})\s*(.*)$/);
  $('#c-code-postal').value = cpMatch ? cpMatch[1] : '';
  const villeSelect = $('#c-ville');
  if (cpMatch && cpMatch[2]) {
    villeSelect.innerHTML = `<option value="${escapeHtml(cpMatch[2])}">${escapeHtml(cpMatch[2])}</option>`;
    villeSelect.value = cpMatch[2];
  } else {
    villeSelect.innerHTML = '<option value="">Saisissez un code postal</option>';
  }
  $('#c-forme-juridique').value = c?.forme_juridique || '';
  $('#c-siret').value = c?.siret || '';
  $('#c-source').value = c?.source || state.profile?.prenom || '';
  $('#c-source').readOnly = true; // toujours automatique
  $('#c-notes').value = c?.notes || '';
  // rgpd_ko géré automatiquement (plus de case à cocher manuelle)
  $('#c-consent-telephone').checked = !!c?.consent_telephone;
  $('#c-consent-email').checked = !!c?.consent_email;
  $('#c-consent-courrier').checked = !!c?.consent_courrier;
  $all('.c-activite').forEach(cb => cb.checked = (c?.activites || []).includes(cb.value));

  // Verrouillage : RGPD KO OU pas le propriétaire
  const editable = canEditContact(c);
  setContactFieldsLocked(!!c?.rgpd_ko || !editable);

  // Bandeau "fiche d'un collègue"
  if (c && !editable && !c.rgpd_ko) {
    const owner = state.profilesById?.[c.created_by];
    const ownerEl = $('#c-owner-name');
    if (ownerEl) ownerEl.textContent = owner?.prenom || owner?.email || '—';
    const readonlyEl = $('#c-readonly-msg');
    if (readonlyEl) readonlyEl.style.display = 'block';
    $('#contact-save-btn').style.display = 'none';
    $('#contact-delete-btn').style.display = 'none';
  } else {
    const readonlyEl = $('#c-readonly-msg');
    if (readonlyEl) readonlyEl.style.display = 'none';
    $('#contact-save-btn').style.display = '';
    $('#contact-delete-btn').style.display = (c && editable) ? 'inline-flex' : 'none';
  }

  // Bouton transfert : propriétaire ou admin uniquement, et fiche existante non RGPD KO
  const canTransfer = c && editable && !c.rgpd_ko;
  const transferBtn = $('#contact-transfer-btn');
  if (transferBtn) transferBtn.style.display = canTransfer ? 'inline-flex' : 'none';

  // Afficher le suivi client si fiche existante
  if (id) {
    renderInteractions(id);
  } else {
    const section = document.getElementById('contact-suivi-section');
    if (section) section.style.display = 'none';
  }

  $('#contact-modal').classList.add('show');
}

function closeContactModal() {
  $('#contact-modal').classList.remove('show');
}

async function saveContact() {
  const id = $('#c-id').value;
  const existing = id ? state.contacts.find(x => x.id === id) : null;
  const nom      = $('#c-nom').value.trim();
  const linkedin = ($('#c-linkedin')?.value || '').trim() || null;
  const prenom   = ($('#c-prenom')?.value || '').trim() || null;
  if (!nom) { alert('Le nom est obligatoire.'); return; }
  const rgpdKoChecked = false; // géré automatiquement par check_rgpd_expiry()
  const payload = {
    nom,
    prenom: prenom || null,
    linkedin: linkedin || null,
    entreprise: $('#c-entreprise').value.trim() || null,
    email: $('#c-email').value.trim() || null,
    telephone: $('#c-telephone').value.trim() || null,
    adresse: $('#c-adresse').value.trim() || null,
    code_postal_ville: $('#c-code-postal-ville').value.trim() || null,
    forme_juridique: $('#c-forme-juridique').value.trim() || null,
    siret: $('#c-siret').value.trim() || null,
    statut: existing?.statut || 'Client',
    source: $('#c-source').value.trim() || state.profile?.prenom || null,
    notes: $('#c-notes').value.trim() || null,
    activites: $all('.c-activite').filter(cb => cb.checked).map(cb => cb.value),
    rgpd_ko: rgpdKoChecked,
    consent_telephone: $('#c-consent-telephone').checked,
    consent_email: $('#c-consent-email').checked,
    consent_courrier: $('#c-consent-courrier').checked,
  };
  // Basculement RGPD KO géré automatiquement par check_rgpd_expiry()
  if (false) {
  }
  // Tout nouveau contact est automatiquement "Client"
  if (!existing) {
    payload.devenu_client_at = new Date().toISOString();
  }
  let error;
  if (id) {
    ({ error } = await sb.from('contacts').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('contacts').insert({ ...payload, created_by: state.user.id }));
  }
  if (error) return alert('Erreur : ' + error.message);
  closeContactModal();
  await loadAll();
}

async function deleteContact() {
  const id = $('#c-id').value;
  if (!id) return;
  if (!confirm('Supprimer ce contact ? Les contrats et tâches associés seront aussi détachés ou supprimés.')) return;
  const { error } = await sb.from('contacts').delete().eq('id', id);
  if (error) return alert('Erreur : ' + error.message);
  closeContactModal();
  await loadAll();
}
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

