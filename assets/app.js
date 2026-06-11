// =========================================================
// S@FE CRM — Logique applicative
// =========================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  contacts: [],
  contracts: [],
  tasks: [],
  profile: null,
  profilesById: {},
  objectifs: [],
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

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  return dateStr.slice(0, 7) === monthKey();
}

function gaugeColor(pct) {
  if (pct < 50) return 'var(--alert)';
  if (pct < 75) return 'var(--gold)';
  return 'var(--ok)';
}

function gaugeSvg(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const color = gaugeColor(pct);
  return `<svg viewBox="0 0 100 100" class="gauge-svg">
    <circle cx="50" cy="50" r="${r}" class="gauge-track"></circle>
    <circle cx="50" cy="50" r="${r}" class="gauge-fill" style="stroke:${color};stroke-dasharray:${c.toFixed(2)};stroke-dashoffset:${offset.toFixed(2)}"></circle>
    <text x="50" y="50" class="gauge-text" style="fill:${color}">${Math.round(pct)}%</text>
  </svg>`;
}

const CONTACT_STATUT_BADGE = { 'Prospect': 'badge-blue', 'Client': 'badge-green', 'Inactif': 'badge-gray' };
const CONTRACT_STATUT_BADGE = {
  'Devis envoyé': 'badge-gray', 'Signé': 'badge-blue', 'En cours': 'badge-gold',
  'Terminé': 'badge-green', 'Résilié': 'badge-red'
};
const PRIORITY_BADGE = { 'Basse': 'badge-gray', 'Normale': 'badge-blue', 'Haute': 'badge-red' };
const ACTIVITE_BADGE = { 'Digitalisation': 'badge-blue', 'RGPD': 'badge-gold', 'Assurance': 'badge-green', 'Autre': 'badge-gray' };

// ---------------------------------------------------------
// GRILLE TARIFAIRE (issue de safe-digitalisation.fr)
// Formules pré-remplies par type de prestation : montant HT,
// récurrence, frais de mise en place et engagement minimum
// (ajoutés automatiquement en note). Les types non listés ici
// (Audit RGPD, Gestion Fiche Google Business, Courtage Assurance,
// Autre) n'ont pas de tarif catalogue publié : la formule reste
// "Personnalisé / Sur devis" avec saisie libre.
// ---------------------------------------------------------
const FORMULE_PRESETS = {
  'Référencement Local': [
    { label: 'Essentiel', montant: 79,  recurrence: 'Mensuel', setup: 150, engagement: 6 },
    { label: 'Boost',     montant: 149, recurrence: 'Mensuel', setup: 250, engagement: 6 },
    { label: 'Prestige',  montant: 249, recurrence: 'Mensuel', setup: 0,   engagement: 3 },
  ],
  'Click & Collect': [
    { label: 'Essentiel', montant: 39,  recurrence: 'Mensuel', setup: 150, engagement: 6 },
    { label: 'Pro',       montant: 79,  recurrence: 'Mensuel', setup: 250, engagement: 6 },
    { label: 'Premium',   montant: 129, recurrence: 'Mensuel', setup: 0,   engagement: 3 },
  ],
  'Mise en conformité RGPD': [
    { label: 'Diagnostic (offert)',          montant: 0,    recurrence: 'Ponctuel', setup: 0, engagement: 0 },
    { label: 'Mise en conformité (forfait)', montant: 1490, recurrence: 'Ponctuel', setup: 0, engagement: 0 },
  ],
  'DPO externalisé': [
    { label: 'Abonnement DPO', montant: 149, recurrence: 'Mensuel', setup: 0, engagement: 12 },
  ],
  'Cybersécurité': [
    { label: 'Audit de vulnérabilité',  montant: 490,  recurrence: 'Ponctuel', setup: 0, engagement: 0 },
    { label: 'Pack Sécurité Essentiel', montant: 990,  recurrence: 'Ponctuel', setup: 0, engagement: 0 },
    { label: 'Pack Résilience Pro',     montant: 1990, recurrence: 'Ponctuel', setup: 0, engagement: 0 },
  ],
};
const FORMULE_CUSTOM = '__custom__';

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
    if (event === 'PASSWORD_RECOVERY') {
      showResetScreen();
      return;
    }
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
  $('#reset-screen').style.display = 'none';
  $('#app').style.display = 'none';
  showLoginPanel();
}

