
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

