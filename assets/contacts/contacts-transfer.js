// ==========================================================================
// S@FE CRM — Transfert de contacts
// Extrait de app.js
// ==========================================================================

function openTransferModal() {
  const id = $('#c-id').value;
  if (!id) return;
  const c = state.contacts.find(x => x.id === id);
  if (!c) return;
  if (!canEditContact(c)) {
    alert("Vous ne pouvez transférer que les clients dont vous êtes propriétaire.");
    return;
  }
  const candidates = Object.values(state.profilesById || {})
    .filter(u => u.id !== c.created_by)
    .sort((a, b) => (a.prenom || '').localeCompare(b.prenom || ''));
  if (!candidates.length) {
    alert("Aucun autre utilisateur disponible pour le transfert.");
    return;
  }
  const sel = $('#transfer-target');
  sel.innerHTML = candidates.map(u =>
    `<option value="${u.id}">${escapeHtml(u.prenom || u.email || u.id.slice(0, 8))}${u.is_admin ? ' (admin)' : ''}</option>`
  ).join('');
  $('#transfer-error').style.display = 'none';
  state._transferContactId = id;
  $('#transfer-modal').classList.add('show');
}

async function confirmTransferContact() {
  const contactId    = state._transferContactId;
  const targetUserId = $('#transfer-target').value;
  if (!contactId || !targetUserId) return;
  const c      = state.contacts.find(x => x.id === contactId);
  const target = state.profilesById?.[targetUserId];
  if (!confirm(
    `Transférer définitivement le client « ${c?.nom || ''} » à ${target?.prenom || target?.email || 'cet utilisateur'} ?\n\n` +
    `Tous les contrats et tâches liés à ce client seront également réassignés.`
  )) return;
  const { error } = await sb.rpc('transfer_contact', {
    p_contact_id: contactId,
    p_target_user_id: targetUserId,
  });
  if (error) {
    $('#transfer-error').textContent = "Erreur : " + (error.message || JSON.stringify(error));
    $('#transfer-error').style.display = 'block';
    return;
  }
  $('#transfer-modal').classList.remove('show');
  closeContactModal();
  await loadAll();
}