function showResetScreen() {
  $('#login-screen').style.display = 'none';
  $('#app').style.display = 'none';
  $('#reset-error').textContent = '';
  $('#reset-password').value = '';
  $('#reset-password-2').value = '';
  $('#reset-screen').style.display = 'grid';
  // Nettoie le jeton de récupération de l'URL
  history.replaceState({}, document.title, window.location.pathname);
}

function showLoginPanel() {
  $('#forgot-panel').style.display = 'none';
  $('#login-panel').style.display = 'block';
}

function showForgotPanel() {
  $('#login-panel').style.display = 'none';
  $('#forgot-panel').style.display = 'block';
  $('#forgot-error').textContent = '';
  $('#forgot-success').style.display = 'none';
}

async function sendPasswordReset() {
  const email = $('#forgot-email').value.trim();
  $('#forgot-error').textContent = '';
  $('#forgot-success').style.display = 'none';
  if (!email) { $('#forgot-error').textContent = 'Merci de renseigner votre e-mail.'; return; }
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) { $('#forgot-error').textContent = 'Erreur : ' + error.message; return; }
  $('#forgot-success').style.display = 'block';
}

async function submitNewPassword() {
  const pw1 = $('#reset-password').value;
  const pw2 = $('#reset-password-2').value;
  $('#reset-error').textContent = '';
  if (!pw1 || pw1.length < 6) { $('#reset-error').textContent = 'Le mot de passe doit contenir au moins 6 caractères.'; return; }
  if (pw1 !== pw2) { $('#reset-error').textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
  const { error } = await sb.auth.updateUser({ password: pw1 });
  if (error) { $('#reset-error').textContent = 'Erreur : ' + error.message; return; }
  $('#reset-screen').style.display = 'none';
  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user || null;
  await showApp();
}

async function showApp() {
  $('#login-screen').style.display = 'none';
  $('#reset-screen').style.display = 'none';
  $('#app').style.display = 'flex';
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
  await Promise.all([loadContacts(), loadContracts(), loadTasks(), loadProfile(), loadAllProfiles(), loadObjectifs()]);
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

async function loadProfile() {
  const { data, error } = await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  if (error) { console.error('Erreur chargement profil :', error.message); }
  state.profile = data || { id: state.user.id, prenom: null, photo_url: null, jours_travailles: null, jours_travailles_mois: null };
}

async function loadAllProfiles() {
  const { data, error } = await sb.from('profiles').select('id, prenom');
  if (error) { console.error('Erreur chargement profils :', error.message); state.profilesById = {}; return; }
  state.profilesById = {};
  (data || []).forEach(p => { state.profilesById[p.id] = p; });
}

function creatorName(userId) {
  if (!userId) return '—';
  const p = state.profilesById?.[userId];
  if (p?.prenom) return p.prenom;
  if (userId === state.user?.id) {
    return state.user?.email ? state.user.email.split('@')[0] : '—';
  }
  return '—';
}

async function loadObjectifs() {
  const { data, error } = await sb.from('objectifs').select('*').order('ordre', { ascending: true });
  if (error) { console.error('Erreur chargement objectifs :', error.message); state.objectifs = []; return; }
  state.objectifs = data || [];
}

function renderAll() {
  renderUserBadge();
  renderDashboard();
  renderContacts();
  renderContracts();
  renderTasks();
  renderObjectifs();
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
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Aucun contact ne correspond aux filtres.</td></tr>`;
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
      <td class="nowrap">${escapeHtml(creatorName(c.created_by))}</td>
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
  const statut = $('#c-statut').value;
  const payload = {
    nom,
    entreprise: $('#c-entreprise').value.trim() || null,
    email: $('#c-email').value.trim() || null,
    telephone: $('#c-telephone').value.trim() || null,
    adresse: $('#c-adresse').value.trim() || null,
    statut,
    source: $('#c-source').value.trim() || null,
    notes: $('#c-notes').value.trim() || null,
    activites: $all('.c-activite').filter(cb => cb.checked).map(cb => cb.value),
  };
  // Mémorise la date de passage au statut "Client" (pour l'objectif "Nouveaux clients")
  const existing = id ? state.contacts.find(x => x.id === id) : null;
  if (statut === 'Client' && (!existing || existing.statut !== 'Client')) {
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
    tbody.innerHTML = `<tr><td colspan="10" class="empty">Aucun contrat ne correspond aux filtres.</td></tr>`;
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
    <tr>
      <td>${escapeHtml(contactName(ct.contact_id))}</td>
      <td>${escapeHtml(ct.type)}</td>
      <td>${escapeHtml(ct.formule || '—')}</td>
      <td>${montantCell}</td>
      <td>${escapeHtml(ct.recurrence)}</td>
      <td>${formatDate(ct.date_debut)}</td>
      <td class="${isOverdue(ct.date_echeance, ct.statut) ? 'overdue' : ''}">${formatDate(ct.date_echeance)}</td>
      <td><span class="badge ${CONTRACT_STATUT_BADGE[ct.statut] || 'badge-gray'}">${escapeHtml(ct.statut)}</span></td>
      <td class="nowrap">${escapeHtml(creatorName(ct.created_by))}</td>
      <td class="actions">
        <button class="btn btn-out btn-sm" data-edit-contract="${ct.id}">Modifier</button>
      </td>
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
}

function updateNetDisplay() {
  const montant = Number($('#ct-montant').value) || 0;
  const remiseActive = $('#ct-remise-check').checked;
  const remise = remiseActive ? (Number($('#ct-remise').value) || 0) : 0;
  const net = Math.max(0, montant - remise);
  $('#ct-net-wrap').style.display = remiseActive && remise > 0 ? '' : 'none';
  $('#ct-net-display').value = formatMoney(net);
}

function onContractTypeChange() {
  populateFormuleSelect($('#ct-type').value.trim(), null);
  onFormuleChange(true);
}

function openContractModal(id = null) {
  const ct = id ? state.contracts.find(x => x.id === id) : null;
  $('#contract-modal-title').textContent = ct ? 'Modifier le contrat' : 'Nouveau contrat';
  $('#ct-id').value = ct?.id || '';
  $('#ct-contact').value = ct?.contact_id || '';
  $('#ct-type').value = ct?.type || '';
  $('#ct-montant').value = ct?.montant ?? '';
  $('#ct-recurrence').value = ct?.recurrence || 'Ponctuel';
  $('#ct-date-debut').value = ct?.date_debut || '';
  $('#ct-date-echeance').value = ct?.date_echeance || '';
  $('#ct-statut').value = ct?.statut || 'Devis envoyé';
  $('#ct-notes').value = ct?.notes || '';

  populateFormuleSelect(ct?.type || '', ct?.formule || null);

  const remise = Number(ct?.remise) || 0;
  $('#ct-remise-check').checked = remise > 0;
  $('#ct-remise').value = remise > 0 ? remise : '';
  $('#ct-remise').style.display = remise > 0 ? '' : 'none';
  updateNetDisplay();

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
  const formuleSel = $('#ct-formule-select').value;
  const formule = formuleSel === FORMULE_CUSTOM
    ? ($('#ct-formule-custom').value.trim() || null)
    : formuleSel;
  const remise = $('#ct-remise-check').checked ? (Number($('#ct-remise').value) || 0) : 0;
  const payload = {
    contact_id,
    type,
    formule,
    montant: montant === '' ? null : Number(montant),
    remise,
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
  const statut = $('#t-statut').value;
  const payload = {
    titre,
    description: $('#t-description').value.trim() || null,
    contact_id: $('#t-contact').value || null,
    contract_id: $('#t-contract').value || null,
    echeance: $('#t-echeance').value || null,
    priorite: $('#t-priorite').value,
    statut,
    assigne_a: $('#t-assigne').value.trim() || null,
  };
  // Mémorise la date de passage à "Terminé" (pour l'objectif "Tâches terminées")
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
  const payload = { statut, termine_at: statut === 'Terminé' ? new Date().toISOString() : null };
  const { error } = await sb.from('tasks').update(payload).eq('id', id);
  if (error) return alert('Erreur : ' + error.message);
  await loadAll();
}

// ---------------------------------------------------------
// PROFIL UTILISATEUR (prénom, photo, jours travaillés)
// ---------------------------------------------------------
function renderUserBadge() {
  const name = state.profile?.prenom || (state.user?.email ? state.user.email.split('@')[0] : 'Utilisateur');
  $('#user-name').textContent = name;
  setAvatar($('#user-avatar'), state.profile?.photo_url, name);
}

function setAvatar(el, photoUrl, name) {
  if (photoUrl) {
    el.style.backgroundImage = `url('${photoUrl}')`;
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = (name || '?').trim().charAt(0).toUpperCase();
  }
}

function openProfileModal() {
  $('#profile-prenom').value = state.profile?.prenom || '';
  $('#profile-photo-input').value = '';
  $('#profile-error').textContent = '';
  $('#profile-new-password').value = '';
  $('#profile-new-password-2').value = '';
  $('#password-error').textContent = '';
  $('#password-success').style.display = 'none';
  setAvatar($('#profile-avatar-preview'), state.profile?.photo_url, state.profile?.prenom || state.user?.email);
  $('#profile-modal').classList.add('show');
}

function closeProfileModal() {
  $('#profile-modal').classList.remove('show');
}

function previewProfilePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const preview = $('#profile-avatar-preview');
    preview.style.backgroundImage = `url('${reader.result}')`;
    preview.textContent = '';
  };
  reader.readAsDataURL(file);
}

async function saveProfile() {
  const prenom = $('#profile-prenom').value.trim() || null;
  const file = $('#profile-photo-input').files[0];
  $('#profile-error').textContent = '';
  let photo_url = state.profile?.photo_url || null;

  if (file) {
    if (file.size > 2 * 1024 * 1024) {
      $('#profile-error').textContent = 'La photo ne doit pas dépasser 2 Mo.';
      return;
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${state.user.id}/avatar.${ext}`;
    const { error: uploadError } = await sb.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
    if (uploadError) {
      $('#profile-error').textContent = "Erreur lors de l'envoi de la photo : " + uploadError.message;
      return;
    }
    const { data } = sb.storage.from('avatars').getPublicUrl(path);
    photo_url = data.publicUrl + '?t=' + Date.now();
  }

  const { error } = await sb.from('profiles').upsert({ id: state.user.id, prenom, photo_url });
  if (error) { $('#profile-error').textContent = 'Erreur : ' + error.message; return; }

  closeProfileModal();
  await loadProfile();
  renderUserBadge();
  renderObjectifs();
}

async function changePassword() {
  const pw1 = $('#profile-new-password').value;
  const pw2 = $('#profile-new-password-2').value;
  $('#password-error').textContent = '';
  $('#password-success').style.display = 'none';

  if (!pw1 || pw1.length < 6) {
    $('#password-error').textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
    return;
  }
  if (pw1 !== pw2) {
    $('#password-error').textContent = 'Les deux mots de passe ne correspondent pas.';
    return;
  }

  const { error } = await sb.auth.updateUser({ password: pw1 });
  if (error) {
    $('#password-error').textContent = 'Erreur : ' + error.message;
    return;
  }
  $('#profile-new-password').value = '';
  $('#profile-new-password-2').value = '';
  $('#password-success').style.display = 'block';
}

// ---------------------------------------------------------
// OBJECTIFS
// ---------------------------------------------------------
function currentJoursTravailles() {
  if (state.profile?.jours_travailles_mois === monthKey() && state.profile?.jours_travailles != null) {
    return state.profile.jours_travailles;
  }
  return null; // pas encore renseigné pour ce mois
}

function computeObjectifValue(o) {
  switch (o.metric_type) {
    case 'nouveaux_clients':
      return state.contacts.filter(c => c.statut === 'Client' && isThisMonth(c.devenu_client_at || c.created_at)).length;
    case 'nouveaux_contacts':
      return state.contacts.filter(c => isThisMonth(c.created_at)).length;
    case 'contrats_total':
      return state.contracts.filter(c => ['Signé', 'En cours', 'Terminé'].includes(c.statut) && isThisMonth(c.date_debut || c.created_at)).length;
    case 'contrats_type':
      return state.contracts.filter(c => c.type === o.contract_type_filter && ['Signé', 'En cours', 'Terminé'].includes(c.statut) && isThisMonth(c.date_debut || c.created_at)).length;
    case 'taches_terminees':
      return state.tasks.filter(t => t.statut === 'Terminé' && isThisMonth(t.termine_at || t.created_at)).length;
    case 'ca_recurrent':
      return state.contracts
        .filter(c => c.recurrence === 'Mensuel' && ['Signé', 'En cours'].includes(c.statut))
        .reduce((sum, c) => sum + Math.max(0, (Number(c.montant) || 0) - (Number(c.remise) || 0)), 0);
    case 'ca_genere':
      return state.contracts
        .filter(c => ['Signé', 'En cours', 'Terminé'].includes(c.statut) && isThisMonth(c.date_debut || c.created_at))
        .reduce((sum, c) => sum + Math.max(0, (Number(c.montant) || 0) - (Number(c.remise) || 0)), 0);
    case 'commissions': {
      const ca = computeObjectifValue({ metric_type: 'ca_genere' });
      const taux = Number(o.taux_commission) || 0;
      return ca * (taux / 100);
    }
    default:
      return 0;
  }
}

function computeObjectifTarget(o) {
  const jr = o.jours_reference || 20;
  if (!o.scale_by_days) return Number(o.objectif_base) || 0;
  const jt = currentJoursTravailles();
  const ratio = jt === null ? 1 : (jt / jr);
  return Math.max(Number(o.objectif_base) > 0 ? 1 : 0, Math.round(Number(o.objectif_base) * ratio));
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function renderObjectifs() {
  $('#mois-courant-label').textContent = capitalize(new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));

  const input = $('#jours-travailles-input');
  const jt = currentJoursTravailles();
  input.value = jt === null ? '' : jt;

  const grid = $('#gauges-grid');
  if (!state.objectifs.length) {
    grid.innerHTML = '<p class="empty">Aucun objectif configuré. Exécutez supabase-schema-v2.sql dans Supabase.</p>';
    return;
  }
  grid.innerHTML = state.objectifs.map(o => {
    const value = computeObjectifValue(o);
    const target = computeObjectifTarget(o);
    const pct = target > 0 ? (value / target) * 100 : (value > 0 ? 100 : 0);
    const isMoney = ['ca_recurrent', 'ca_genere', 'commissions'].includes(o.metric_type);
    const valLabel = isMoney ? formatMoney(value) : value;
    const targetLabel = isMoney ? formatMoney(target) : target;
    return `
      <div class="gauge-card">
        <div class="gauge-wrap">${gaugeSvg(pct)}</div>
        <h4>${escapeHtml(o.label)}</h4>
        <div class="gauge-values">${valLabel} / ${targetLabel}</div>
      </div>`;
  }).join('');
}

async function saveJoursTravailles() {
  const raw = $('#jours-travailles-input').value;
  const jours = raw === '' ? null : Math.max(0, Math.min(31, Math.round(Number(raw))));
  const { error } = await sb.from('profiles').upsert({
    id: state.user.id,
    jours_travailles: jours,
    jours_travailles_mois: monthKey(),
  });
  if (error) return alert('Erreur : ' + error.message);
  await loadProfile();
  renderObjectifs();
}

function openObjectifsModal() {
  const list = $('#objectifs-edit-list');
  list.innerHTML = state.objectifs.map(o => {
    const isMoney = ['ca_recurrent', 'ca_genere', 'commissions'].includes(o.metric_type);
    const unit = (isMoney ? '€ ' : '') + (o.scale_by_days ? `/ ${o.jours_reference}j` : '');
    let row = `
    <div class="objectif-row">
      <label>${escapeHtml(o.label)}</label>
      <input type="number" step="0.01" min="0" data-objectif-id="${o.id}" value="${o.objectif_base}">
      <span class="unit">${unit}</span>
    </div>`;
    if (o.metric_type === 'commissions') {
      row += `
    <div class="objectif-row" style="padding-top:0">
      <label class="mut" style="font-size:.82rem">↳ Taux de commission appliqué au CA généré</label>
      <input type="number" step="0.1" min="0" max="100" data-taux-id="${o.id}" value="${o.taux_commission ?? 0}">
      <span class="unit">%</span>
    </div>`;
    }
    return row;
  }).join('');
  $('#jours-ref-label').textContent = state.objectifs[0]?.jours_reference || 20;
  $('#objectifs-modal').classList.add('show');
}

function closeObjectifsModal() {
  $('#objectifs-modal').classList.remove('show');
}

async function saveObjectifsModal() {
  const inputs = $all('#objectifs-edit-list input[data-objectif-id]');
  for (const inp of inputs) {
    const { error } = await sb.from('objectifs')
      .update({ objectif_base: Number(inp.value) || 0 })
      .eq('id', inp.dataset.objectifId);
    if (error) return alert('Erreur : ' + error.message);
  }
  const tauxInputs = $all('#objectifs-edit-list input[data-taux-id]');
  for (const inp of tauxInputs) {
    const { error } = await sb.from('objectifs')
      .update({ taux_commission: Number(inp.value) || 0 })
      .eq('id', inp.dataset.tauxId);
    if (error) return alert('Erreur : ' + error.message);
  }
  closeObjectifsModal();
  await loadObjectifs();
  renderObjectifs();
}

// ---------------------------------------------------------
// ÉVÉNEMENTS
// ---------------------------------------------------------
function bindEvents() {
  // Login / logout
  $('#login-btn').addEventListener('click', login);
  $('#login-password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('#login-email').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('#logout-btn').addEventListener('click', logout);

  // Mot de passe oublié
  $('#forgot-password-link').addEventListener('click', e => { e.preventDefault(); showForgotPanel(); });
  $('#back-to-login-link').addEventListener('click', e => { e.preventDefault(); showLoginPanel(); });
  $('#forgot-send-btn').addEventListener('click', sendPasswordReset);
  $('#forgot-email').addEventListener('keydown', e => { if (e.key === 'Enter') sendPasswordReset(); });

  // Écran de réinitialisation
  $('#reset-submit-btn').addEventListener('click', submitNewPassword);
  $('#reset-password-2').addEventListener('keydown', e => { if (e.key === 'Enter') submitNewPassword(); });

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
  $('#ct-type').addEventListener('input', onContractTypeChange);
  $('#ct-formule-select').addEventListener('change', () => onFormuleChange(true));
  $('#ct-montant').addEventListener('input', updateNetDisplay);
  $('#ct-remise-check').addEventListener('change', e => {
    $('#ct-remise').style.display = e.target.checked ? '' : 'none';
    if (!e.target.checked) $('#ct-remise').value = '';
    updateNetDisplay();
  });
  $('#ct-remise').addEventListener('input', updateNetDisplay);

  // Modale Tâche
  $('#task-cancel-btn').addEventListener('click', closeTaskModal);
  $('#task-save-btn').addEventListener('click', saveTask);
  $('#task-delete-btn').addEventListener('click', deleteTask);

  // Profil utilisateur
  $('#profile-btn').addEventListener('click', openProfileModal);
  $('#profile-cancel-btn').addEventListener('click', closeProfileModal);
  $('#profile-save-btn').addEventListener('click', saveProfile);
  $('#profile-photo-input').addEventListener('change', previewProfilePhoto);
  $('#password-save-btn').addEventListener('click', changePassword);

  // Objectifs
  $('#save-jours-btn').addEventListener('click', saveJoursTravailles);
  $('#btn-edit-objectifs').addEventListener('click', openObjectifsModal);
  $('#objectifs-cancel-btn').addEventListener('click', closeObjectifsModal);
  $('#objectifs-save-btn').addEventListener('click', saveObjectifsModal);

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
