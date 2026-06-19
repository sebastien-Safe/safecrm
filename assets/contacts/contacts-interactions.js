// ==========================================================================
// S@FE CRM — Interactions du module Contacts
// Extrait de app.js
// ==========================================================================

function renderInteractions(contactId) {
  const section = document.getElementById('contact-suivi-section');
  if (!section) return;
  section.style.display = '';
  const items = (state.interactions || []).filter(i => i.contact_id === contactId);
  const list  = document.getElementById('interactions-list');
  if (!items.length) {
    list.innerHTML = '<p class="mut" style="font-size:.85rem">Aucun échange enregistré.</p>';
    return;
  }
  const typeClass = { 'Téléphone':'tel','Email':'email','Visite':'visite','LinkedIn':'linkedin','Facebook':'facebook','Autre':'autre' };
  const typeIcon  = {
    'Téléphone': '📞',
    'Email':     '✉️',
    'Visite':    '🤝',
    'LinkedIn':  '<img src="https://www.google.com/s2/favicons?sz=16&domain=linkedin.com" alt="LinkedIn">',
    'Facebook':  '<img src="https://www.google.com/s2/favicons?sz=16&domain=facebook.com" alt="Facebook">',
    'Autre':     '💬'
  };
  list.innerHTML = items.map(i => {
    const cls  = typeClass[i.type] || 'autre';
    const icon = typeIcon[i.type]  || '💬';
    const suite = i.suite_a_donner
      ? `<div class="interaction-suite">➡️ ${escapeHtml(i.suite_a_donner)}</div>`
      : '';
    return `<div class="interaction-item" onclick="openInteractionModal('${i.contact_id}','${i.id}')">
        <div class="interaction-header">
          <span class="interaction-type ${cls}">${icon} ${escapeHtml(i.type)}</span>
          <span class="interaction-objet">${escapeHtml(i.objet)}</span>
          <span class="interaction-date">${formatDate(i.date)}</span>
        </div>${suite}</div>`;
  }).join('');
}

function openInteractionModal(contactId, interactionId) {
  const inter = interactionId ? (state.interactions || []).find(i => i.id === interactionId) : null;
  document.getElementById('interaction-modal-title').textContent = inter ? "Modifier l'échange" : 'Nouvel échange';
  document.getElementById('int-id').value          = inter ? inter.id : '';
  document.getElementById('int-contact-id').value  = contactId;
  document.getElementById('int-type').value        = inter ? inter.type : 'Téléphone';
  document.getElementById('int-date').value        = inter ? inter.date : new Date().toISOString().slice(0,10);
  document.getElementById('int-objet').value       = inter ? inter.objet : '';
  document.getElementById('int-contenu').value     = inter ? (inter.contenu || '') : '';
  document.getElementById('int-suite').value       = inter ? (inter.suite_a_donner || '') : '';
  document.getElementById('int-delete-btn').style.display = inter ? 'inline-flex' : 'none';
  document.getElementById('interaction-modal').classList.add('show');
}

function closeInteractionModal() {
  document.getElementById('interaction-modal').classList.remove('show');
}

async function saveInteraction() {
  const id        = document.getElementById('int-id').value;
  const contactId = document.getElementById('int-contact-id').value;
  const type      = document.getElementById('int-type').value;
  const date      = document.getElementById('int-date').value;
  const objet     = document.getElementById('int-objet').value.trim();
  if (!objet) { alert("L'objet est obligatoire."); return; }
  const payload = {
    contact_id: contactId, created_by: state.user.id,
    type, date, objet,
    contenu:        document.getElementById('int-contenu').value.trim() || null,
    suite_a_donner: document.getElementById('int-suite').value.trim()   || null,
  };
  let error;
  if (id) {
    ({ error } = await sb.from('interactions').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('interactions').insert(payload));
  }
  if (error) { alert('Erreur : ' + error.message); return; }
  await loadInteractions();
  await loadContacts();
  renderInteractions(contactId);
  closeInteractionModal();
}

async function deleteInteraction() {
  const id        = document.getElementById('int-id').value;
  const contactId = document.getElementById('int-contact-id').value;
  if (!id || !confirm('Supprimer cet échange ?')) return;
  const { error } = await sb.from('interactions').delete().eq('id', id);
  if (error) { alert('Erreur : ' + error.message); return; }
  await loadInteractions();
  renderInteractions(contactId);
  closeInteractionModal();
}

function openAddInteraction(contactId) {
  const modal = document.getElementById('add-interaction-modal') || document.getElementById('interaction-modal');
  if (modal) {
    if (document.getElementById('interaction-contact-id'))
      document.getElementById('interaction-contact-id').value = contactId;
    modal.classList.add('show');
  }
}
