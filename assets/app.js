// =========================================================
// S@FE CRM — Logique applicative
// =========================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  contacts: [],
  contracts: [],
  tasks: [],
  user: null,
};

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(dateStr, statut) {
  return dateStr && statut !== 'Terminé' && dateStr < todayISO();
}

const CONTACT_STATUT_BADGE = { 'Prospect': 'badge-blue', 'Client': 'badge-green', 'Inactif': 'badge-gray' };
const CONTRACT_STATUT_BADGE = {
  'Devis envoyé': 'badge-gray', 'Signé': 'badge-blue', 'En cours': 'badge-gold',
  'Terminé': 'badge-green', 'Résilié': 'badge-red'
};
const PRIORITY_BADGE = { 'Basse': 'badge-gray', 'Normale': 'badge-blue', 'Haute': 'badge-red' };
const ACTIVITE_BADGE = { 'Digitalisation': 'badge-blue', 'RGPD': 'badge-gold', 'Assurance': 'badge-green', 'Autre': 'badge-gray' };

function contactName(id) {
  const c = state.contacts.find(c => c.id === id);
  if (!c) return '—';
  return c.entreprise ? `${c.nom} (${c.entreprise})` : c.nom;
}

function contractLabel(ct) {
  return `${contactName(ct.contact_id)} — ${ct.type}${ct.formule ? ' / ' + ct.formule : ''}`;
}

// ---------------------------------------------------------
// AUTHENTIFICATION
// ---------------------------------------------------------
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    state.user = session.user;
    showApp();
  } else {
    showLogin();
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (session) {
      state.user = session.user;
      showApp();
    } else {
      state.user = null;
      showLogin();
    }
  });

  bindEvents();
}

function showLogin() {
  $('#login-screen').style.display = 'grid';
  $('#app').style.display = 'none';
}

async function showApp() {
  $('#login-screen').style.display = 'none';
  $('#app').style.display = 'flex';
  $('#user-email').textContent = state.user?.email || '';
  await loadAll();
}

async function login() {
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  $('#login-error').textContent = '';
  if (!email || !password) {
    $('#login-error').textContent = 'Merci de renseigner e-mail et mot de passe.';
    return;
  }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    $('#login-error').textContent = "Connexion impossible : " + error.message;
  }
}

async function logout() {
  await sb.auth.signOut();
}

// ---------------------------------------------------------
// CHARGEMENT DES DONNÉES
// ---------------------------------------------------------
async function loadAll() {
  await Promise.all([loadContacts(), loadContracts(), loadTasks()]);
  renderAll();
}

async function loadContacts() {
  const { data, error } = await sb.from('contacts').select('*').order('created_at', { ascending: false });
  if (error) return alert('Erreur chargement contacts : ' + error.message);
  state.contacts = data || [];
}

async function loadContracts() {
  const { data, error } = await sb.from('contracts').select('*').order('created_at', { ascending: false });
  if (error) return alert('Erreur chargement contrats : ' + error.message);
  state.contracts = data || [];
}

async function loadTasks() {
  const { data, error } = await sb.from('tasks').select('*').order('echeance', { ascending: true, nullsFirst: false });
  if (error) return alert('Erreur chargement tâches : ' + error.message);
  state.tasks = data || [];
}

function renderAll() {
  renderDashboard();
  renderContacts();
  renderContracts();
  renderTasks();
  populateContactSelects();
  populateContractSelects();
}

