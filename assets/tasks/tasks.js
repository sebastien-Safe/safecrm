// ==========================================================================
// S@FE CRM — Module Tâches
// Extrait de assets/app.js
// Dépendances globales : sb, state, $, $all, escapeHtml, formatDate,
//   isOverdue, loadAll, populateContactSelects, populateContractSelects
// ==========================================================================

const PRIORITY_BADGE   = { 'Basse': 'badge-gray', 'Normale': 'badge-blue', 'Haute': 'badge-red' };
const TASK_TYPE_BADGE  = { 'Premier contact': 'badge-blue', 'RDV visio': 'badge-gold', 'RDV terrain': 'badge-green', 'Autre': 'badge-gray' };

function getFilteredTasks() {
  const assigne = $('#tasks-filter-assigne').value.trim().toLowerCase();
  return state.tasks.filter(t => {
    if (assigne && !(t.assigne_a || '').toLowerCase().includes(assigne)) return false;
    return true;
  });
}

function taskCardHtml(t) {
  const overdue = isOverdue(t.echeance, t.statut);
  let nextBtn = '';
  if (t.statut === 'À faire') nextBtn = `<button class="btn btn-out btn-sm" data-task-status="${t.id}|En cours">→ En cours</button>`;
  if (t.statut === 'En cours') nextBtn = `<button class="btn btn-out btn-sm" data-task-status="${t.id}|Terminé">→ Terminé</button>`;
  if (t.statut === 'Terminé') nextBtn = `<button class="btn btn-out btn-sm" data-task-status="${t.id}|À faire">↺ Réouvrir</button>`;
  const isRdv = t.type_tache === 'RDV visio' || t.type_tache === 'RDV terrain';
  const mapsUrl = t.type_tache === 'RDV terrain' && t.rdv_lieu
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(t.rdv_lieu)}&travelmode=driving`
    : null;
  const rdvLine = isRdv && (t.rdv_date || t.rdv_heure || t.rdv_lieu)
    ? `<div class="meta" style="margin-top:6px"><span>📍 ${formatDate(t.rdv_date)}${t.rdv_heure ? ' à ' + t.rdv_heure.slice(0,5) : ''}${t.rdv_lieu ? ' — ' + escapeHtml(t.rdv_lieu) : ''}</span>${mapsUrl ? ` <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-out btn-sm" style="padding:2px 8px;font-size:.72rem;margin-left:6px" title="Itinéraire Google Maps">🗺️</a>` : ''}</div>`
    : '';
  return `
    <div class="kanban-card">
      ${t.type_tache ? `<span class="badge ${TASK_TYPE_BADGE[t.type_tache] || 'badge-gray'}" style="margin-bottom:6px;display:inline-block">${escapeHtml(t.type_tache)}</span>` : ''}
      <div class="title">${escapeHtml(t.titre)}</div>
      <div class="meta">
        <span class="${overdue ? 'overdue' : ''}">📅 ${formatDate(t.echeance)}</span>
        <span class="badge ${PRIORITY_BADGE[t.priorite] || 'badge-gray'}">${escapeHtml(t.priorite)}</span>
      </div>
      ${rdvLine}
      ${t.contact_id ? `<div class="meta" style="margin-top:6px"><span>👤 ${escapeHtml(contactName(t.contact_id))}</span></div>` : ''}
      ${t.assigne_a ? `<div class="meta" style="margin-top:4px"><span>🧑‍💼 ${escapeHtml(t.assigne_a)}</span></div>` : ''}
      <div class="actions">
        ${nextBtn}
        <button class="btn btn-out btn-sm" data-edit-task="${t.id}">Modifier</button>
      </div>
    </div>`;
}

function renderTasks() {
  const list = getFilteredTasks();
  const cols = { 'À faire': [], 'En cours': [], 'Terminé': [] };
  list.forEach(t => { (cols[t.statut] || cols['À faire']).push(t); });
  $('#kanban-todo').innerHTML      = cols['À faire'].length  ? cols['À faire'].map(taskCardHtml).join('')  : '<p class="empty">Aucune tâche.</p>';
  $('#kanban-inprogress').innerHTML = cols['En cours'].length ? cols['En cours'].map(taskCardHtml).join('') : '<p class="empty">Aucune tâche.</p>';
  $('#kanban-done').innerHTML      = cols['Terminé'].length  ? cols['Terminé'].map(taskCardHtml).join('')  : '<p class="empty">Aucune tâche.</p>';
}

function onTaskTypeChange() {
  const type = $('#t-type').value;
  const isRdv = type === 'RDV visio' || type === 'RDV terrain';
  $('#t-rdv-fields').style.display = isRdv ? 'block' : 'none';
  $('#t-echeance-row').style.gridTemplateColumns = isRdv ? '1fr' : '1fr 1fr';
  $('#t-echeance-field').style.display = isRdv ? 'none' : '';
  $('#t-rdv-lieu-label').textContent = type === 'RDV terrain' ? 'Lieu du RDV' : 'Lieu / Lien visio';
  $('#t-rdv-lieu').placeholder = type === 'RDV terrain'
    ? 'Ex : adresse du rendez-vous'
    : 'Ex : lien Google Meet, Teams, Zoom…';
}

function openTaskModal(id = null, defaults = {}) {
  populateContactSelects();
  populateContractSelects();

  const t = id ? state.tasks.find(x => x.id === id) : null;
  $('#task-modal-title').textContent = t ? 'Modifier la tâche' : 'Nouveau RDV / Tâche';
  $('#t-id').value          = t?.id           || '';
  $('#t-type').value        = t?.type_tache   || defaults.type_tache   || 'Premier contact';
  $('#t-titre').value       = t?.titre        || defaults.titre        || '';
  $('#t-description').value = t?.description  || defaults.description  || '';
  $('#t-contact').value     = t?.contact_id   || defaults.contact_id   || '';
  $('#t-contract').value    = t?.contract_id  || defaults.contract_id  || '';
  $('#t-rdv-date').value    = t?.rdv_date     || defaults.rdv_date     || '';
  $('#t-rdv-heure').value   = t?.rdv_heure    ? t.rdv_heure.slice(0, 5) : (defaults.rdv_heure || '');
  $('#t-rdv-lieu').value    = t?.rdv_lieu     || defaults.rdv_lieu     || '';
  $('#t-echeance').value    = t?.echeance     || defaults.echeance     || '';
  $('#t-priorite').value    = t?.priorite     || defaults.priorite     || 'Normale';
  $('#t-statut').value      = t?.statut       || defaults.statut       || 'À faire';

  const assigneSelect = $('#t-assigne');
  const userOpts = Object.values(state.profilesById || {})
    .sort((a, b) => (a.prenom || '').localeCompare(b.prenom || ''))
    .map(u => `<option value="${escapeHtml(u.prenom || u.id)}">${escapeHtml(u.prenom || '—')}</option>`).join('');
  assigneSelect.innerHTML = '<option value="">— Non assigné —</option>' + userOpts;
  assigneSelect.value = t?.assigne_a || '';

  onTaskTypeChange();
  $('#task-delete-btn').style.display = t ? 'inline-flex' : 'none';
  $('#task-modal').classList.add('show');
}

function closeTaskModal() {
  $('#task-modal').classList.remove('show');
}

function _findRdvConflict(rdv_date, rdv_heure, excludeId) {
  if (!rdv_date || !rdv_heure) return null;
  const heure = rdv_heure.slice(0, 5);
  return (state.tasks || []).find(t => {
    if (excludeId && t.id === excludeId) return false;
    if (t.rdv_date !== rdv_date) return false;
    if (!t.rdv_heure) return false;
    if (t.type_tache !== 'RDV visio' && t.type_tache !== 'RDV terrain') return false;
    return t.rdv_heure.slice(0, 5) === heure;
  }) || null;
}

async function saveTask() {
  const id    = $('#t-id').value;
  const titre = $('#t-titre').value.trim();
  if (!titre) { alert('Le titre est obligatoire.'); return; }
  const statut     = $('#t-statut').value;
  const type_tache = $('#t-type').value;
  const isRdv      = type_tache === 'RDV visio' || type_tache === 'RDV terrain';
  const rdv_date   = isRdv ? ($('#t-rdv-date').value || null) : null;
  const rdv_heure  = isRdv ? ($('#t-rdv-heure').value || null) : null;

  // Vérification de conflit de créneau horaire
  const conflictAlert = document.getElementById('task-conflict-alert');
  if (conflictAlert) conflictAlert.className = 'task-conflict-alert'; // reset
  if (isRdv && rdv_date && rdv_heure) {
    const conflict = _findRdvConflict(rdv_date, rdv_heure, id || null);
    if (conflict) {
      if (conflictAlert) {
        const dayLabel = new Date(rdv_date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const contact  = conflict.contact_id ? (state.contacts || []).find(c => c.id === conflict.contact_id) : null;
        const who      = contact ? ` (${escapeHtml(contact.nom)}${contact.entreprise ? ' — ' + escapeHtml(contact.entreprise) : ''})` : '';
        conflictAlert.className = 'task-conflict-alert visible';
        conflictAlert.innerHTML = `⚠️ <strong>Créneau déjà occupé</strong> — "${escapeHtml(conflict.titre)}"${who} est déjà planifié à ${rdv_heure.slice(0,5)} le ${dayLabel}.<br>
          <span style="font-size:.78rem">Modifiez la date ou l'heure ci-dessus pour résoudre le conflit.</span>`;
        document.getElementById('t-rdv-date')?.focus();
      }
      return;
    }
  }

  const payload = {
    type_tache,
    titre,
    description: $('#t-description').value.trim() || null,
    contact_id:  $('#t-contact').value  || null,
    contract_id: $('#t-contract').value || null,
    rdv_date,
    rdv_heure,
    rdv_lieu:    isRdv ? ($('#t-rdv-lieu').value.trim() || null) : null,
    echeance:    isRdv ? rdv_date : ($('#t-echeance').value || null),
    priorite:    $('#t-priorite').value,
    statut,
    assigne_a:   $('#t-assigne').value.trim() || null,
  };
  const existing = id ? state.tasks.find(x => x.id === id) : null;
  if (statut === 'Terminé') {
    if (!existing || existing.statut !== 'Terminé') payload.termine_at = new Date().toISOString();
  } else {
    payload.termine_at = null;
  }
  let error;
  if (id) {
    ({ error } = await sb.from('tasks').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('tasks').insert({ ...payload, created_by: state.user.id }));
  }
  if (error) return alert('Erreur : ' + error.message);
  closeTaskModal();
  await loadAll();
}

async function deleteTask() {
  const id = $('#t-id').value;
  if (!id) return;
  if (!confirm('Supprimer cette tâche ?')) return;
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) return alert('Erreur : ' + error.message);
  closeTaskModal();
  await loadAll();
}

async function quickSetTaskStatus(id, statut) {
  const payload = { statut, termine_at: statut === 'Terminé' ? new Date().toISOString() : null };
  const { error } = await sb.from('tasks').update(payload).eq('id', id);
  if (error) return alert('Erreur : ' + error.message);
  await loadAll();
}
