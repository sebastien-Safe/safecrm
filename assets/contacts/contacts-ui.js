// ==========================================================================
// S@FE CRM — Interface utilisateur du module Contacts
// Extrait de app.js
// ==========================================================================

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

function setContactFieldsLocked(locked) {
  const reallyLocked = locked && !isAdmin();
  CONTACT_FIELD_IDS.forEach(id => { $('#' + id).disabled = reallyLocked; });
  $all('.c-activite').forEach(cb => { cb.disabled = reallyLocked; });
  CONTACT_CONSENT_IDS.forEach(id => { $('#' + id).disabled = reallyLocked; });
  $('#contact-save-btn').style.display = reallyLocked ? 'none' : '';
  $('#c-rgpd-locked-msg').style.display = reallyLocked ? 'block' : 'none';
}

function canEditContact(contact) {
  if (!contact) return true;
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
  $('#c-source').readOnly = true;
  $('#c-notes').value = c?.notes || '';
  $('#c-consent-telephone').checked = !!c?.consent_telephone;
  $('#c-consent-email').checked = !!c?.consent_email;
  $('#c-consent-courrier').checked = !!c?.consent_courrier;
  $all('.c-activite').forEach(cb => cb.checked = (c?.activites || []).includes(cb.value));

  const editable = canEditContact(c);
  setContactFieldsLocked(!!c?.rgpd_ko || !editable);

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

  const canTransfer = c && editable && !c.rgpd_ko;
  const transferBtn = $('#contact-transfer-btn');
  if (transferBtn) transferBtn.style.display = canTransfer ? 'inline-flex' : 'none';

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