// ---------------------------------------------------------
// NAVIGATION
// ---------------------------------------------------------
function switchView(view) {
  $all('.navlink').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $all('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
}

// ---------------------------------------------------------
// TABLEAU DE BORD
// ---------------------------------------------------------
function renderDashboard() {
  $('#stat-contacts').textContent = state.contacts.length;
  $('#stat-clients').textContent = state.contacts.filter(c => c.statut === 'Client').length;
  $('#stat-contracts').textContent = state.contracts.filter(c => ['Signé', 'En cours'].includes(c.statut)).length;
  $('#stat-tasks-late').textContent = state.tasks.filter(t => isOverdue(t.echeance, t.statut)).length;

  // Tâches à venir / en retard
  const upcoming = state.tasks
    .filter(t => t.statut !== 'Terminé')
    .sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999'))
    .slice(0, 6);
  const upcomingEl = $('#upcoming-tasks-list');
  upcomingEl.innerHTML = upcoming.length ? upcoming.map(t => `
    <div class="mini-item">
      <div>
        <div class="t">${escapeHtml(t.titre)}</div>
        <div class="s">${t.contact_id ? escapeHtml(contactName(t.contact_id)) : ''}</div>
      </div>
      <span class="${isOverdue(t.echeance, t.statut) ? 'overdue' : 's'}">${formatDate(t.echeance)}</span>
    </div>`).join('') : '<p class="empty">Aucune tâche en attente 🎉</p>';

  // Derniers contacts
  const recent = state.contacts.slice(0, 5);
  const recentEl = $('#recent-contacts-list');
  recentEl.innerHTML = recent.length ? recent.map(c => `
    <div class="mini-item">
      <div>
        <div class="t">${escapeHtml(c.nom)}${c.entreprise ? ' — ' + escapeHtml(c.entreprise) : ''}</div>
        <div class="s">${(c.activites || []).join(', ') || '—'}</div>
      </div>
      <span class="badge ${CONTACT_STATUT_BADGE[c.statut] || 'badge-gray'}">${escapeHtml(c.statut)}</span>
    </div>`).join('') : '<p class="empty">Aucun contact pour le moment.</p>';
}

// ---------------------------------------------------------
// CONTACTS
// ---------------------------------------------------------
function getFilteredContacts() {
  const search = $('#contacts-search').value.trim().toLowerCase();
  const statut = $('#contacts-filter-statut').value;
  const activite = $('#contacts-filter-activite').value;
  return state.contacts.filter(c => {
    if (statut && c.statut !== statut) return false;
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
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Aucun contact ne correspond aux filtres.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${escapeHtml(c.nom)}</td>
      <td>${escapeHtml(c.entreprise || '—')}</td>
      <td><div class="tag-row">${(c.activites || []).map(a => `<span class="badge ${ACTIVITE_BADGE[a] || 'badge-gray'}">${escapeHtml(a)}</span>`).join('') || '—'}</div></td>
      <td><span class="badge ${CONTACT_STATUT_BADGE[c.statut] || 'badge-gray'}">${escapeHtml(c.statut)}</span></td>
      <td class="nowrap">${escapeHtml(c.telephone || '—')}</td>
      <td>${c.email ? `<a href="mailto:${escapeHtml(c.email)}" style="color:var(--accent)">${escapeHtml(c.email)}</a>` : '—'}</td>
      <td class="actions">
        <button class="btn btn-out btn-sm" data-edit-contact="${c.id}">Modifier</button>
      </td>
    </tr>`).join('');
}

function openContactModal(id = null) {
  const c = id ? state.contacts.find(x => x.id === id) : null;
  $('#contact-modal-title').textContent = c ? 'Modifier le contact' : 'Nouveau contact';
  $('#c-id').value = c?.id || '';
  $('#c-nom').value = c?.nom || '';
  $('#c-entreprise').value = c?.entreprise || '';
  $('#c-email').value = c?.email || '';
  $('#c-telephone').value = c?.telephone || '';
  $('#c-adresse').value = c?.adresse || '';
  $('#c-statut').value = c?.statut || 'Prospect';
  $('#c-source').value = c?.source || '';
  $('#c-notes').value = c?.notes || '';
  $all('.c-activite').forEach(cb => cb.checked = (c?.activites || []).includes(cb.value));
  $('#contact-delete-btn').style.display = c ? 'inline-flex' : 'none';
  $('#contact-modal').classList.add('show');
}

function closeContactModal() {
  $('#contact-modal').classList.remove('show');
}

async function saveContact() {
  const id = $('#c-id').value;
  const nom = $('#c-nom').value.trim();
  if (!nom) { alert('Le nom est obligatoire.'); return; }
  const payload = {
    nom,
    entreprise: $('#c-entreprise').value.trim() || null,
    email: $('#c-email').value.trim() || null,
    telephone: $('#c-telephone').value.trim() || null,
    adresse: $('#c-adresse').value.trim() || null,
    statut: $('#c-statut').value,
    source: $('#c-source').value.trim() || null,
    notes: $('#c-notes').value.trim() || null,
    activites: $all('.c-activite').filter(cb => cb.checked).map(cb => cb.value),
  };
  let error;
  if (id) {
    ({ error } = await sb.from('contacts').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('contacts').insert(payload));
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
  tbody.innerHTML = list.map(ct => `
    <tr>
      <td>${escapeHtml(contactName(ct.contact_id))}</td>
      <td>${escapeHtml(ct.type)}</td>
      <td>${escapeHtml(ct.formule || '—')}</td>
      <td>${formatMoney(ct.montant)}</td>
      <td>${escapeHtml(ct.recurrence)}</td>
      <td>${formatDate(ct.date_debut)}</td>
      <td class="${isOverdue(ct.date_echeance, ct.statut) ? 'overdue' : ''}">${formatDate(ct.date_echeance)}</td>
      <td><span class="badge ${CONTRACT_STATUT_BADGE[ct.statut] || 'badge-gray'}">${escapeHtml(ct.statut)}</span></td>
      <td class="actions">
        <button class="btn btn-out btn-sm" data-edit-contract="${ct.id}">Modifier</button>
      </td>
    </tr>`).join('');
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
  const ct = id ? state.contracts.find(x => x.id === id) : null;
  $('#contract-modal-title').textContent = ct ? 'Modifier le contrat' : 'Nouveau contrat';
  $('#ct-id').value = ct?.id || '';
  $('#ct-contact').value = ct?.contact_id || '';
  $('#ct-type').value = ct?.type || '';
  $('#ct-formule').value = ct?.formule || '';
  $('#ct-montant').value = ct?.montant ?? '';
  $('#ct-recurrence').value = ct?.recurrence || 'Ponctuel';
  $('#ct-date-debut').value = ct?.date_debut || '';
  $('#ct-date-echeance').value = ct?.date_echeance || '';
  $('#ct-statut').value = ct?.statut || 'Devis envoyé';
  $('#ct-notes').value = ct?.notes || '';
  $('#contract-delete-btn').style.display = ct ? 'inline-flex' : 'none';
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
  const payload = {
    contact_id,
    type,
    formule: $('#ct-formule').value.trim() || null,
    montant: montant === '' ? null : Number(montant),
    recurrence: $('#ct-recurrence').value,
    date_debut: $('#ct-date-debut').value || null,
    date_echeance: $('#ct-date-echeance').value || null,
    statut: $('#ct-statut').value,
    notes: $('#ct-notes').value.trim() || null,
  };
  let error;
  if (id) {
    ({ error } = await sb.from('contracts').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('contracts').insert(payload));
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

// ---------------------------------------------------------
// TÂCHES
// ---------------------------------------------------------
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
  return `
    <div class="kanban-card">
      <div class="title">${escapeHtml(t.titre)}</div>
      <div class="meta">
        <span class="${overdue ? 'overdue' : ''}">📅 ${formatDate(t.echeance)}</span>
        <span class="badge ${PRIORITY_BADGE[t.priorite] || 'badge-gray'}">${escapeHtml(t.priorite)}</span>
      </div>
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
  $('#kanban-todo').innerHTML = cols['À faire'].length ? cols['À faire'].map(taskCardHtml).join('') : '<p class="empty">Aucune tâche.</p>';
  $('#kanban-inprogress').innerHTML = cols['En cours'].length ? cols['En cours'].map(taskCardHtml).join('') : '<p class="empty">Aucune tâche.</p>';
  $('#kanban-done').innerHTML = cols['Terminé'].length ? cols['Terminé'].map(taskCardHtml).join('') : '<p class="empty">Aucune tâche.</p>';
}

function openTaskModal(id = null) {
  const t = id ? state.tasks.find(x => x.id === id) : null;
  $('#task-modal-title').textContent = t ? 'Modifier la tâche' : 'Nouvelle tâche';
  $('#t-id').value = t?.id || '';
  $('#t-titre').value = t?.titre || '';
  $('#t-description').value = t?.description || '';
  $('#t-contact').value = t?.contact_id || '';
  $('#t-contract').value = t?.contract_id || '';
  $('#t-echeance').value = t?.echeance || '';
  $('#t-priorite').value = t?.priorite || 'Normale';
  $('#t-statut').value = t?.statut || 'À faire';
  $('#t-assigne').value = t?.assigne_a || '';
  $('#task-delete-btn').style.display = t ? 'inline-flex' : 'none';
  $('#task-modal').classList.add('show');
}

function closeTaskModal() {
  $('#task-modal').classList.remove('show');
}

async function saveTask() {
  const id = $('#t-id').value;
  const titre = $('#t-titre').value.trim();
  if (!titre) { alert('Le titre est obligatoire.'); return; }
  const payload = {
    titre,
    description: $('#t-description').value.trim() || null,
    contact_id: $('#t-contact').value || null,
    contract_id: $('#t-contract').value || null,
    echeance: $('#t-echeance').value || null,
    priorite: $('#t-priorite').value,
    statut: $('#t-statut').value,
    assigne_a: $('#t-assigne').value.trim() || null,
  };
  let error;
  if (id) {
    ({ error } = await sb.from('tasks').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('tasks').insert(payload));
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
  const { error } = await sb.from('tasks').update({ statut }).eq('id', id);
  if (error) return alert('Erreur : ' + error.message);
  await loadAll();
}

// ---------------------------------------------------------
// ÉVÉNEMENTS
// ---------------------------------------------------------
function bindEvents() {
  // Login / logout
  $('#login-btn').addEventListener('click', login);
  $all('#login-email, #login-password').forEach(el => {});
  $('#login-password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('#login-email').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('#logout-btn').addEventListener('click', logout);

  // Navigation
  $all('.navlink').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));

  // Filtres
  ['contacts-search', 'contacts-filter-statut', 'contacts-filter-activite'].forEach(id => {
    $('#' + id).addEventListener('input', renderContacts);
  });
  ['contracts-filter-statut', 'contracts-filter-recurrence'].forEach(id => {
    $('#' + id).addEventListener('input', renderContracts);
  });
  $('#tasks-filter-assigne').addEventListener('input', renderTasks);

  // Nouveaux éléments
  $('#btn-new-contact').addEventListener('click', () => openContactModal());
  $('#btn-new-contract').addEventListener('click', () => openContractModal());
  $('#btn-new-task').addEventListener('click', () => openTaskModal());

  // Modale Contact
  $('#contact-cancel-btn').addEventListener('click', closeContactModal);
  $('#contact-save-btn').addEventListener('click', saveContact);
  $('#contact-delete-btn').addEventListener('click', deleteContact);

  // Modale Contrat
  $('#contract-cancel-btn').addEventListener('click', closeContractModal);
  $('#contract-save-btn').addEventListener('click', saveContract);
  $('#contract-delete-btn').addEventListener('click', deleteContract);

  // Modale Tâche
  $('#task-cancel-btn').addEventListener('click', closeTaskModal);
  $('#task-save-btn').addEventListener('click', saveTask);
  $('#task-delete-btn').addEventListener('click', deleteTask);

  // Délégation : boutons d'édition / actions rapides dans les tableaux & kanban
  document.addEventListener('click', e => {
    const editContact = e.target.closest('[data-edit-contact]');
    if (editContact) return openContactModal(editContact.dataset.editContact);

    const editContract = e.target.closest('[data-edit-contract]');
    if (editContract) return openContractModal(editContract.dataset.editContract);

    const editTask = e.target.closest('[data-edit-task]');
    if (editTask) return openTaskModal(editTask.dataset.editTask);

    const taskStatus = e.target.closest('[data-task-status]');
    if (taskStatus) {
      const [id, statut] = taskStatus.dataset.taskStatus.split('|');
      return quickSetTaskStatus(id, statut);
    }
  });

  // Fermeture des modales en cliquant en dehors
  $all('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $all('.modal.show').forEach(m => m.classList.remove('show'));
  });
}

init();
