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
  unreadMessages: [],
  adminUsers: [],
  adminView: 'me', // 'me' (mes chiffres) | 'all' (tous) | 'users' (gestion)
  adminFilterUserId: null, // pour visualiser les objectifs d'un utilisateur précis (admin)
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
  if (pct < 50) return '#2563eb';
  if (pct < 75) return '#3b82f6';
  return '#f59e0b';
}

function gaugeSvg(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  return `<svg viewBox="0 0 100 100" class="gauge-svg">
    <defs>
      <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a1628"/>
        <stop offset="40%" stop-color="#2563eb"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="${r}" class="gauge-track"></circle>
    <circle cx="50" cy="50" r="${r}" class="gauge-fill" style="stroke:url(#gaugeGrad);stroke-dasharray:${c.toFixed(2)};stroke-dashoffset:${offset.toFixed(2)}"></circle>
    <text x="50" y="50" class="gauge-text" style="fill:#fff">${Math.round(pct)}%</text>
  </svg>`;
}

const CONTACT_STATUT_BADGE = { 'Prospect': 'badge-blue', 'Client': 'badge-green', 'Inactif': 'badge-gray' };
const CONTRACT_STATUT_BADGE = {
  'En attente de signature': 'badge-gray', 'Envoyé': 'badge-blue', 'Contrat en cours': 'badge-gold',
  'Paiement échoué': 'badge-red', 'Terminé': 'badge-green', 'Résilié': 'badge-red'
};
const PRIORITY_BADGE = { 'Basse': 'badge-gray', 'Normale': 'badge-blue', 'Haute': 'badge-red' };
const ACTIVITE_BADGE = { 'Digitalisation': 'badge-blue', 'RGPD': 'badge-gold', 'Assurance': 'badge-green', 'Autre': 'badge-gray' };
const TASK_TYPE_BADGE = { 'Premier contact': 'badge-blue', 'RDV visio': 'badge-gold', 'RDV terrain': 'badge-green', 'Autre': 'badge-gray' };

// ---------------------------------------------------------
// GRILLE TARIFAIRE (issue de safe-digitalisation.fr)
// Formules pré-remplies par type de prestation : montant HT,
// récurrence, frais de mise en place et engagement minimum
// (ajoutés automatiquement en note). Les types non listés ici
// (Audit RGPD, Gestion Fiche Google Business, Courtage Assurance,
// Autre) n'ont pas de tarif catalogue publié : la formule reste
// "Personnalisé / Sur devis" avec saisie libre.
// ---------------------------------------------------------
// ---------------------------------------------------------
// FORMULES & COMMISSIONS
// Barème : SAFEDIRCOM-2026-V1 — En vigueur au 12 juin 2026
//
// Structure par formule :
//   comm_signature_fix : montant fixe versé le mois de signature
//   comm_bonus_fidelite: montant fixe versé au mois 4 si client
//                        toujours actif (clause anti-churn 90j)
//   comm_recurrent_pct : taux mensuel sur le montant HT
//   comm_signature_pct : taux one-shot (audits/cyber/options)
//                        appliqué au montant HT — utilisé quand
//                        comm_signature_fix n'est pas défini
// ---------------------------------------------------------
const FORMULE_PRESETS = {
  'Référencement Local': [
    { label: 'Essentiel', montant: 79,  recurrence: 'Mensuel',  setup: 190, engagement: 6, comm_signature_fix: 75,  comm_bonus_fidelite: 75,  comm_recurrent_pct: 0.15 },
    { label: 'Boost',     montant: 149, recurrence: 'Mensuel',  setup: 290, engagement: 6, comm_signature_fix: 100, comm_bonus_fidelite: 100, comm_recurrent_pct: 0.15 },
    { label: 'Prestige',  montant: 249, recurrence: 'Mensuel',  setup: 0,   engagement: 3, comm_signature_fix: 0,   comm_bonus_fidelite: 0,   comm_recurrent_pct: 0.15 },
  ],
  'Click & Collect': [
    { label: 'Essentiel', montant: 49,  recurrence: 'Mensuel',  setup: 150, engagement: 6, comm_signature_fix: 50,  comm_bonus_fidelite: 50,  comm_recurrent_pct: 0.15 },
    { label: 'Pro',       montant: 79,  recurrence: 'Mensuel',  setup: 250, engagement: 6, comm_signature_fix: 100, comm_bonus_fidelite: 100, comm_recurrent_pct: 0.15 },
    { label: 'Premium',   montant: 129, recurrence: 'Mensuel',  setup: 0,   engagement: 3, comm_signature_fix: 0,   comm_bonus_fidelite: 0,   comm_recurrent_pct: 0.15 },
  ],
  'Mise en conformité RGPD': [
    { label: 'Diagnostic (offert)',     montant: 0,    recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0,    comm_recurrent_pct: 0 },
    { label: 'Audit RGPD TPE',          montant: 1490, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_fix: 298,  comm_recurrent_pct: 0 },
    { label: 'Audit RGPD+ PME',         montant: 2990, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_fix: 598,  comm_recurrent_pct: 0 },
    { label: 'Audit ETI (sur devis)',   montant: 5500, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.20, comm_recurrent_pct: 0 },
  ],
  'DPO externalisé': [
    { label: 'Abonnement DPO', montant: 189, recurrence: 'Mensuel', setup: 0, engagement: 12, comm_signature_fix: 50, comm_recurrent_pct: 0.10 },
  ],
  'Cybersécurité': [
    { label: 'Audit de vulnérabilité',  montant: 490,  recurrence: 'Ponctuel', setup: 0, engagement: 0, deliveryDays: 5,  comm_signature_fix: 98,  comm_recurrent_pct: 0 },
    { label: 'Pack Sécurité Essentiel', montant: 990,  recurrence: 'Ponctuel', setup: 0, engagement: 0, deliveryDays: 10, comm_signature_fix: 198, comm_recurrent_pct: 0 },
    { label: 'Pack Résilience Pro',     montant: 1990, recurrence: 'Ponctuel', setup: 0, engagement: 0, deliveryDays: 15, comm_signature_fix: 398, comm_recurrent_pct: 0 },
  ],
  'Options à la carte': [
    { label: 'Landing page SEO',         montant: 390, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.10, comm_recurrent_pct: 0 },
    { label: 'Google Ads setup',         montant: 290, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.10, comm_recurrent_pct: 0 },
    { label: 'Formation GBP 2h',         montant: 220, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.10, comm_recurrent_pct: 0 },
    { label: 'Audit concurrentiel',      montant: 290, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.10, comm_recurrent_pct: 0 },
    { label: 'Sensibilisation phishing', montant: 290, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.10, comm_recurrent_pct: 0 },
    { label: 'Veille menaces',           montant: 89,  recurrence: 'Mensuel',  setup: 0, engagement: 0, comm_signature_pct: 0,    comm_recurrent_pct: 0.10 },
  ],
};
const FORMULE_CUSTOM = '__custom__';

// Fallback pour les formules personnalisées ou sans grille rattachée
const COMMISSION_FALLBACK = { comm_signature_pct: 0.10, comm_recurrent_pct: 0.10 };

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
    if (event === 'TOKEN_REFRESHED' && session) {
      // Token rafraîchi automatiquement par Supabase — mettre à jour le state
      state.user = session.user;
      return;
    }
    if (event === 'SIGNED_OUT') {
      state.user = null;
      showLogin();
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

  // Intercepteur global 401 — redirige proprement vers le login
  const _origFetch = window.fetch;
  window.fetch = async function(...args) {
    const resp = await _origFetch.apply(this, args);
    if (resp.status === 401 && state.user) {
      // Tenter un refresh silencieux avant de déconnecter
      const { data: refreshData } = await sb.auth.refreshSession();
      if (!refreshData?.session) {
        console.warn('[S@FE CRM] Session expirée — déconnexion.');
        state.user = null;
        showLogin();
      }
    }
    return resp;
  };

  bindEvents();
  updateDashboardClock();
  setInterval(updateDashboardClock, 30000);
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
    return;
  }
  // Si l'utilisateur a un facteur TOTP enrôlé, on lui demande le code à 6 chiffres
  const ok = await challengeTOTPIfNeeded();
  if (!ok) {
    $('#login-error').textContent = "Connexion annulée (double authentification).";
    return;
  }
}

async function logout() {
  await sb.auth.signOut();
}

// ---------------------------------------------------------
// CHARGEMENT DES DONNÉES
// ---------------------------------------------------------
async function loadAll() {
  await Promise.all([
    loadContacts(), loadContracts(), loadTasks(),
    loadProfile(), loadAllProfiles(), loadObjectifs(),
    loadUnreadMessages(), loadInteractions(),
  ]);
  await ensureUserObjectifs();
  renderAll();
  checkRgpdExpiry(); // Vérification RGPD automatique au login
  if (!isAdmin()) checkMandatSigne(); // Redirection vers signature si mandat absent
  checkPasswordStatus();             // Vérification mot de passe + renouvellement 45j
  loadBordereaux();     // Bordereaux admin
  loadNotifContracts(); // Notifications nouveaux contrats (admin)
  loadBordereauDCI();   // Rappel facturation DCI
  loadHelpRequests();   // Demandes d'assistance
  loadUpsellOpportunities(); // Potentiel montée en gamme
  loadChurnRisk();           // Risque résiliation
}

async function loadContacts() {
  const { data, error } = await sb.from('contacts').select('*').order('created_at', { ascending: false });
  if (error) return alert('Erreur chargement contacts : ' + error.message);
  state.contacts = data || [];
}

async function loadContracts() {
  const { data, error } = await sb.from('contracts').select('*, stripe_subscription_id, resilié_at').order('created_at', { ascending: false });
  if (error) return alert('Erreur chargement contrats : ' + error.message);
  state.contracts = data || [];
}

async function loadTasks() {
  const { data, error } = await sb.from('tasks').select('*').order('echeance', { ascending: true, nullsFirst: false });
  if (error) return alert('Erreur chargement tâches : ' + error.message);
  state.tasks = data || [];
}

async function loadInteractions() {
  const { data, error } = await sb.from('interactions').select('*').order('date', { ascending: false });
  if (error) { console.error('Erreur chargement interactions :', error.message); state.interactions = []; return; }
  state.interactions = data || [];
}

async function loadProfile() {
  const { data, error } = await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  if (error) { console.error('Erreur chargement profil :', error.message); }
  state.profile = data || { id: state.user.id, prenom: null, photo_url: null, jours_travailles: null, jours_travailles_mois: null, is_admin: false };
}

async function loadAllProfiles() {
  const { data, error } = await sb.from('profiles').select('id, prenom, is_admin');
  if (error) { console.error('Erreur chargement profils :', error.message); state.profilesById = {}; return; }
  state.profilesById = {};
  (data || []).forEach(p => { state.profilesById[p.id] = p; });
}

async function loadUnreadMessages() {
  const { data, error } = await sb.from('messages')
    .select('*')
    .eq('recipient_id', state.user.id)
    .eq('read', false)
    .order('created_at', { ascending: false });
  if (error) { console.error('Erreur chargement messages :', error.message); state.unreadMessages = []; return; }
  state.unreadMessages = data || [];
}

function isAdmin() {
  return !!state.profile?.is_admin;
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

// Crée le jeu d'objectifs par défaut pour l'utilisateur s'il
// n'en a pas encore. (Migration v7 : chaque utilisateur a
// désormais ses propres objectifs.)
async function ensureUserObjectifs() {
  const mine = state.objectifs.filter(o => o.user_id === state.user.id);
  if (mine.length > 0) return;
  const defaults = [
    { user_id: state.user.id, ordre: 1, label: 'Entrées en contact',     metric_type: 'nouveaux_contacts', contract_type_filter: null, objectif_base: 20,    jours_reference: 20, scale_by_days: true,  taux_commission: 0 },
    { user_id: state.user.id, ordre: 2, label: 'CA généré',              metric_type: 'ca_genere',         contract_type_filter: null, objectif_base: 5000,  jours_reference: 20, scale_by_days: true,  taux_commission: 0 },
    { user_id: state.user.id, ordre: 3, label: 'Commissions', metric_type: 'commissions', contract_type_filter: null, objectif_base: 600, jours_reference: 20, scale_by_days: true,  taux_commission: 0 },
  ];
  const { error } = await sb.from('objectifs').insert(defaults);
  if (error) { console.error('Erreur création objectifs :', error.message); return; }
  await loadObjectifs();
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
  if (!view) return; // ignore les clics sur des navlink sans data-view (sous-onglets admin)
  $all('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $all('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'admin' && isAdmin()) renderAdmin();
}

// ---------------------------------------------------------
// TABLEAU DE BORD
// ---------------------------------------------------------
function updateDashboardClock() {
  const el = $('#dashboard-clock');
  if (!el) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  el.textContent = `${capitalize(dateStr)} — ${timeStr} (heure de Paris)`;
}

function interactAlert(contractId, contactId, days) {
  // Marquer le palier vu selon les jours restants
  const dismissed = JSON.parse(localStorage.getItem('safe_dismissed_alerts_v2') || '{}');
  if (!dismissed[contractId]) dismissed[contractId] = {};
  if (days <= 3)      dismissed[contractId].seen3 = true;
  else if (days <= 7) dismissed[contractId].seen7 = true;
  localStorage.setItem('safe_dismissed_alerts_v2', JSON.stringify(dismissed));
  // Basculer sur la vue Contacts puis ouvrir la fiche
  if (contactId) {
    switchView('contacts');
    setTimeout(() => openContactModal(contactId), 50);
  }
  renderDashboard();
}

function renderDashboard() {
  const name = state.profile?.prenom || (state.user?.email ? state.user.email.split('@')[0] : 'Utilisateur');
  $('#dashboard-title').textContent = `Tableau de bord de ${name}`;
  updateDashboardClock();

  // Alerte échéances de contrats (en retard ou dans les 15 prochains jours)
  const today = todayISO();
  const limit = new Date();
  limit.setDate(limit.getDate() + 15);
  const limitStr = limit.toISOString().slice(0, 10);
  // Dismissed : { id: { seen7: bool, seen3: bool } }
  const dismissed = JSON.parse(localStorage.getItem('safe_dismissed_alerts_v2') || '{}');
  const dueSoon = state.contracts
    .filter(c => {
      if (!c.date_echeance) return false;
      if (c.date_echeance > limitStr) return false;
      if (['Terminé', 'Résilié'].includes(c.statut)) return false;
      if (c.created_by !== state.user?.id) return false;
      const days = Math.round((new Date(c.date_echeance) - new Date(today)) / 86400000);
      const d = dismissed[c.id] || {};
      // Toujours afficher si en retard
      if (days < 0) return true;
      // Afficher à J-7 (entre 4 et 7 jours) si pas encore vu ce palier
      if (days <= 7 && days > 3 && !d.seen7) return true;
      // Afficher à J-3 (entre 0 et 3 jours) si pas encore vu ce palier
      if (days <= 3 && !d.seen3) return true;
      return false;
    })
    .sort((a, b) => a.date_echeance.localeCompare(b.date_echeance));
  const alertBlock = $('#echeances-alert');
  if (dueSoon.length) {
    alertBlock.style.display = 'block';
    $('#echeances-list').innerHTML = dueSoon.map(c => {
      const days = Math.round((new Date(c.date_echeance) - new Date(today)) / 86400000);
      const when = days < 0 ? `en retard de ${Math.abs(days)} j` : (days === 0 ? "aujourd'hui" : `dans ${days} j`);
      return `
        <div class="mini-item">
          <div>
            <div class="t">${escapeHtml(contactName(c.contact_id))} — ${escapeHtml(c.type)}${c.formule ? ' / ' + escapeHtml(c.formule) : ''}</div>
            <div class="s">Échéance le ${formatDate(c.date_echeance)}</div>
          </div>
          <span class="${days < 0 ? 'overdue' : ''}">${when}</span>
          <button class="btn btn-pri btn-sm" style="margin-left:8px;font-size:.72rem" onclick="interactAlert('${c.id}','${c.contact_id}',${days})">👉 Interagir</button>
        </div>`;
    }).join('');
  } else {
    alertBlock.style.display = 'none';
  }

  const myId = state.user?.id;
  const myContacts  = state.contacts.filter(c => c.created_by === myId);
  const myContracts = state.contracts.filter(c => c.created_by === myId);
  $('#stat-contacts').textContent = myContacts.length;
  $('#stat-clients').textContent = myContacts.filter(c => c.statut === 'Client').length;
  $('#stat-contracts').textContent = myContracts.filter(c => !['Terminé','Résilié'].includes(c.statut)).length;
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

  // Pop-up des messages non lus (à la première ouverture du dashboard)
  if (!state._messagesShown && state.unreadMessages.length) {
    state._messagesShown = true;
    showIncomingMessagesIfAny();
  }
}

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
  const nom = $('#c-nom').value.trim();
  if (!nom) { alert('Le nom est obligatoire.'); return; }
  const rgpdKoChecked = false; // géré automatiquement par check_rgpd_expiry()
  const payload = {
    nom,
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
  $('#ct-net-wrap').style.display = remiseActive && remise > 0 ? '' : 'none';
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
  $('#ct-notes').value = ct?.notes || '';

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
  const isRdv = t.type_tache === 'RDV visio' || t.type_tache === 'RDV terrain';
  const rdvLine = isRdv && (t.rdv_date || t.rdv_heure || t.rdv_lieu)
    ? `<div class="meta" style="margin-top:6px"><span>📍 ${formatDate(t.rdv_date)}${t.rdv_heure ? ' à ' + t.rdv_heure.slice(0,5) : ''}${t.rdv_lieu ? ' — ' + escapeHtml(t.rdv_lieu) : ''}</span></div>`
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
  $('#kanban-todo').innerHTML = cols['À faire'].length ? cols['À faire'].map(taskCardHtml).join('') : '<p class="empty">Aucune tâche.</p>';
  $('#kanban-inprogress').innerHTML = cols['En cours'].length ? cols['En cours'].map(taskCardHtml).join('') : '<p class="empty">Aucune tâche.</p>';
  $('#kanban-done').innerHTML = cols['Terminé'].length ? cols['Terminé'].map(taskCardHtml).join('') : '<p class="empty">Aucune tâche.</p>';
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

function openTaskModal(id = null) {
  // Rafraîchir les selects (contacts et contrats) à chaque ouverture
  populateContactSelects();
  populateContractSelects();

  const t = id ? state.tasks.find(x => x.id === id) : null;
  $('#task-modal-title').textContent = t ? 'Modifier la tâche' : 'Nouvelle tâche';
  $('#t-id').value = t?.id || '';
  $('#t-type').value = t?.type_tache || 'Premier contact';
  $('#t-titre').value = t?.titre || '';
  $('#t-description').value = t?.description || '';
  $('#t-contact').value = t?.contact_id || '';
  $('#t-contract').value = t?.contract_id || '';
  $('#t-rdv-date').value = t?.rdv_date || '';
  $('#t-rdv-heure').value = t?.rdv_heure ? t.rdv_heure.slice(0, 5) : '';
  $('#t-rdv-lieu').value = t?.rdv_lieu || '';
  $('#t-echeance').value = t?.echeance || '';
  $('#t-priorite').value = t?.priorite || 'Normale';
  $('#t-statut').value = t?.statut || 'À faire';
  // Populate assigné dropdown with users
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

async function saveTask() {
  const id = $('#t-id').value;
  const titre = $('#t-titre').value.trim();
  if (!titre) { alert('Le titre est obligatoire.'); return; }
  const statut = $('#t-statut').value;
  const type_tache = $('#t-type').value;
  const isRdv = type_tache === 'RDV visio' || type_tache === 'RDV terrain';
  const rdv_date = isRdv ? ($('#t-rdv-date').value || null) : null;
  const payload = {
    type_tache,
    titre,
    description: $('#t-description').value.trim() || null,
    contact_id: $('#t-contact').value || null,
    contract_id: $('#t-contract').value || null,
    rdv_date,
    rdv_heure: isRdv ? ($('#t-rdv-heure').value || null) : null,
    rdv_lieu: isRdv ? ($('#t-rdv-lieu').value.trim() || null) : null,
    // Pour un RDV, l'échéance suit la date du RDV (sinon la date saisie librement)
    echeance: isRdv ? rdv_date : ($('#t-echeance').value || null),
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
  // Onglet Administration visible uniquement pour les super-admins
  $all('.admin-only').forEach(el => { el.style.display = isAdmin() ? '' : 'none'; });
  if (isAdmin()) checkResetFlag();
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
  refreshTOTPStatus();
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

// =========================================================
// ADMINISTRATION (super-administrateur uniquement)
// =========================================================

function switchAdminTab(tab) {
  state.adminView = tab;
  $all('[data-admin-tab]').forEach(b => b.classList.toggle('active', b.dataset.adminTab === tab));
  ['overview', 'resultats', 'per-user', 'users', 'rgpd-ko', 'registre'].forEach(t => {
    const el = $('#admin-panel-' + t);
    if (el) el.style.display = (t === tab) ? '' : 'none';
  });
  if (tab === 'users') loadAdminUsers().then(renderAdminUsers);
  if (tab === 'overview') renderAdminOverview();
  if (tab === 'resultats') renderResultats();
  if (tab === 'per-user') renderAdminPerUser();
  if (tab === 'rgpd-ko') renderAdminRgpdKo();
  if (tab === 'registre') renderRegistreRGPD();
}

// Liste des contacts RGPD KO pour modération admin
function renderAdminRgpdKo() {
  const tbody = $('#admin-rgpd-ko-table tbody');
  if (!tbody) return;
  const list = (state.contacts || []).filter(c => c.rgpd_ko);
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Aucun contact en RGPD KO.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr class="row-rgpd-ko">
      <td>${escapeHtml(c.nom)}</td>
      <td>${escapeHtml(c.entreprise || '—')}</td>
      <td class="nowrap">${escapeHtml(creatorName(c.created_by))}</td>
      <td class="nowrap">${formatDate(c.updated_at || c.created_at)}</td>
      <td class="actions"><button class="btn btn-out btn-sm" data-edit-contact="${c.id}">Ouvrir / modifier</button></td>
    </tr>`).join('');
}

function renderAdmin() {
  // (Re)rend la sous-vue active
  switchAdminTab(state.adminView || 'overview');
}

function renderAdminOverview() {
  // On utilise les 3 indicateurs standards du tableau de bord
  // perso, mais en mode "all" (cumul tous utilisateurs).
  const grid = $('#admin-totals-grid');
  const metrics = [
    { metric_type: 'nouveaux_contacts', label: 'Entrées en contact (tous)', money: false },
    { metric_type: 'ca_genere',         label: 'CA généré (tous)',          money: true  },
    { metric_type: 'commissions',       label: 'Commissions', money: true  },
  ];
  grid.innerHTML = metrics.map(m => {
    const value = computeObjectifValue(m, 'all');
    const label = m.money ? formatMoney(value) : value;
    return `
      <div class="gauge-card">
        <div class="gauge-label">${escapeHtml(m.label)}</div>
        <div class="gauge-value-row" style="justify-content:center;margin-top:14px">
          <span class="gauge-value" style="font-size:2.2rem;color:var(--accent)">${label}</span>
        </div>
        <div class="gauge-sub mut" style="text-align:center;margin-top:6px">Cumul depuis le 1ᵉʳ du mois</div>
      </div>`;
  }).join('');
}

// Mini-jauge horizontale (barre) pour la vue admin par utilisateur
function miniGauge(label, value, target, unit) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : (value > 0 ? 100 : 0);
  const valLabel = unit === '€' ? formatMoney(value) : value;
  const tgtLabel = unit === '€' ? formatMoney(target) : target;
  return `
    <div class="mini-gauge">
      <div class="mg-head">
        <span class="mg-label">${escapeHtml(label)}</span>
        <span class="mg-values" style="color:#f59e0b">${valLabel} <span class="mut">/ ${tgtLabel}</span></span>
      </div>
      <div class="mg-bar"><div class="mg-fill" style="width:${pct.toFixed(0)}%;background:linear-gradient(90deg,#0a1628,#2563eb,#f59e0b)"></div></div>
    </div>`;
}

// Rend une grille de blocs nominatifs (photo + jauges) pour la liste d'utilisateurs donnée.
// Utilisé à la fois par l'onglet Objectifs (admin) et l'onglet Administration > Par utilisateur.
function renderTeamGauges(containerEl, users, options = {}) {
  if (!containerEl) return;
  const limit = options.limit || 10;
  const clickable = options.clickable || false;
  if (!users.length) {
    containerEl.innerHTML = '<p class="empty">Aucun utilisateur connu.</p>';
    return;
  }
  const shown = users.slice(0, limit);
  const truncated = users.length > limit;
  const targetFor = (uid, metric) => {
    const o = state.objectifs.find(o => o.user_id === uid && o.metric_type === metric);
    return o ? computeObjectifTarget(o) : 0;
  };
  containerEl.innerHTML = shown.map(u => {
    const contacts = computeObjectifValue({ metric_type: 'nouveaux_contacts' }, u.id);
    const ca       = computeObjectifValue({ metric_type: 'ca_genere' }, u.id);
    const comm     = computeMonthlyCommission(u.id);
    const tContacts = targetFor(u.id, 'nouveaux_contacts');
    const tCa       = targetFor(u.id, 'ca_genere');
    const tComm     = targetFor(u.id, 'commissions');
    const actifs   = state.contracts.filter(c => c.created_by === u.id && ['Contrat en cours', 'Envoyé'].includes(c.statut)).length;
    const photo = u.photo_url
      ? `<div class="pu-avatar" style="background-image:url('${escapeHtml(u.photo_url)}')"></div>`
      : `<div class="pu-avatar pu-avatar-letter">${escapeHtml((u.prenom || '?').charAt(0).toUpperCase())}</div>`;
    return `
      <div class="per-user-row${clickable ? ' clickable' : ''}" ${clickable ? `data-user-id="${u.id}"` : ''}>
        <div class="pu-identity">
          ${photo}
          <div>
            <div class="pu-name">${escapeHtml(u.prenom || '—')}${u.is_admin ? ' <span class="badge badge-gold" style="margin-left:4px">Admin</span>' : ''}</div>
            <div class="pu-sub mut">${actifs} contrat${actifs > 1 ? 's' : ''} actif${actifs > 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="pu-gauges">
          ${miniGauge('Entrées en contact', contacts, tContacts, '')}
          ${miniGauge('CA généré', ca, tCa, '€')}
          ${miniGauge('Commissions', comm, tComm, '€')}
        </div>
      </div>`;
  }).join('') + (truncated
    ? `<p class="mut" style="font-size:.82rem;margin-top:10px">⚠️ ${users.length - limit} utilisateur(s) supplémentaire(s) non affiché(s) — affichage limité à ${limit}.</p>`
    : '');

  // Gestion du clic sur les blocs utilisateurs
  if (clickable) {
    containerEl.querySelectorAll('.per-user-row.clickable').forEach(row => {
      row.addEventListener('click', () => openResultatsDetail(row.dataset.userId));
    });
  }
}

function renderAdminPerUser() {
  const grid = $('#admin-per-user-grid');
  if (!grid) return;
  const allUsers = Object.values(state.profilesById)
    .sort((a, b) => (a.prenom || '').localeCompare(b.prenom || ''));
  const countEl = $('#admin-per-user-count');
  if (countEl) countEl.textContent = allUsers.length;
  renderTeamGauges(grid, allUsers);
}

// =========================================================
// ONGLET RÉSULTATS (admin) — blocs cliquables + détail + bordereau
// =========================================================

function renderResultats() {
  const grid = $('#resultats-team-grid');
  if (!grid) return;
  $('#resultats-team-view').style.display = '';
  $('#resultats-detail-view').style.display = 'none';
  const allUsers = Object.values(state.profilesById)
    .sort((a, b) => (a.prenom || '').localeCompare(b.prenom || ''));
  renderTeamGauges(grid, allUsers, { clickable: true });
}

function openResultatsDetail(userId) {
  const u = state.profilesById[userId];
  if (!u) return;
  $('#resultats-team-view').style.display = 'none';
  $('#resultats-detail-view').style.display = '';
  $('#resultats-detail-name').textContent = u.prenom || u.email || '—';

  // Jauges individuelles
  const gaugesEl = $('#resultats-detail-gauges');
  const contacts = computeObjectifValue({ metric_type: 'nouveaux_contacts' }, userId);
  const ca = computeObjectifValue({ metric_type: 'ca_genere' }, userId);
  const comm = computeMonthlyCommission(userId);
  const tContacts = getObjectifTarget(userId, 'nouveaux_contacts');
  const tCa = getObjectifTarget(userId, 'ca_genere');
  const tComm = getObjectifTarget(userId, 'commissions');
  gaugesEl.innerHTML = [
    { label: 'Entrées en contact', val: contacts, tgt: tContacts, unit: '' },
    { label: 'CA généré', val: ca, tgt: tCa, unit: '€' },
    { label: 'Commissions', val: comm, tgt: tComm, unit: '€' },
  ].map(g => {
    const pct = g.tgt > 0 ? Math.min(100, (g.val / g.tgt) * 100) : (g.val > 0 ? 100 : 0);
    return `<div class="gauge-card">
      <div class="gauge-wrap">${gaugeSvg(pct)}</div>
      <h4>${escapeHtml(g.label)}</h4>
      <p class="mut">${g.unit === '€' ? formatMoney(g.val) : g.val} / ${g.unit === '€' ? formatMoney(g.tgt) : g.tgt}</p>
    </div>`;
  }).join('');

  // Contrats du mois en cours (nouvelles affaires)
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const newContracts = state.contracts.filter(c =>
    c.created_by === userId &&
    c.date_debut &&
    new Date(c.date_debut + 'T00:00:00') >= startMonth &&
    new Date(c.date_debut + 'T00:00:00') <= endMonth &&
    ['Contrat en cours', 'Envoyé', 'En attente de signature'].includes(c.statut)
  );
  const newTbody = $('#resultats-detail-new-table tbody');
  newTbody.innerHTML = newContracts.length ? newContracts.map(c => {
    const contact = state.contacts.find(x => x.id === c.contact_id);
    const preset = (FORMULE_PRESETS[c.type] || []).find(f => f.label === c.formule);
    const commSig = preset?.comm_signature_fix || (preset?.comm_signature_pct ? Math.round(Number(c.montant || 0) * preset.comm_signature_pct * 100) / 100 : 0);
    return `<tr>
      <td>${escapeHtml(contact?.nom || '—')}</td>
      <td>${escapeHtml(c.type || '—')}</td>
      <td>${escapeHtml(c.formule || '—')}</td>
      <td class="num">${formatMoney(c.montant)}</td>
      <td class="num">${formatMoney(c.frais_mise_en_place || 0)}</td>
      <td class="num">${formatMoney(c.remise || 0)}</td>
      <td class="num" style="color:#f59e0b;font-weight:600">${formatMoney(commSig)}</td>
      <td class="nowrap">${formatDate(c.date_debut)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="empty">Aucune nouvelle affaire ce mois-ci</td></tr>';

  // Abonnements récurrents actifs
  const recurContracts = state.contracts.filter(c =>
    c.created_by === userId &&
    c.recurrence === 'Mensuel' &&
    ['Contrat en cours'].includes(c.statut)
  );
  const recTbody = $('#resultats-detail-recurrent-table tbody');
  recTbody.innerHTML = recurContracts.length ? recurContracts.map(c => {
    const contact = state.contacts.find(x => x.id === c.contact_id);
    const preset = (FORMULE_PRESETS[c.type] || []).find(f => f.label === c.formule);
    const commRec = preset?.comm_recurrent_pct ? Math.round(Number(c.montant || 0) * preset.comm_recurrent_pct * 100) / 100 : 0;
    return `<tr>
      <td>${escapeHtml(contact?.nom || '—')}</td>
      <td>${escapeHtml(c.type || '—')}</td>
      <td>${escapeHtml(c.formule || '—')}</td>
      <td class="num">${formatMoney(c.montant)}/mois</td>
      <td class="num" style="color:#f59e0b;font-weight:600">${formatMoney(commRec)}/mois</td>
      <td class="nowrap">${formatDate(c.date_debut)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" class="empty">Aucun abonnement récurrent actif</td></tr>';

  // Stocker l'userId pour le bordereau
  state._resultatsUserId = userId;
}

function getObjectifTarget(userId, metricType) {
  const o = state.objectifs.find(o => o.user_id === userId && o.metric_type === metricType);
  return o ? computeObjectifTarget(o) : 0;
}
function generateBordereauCommission() {
  const userId = state._resultatsUserId;
  const u = state.profilesById[userId];
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!u || !jsPDF) { alert('Données insuffisantes ou jsPDF non chargé.'); return; }

  const now = new Date();
  const moisLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 190;
  let y = 15;

  // === EN-TÊTE ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(10, 22, 40);
  doc.text('BORDEREAU DE COMMISSION', 15, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text('S@FE Digitalisation — ' + moisLabel, 15, y);
  y += 6;
  doc.text('Commercial : ' + (u.prenom || '—'), 15, y);
  if (u.denomination) { y += 5; doc.text('Société : ' + u.denomination, 15, y); }
  if (u.siret) { y += 5; doc.text('SIRET : ' + u.siret, 15, y); }
  if (u.tva) { y += 5; doc.text('TVA : ' + u.tva, 15, y); }
  if (u.adresse_pro) { y += 5; doc.text('Adresse : ' + u.adresse_pro, 15, y); }
  y += 5;
  doc.text('Généré le : ' + now.toLocaleDateString('fr-FR'), 15, y);
  y += 4;
  doc.setDrawColor(200); doc.line(15, y, 195, y); y += 6;

  // === SECTION 1 : NOUVELLES AFFAIRES DU MOIS ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(10, 22, 40);
  doc.text('1. Commissions à la signature (mois en cours)', 15, y);
  y += 8;

  var startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  var newC = state.contracts.filter(function(c) {
    return c.created_by === userId && c.date_debut &&
      new Date(c.date_debut) >= startMonth && new Date(c.date_debut) <= endMonth &&
      ['Contrat en cours', 'Envoyé', 'En attente de signature'].includes(c.statut);
  });

  // En-tête tableau
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 245);
  doc.rect(15, y - 3.5, W, 5, 'F');
  var cols1 = [15, 50, 82, 110, 133, 153, 175];
  var heads1 = ['Contact', 'Prestation', 'Formule', 'Montant HT', 'MeP HT', 'Remise', 'Commission'];
  heads1.forEach(function(h, i) { doc.text(h, cols1[i], y); });
  y += 6;

  doc.setFont('helvetica', 'normal');
  var totalSig = 0;
  newC.forEach(function(c) {
    if (y > 270) { doc.addPage(); y = 20; }
    var contact = state.contacts.find(function(x) { return x.id === c.contact_id; });
    var preset = (FORMULE_PRESETS[c.type] || []).find(function(f) { return f.label === c.formule; });
    var commSig = (preset && preset.comm_signature_fix) || ((preset && preset.comm_signature_pct) ? Math.round(Number(c.montant || 0) * preset.comm_signature_pct * 100) / 100 : 0);
    totalSig += commSig;
    doc.text(((contact && contact.nom) || '—').slice(0, 20), cols1[0], y);
    doc.text((c.type || '—').slice(0, 18), cols1[1], y);
    doc.text((c.formule || '—').slice(0, 16), cols1[2], y);
    doc.text(formatMoney(c.montant), cols1[3], y);
    doc.text(formatMoney(c.frais_mise_en_place || 0), cols1[4], y);
    doc.text(formatMoney(c.remise || 0), cols1[5], y);
    doc.setTextColor(37, 99, 235);
    doc.text(formatMoney(commSig), cols1[6], y);
    doc.setTextColor(80, 80, 80);
    y += 5;
  });
  if (!newC.length) { doc.text('Aucune nouvelle affaire ce mois-ci.', 15, y); y += 5; }
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(10, 22, 40);
  doc.text('Sous-total commissions signature HT : ' + formatMoney(totalSig), 15, y);
  y += 10;

  // === SECTION 2 : RÉCURRENT ===
  doc.setFontSize(12);
  doc.text('2. Commissions récurrentes (abonnements actifs)', 15, y);
  y += 8;

  var recC = state.contracts.filter(function(c) {
    return c.created_by === userId && c.recurrence === 'Mensuel' && c.statut === 'Contrat en cours';
  });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 245);
  doc.rect(15, y - 3.5, W, 5, 'F');
  var cols2 = [15, 50, 82, 115, 145, 175];
  var heads2 = ['Contact', 'Prestation', 'Formule', 'Mensuel HT', 'Commission/mois', 'Depuis'];
  heads2.forEach(function(h, i) { doc.text(h, cols2[i], y); });
  y += 6;

  doc.setFont('helvetica', 'normal');
  var totalRec = 0;
  recC.forEach(function(c) {
    if (y > 270) { doc.addPage(); y = 20; }
    var contact = state.contacts.find(function(x) { return x.id === c.contact_id; });
    var preset = (FORMULE_PRESETS[c.type] || []).find(function(f) { return f.label === c.formule; });
    var commRec = (preset && preset.comm_recurrent_pct) ? Math.round(Number(c.montant || 0) * preset.comm_recurrent_pct * 100) / 100 : 0;
    totalRec += commRec;
    doc.text(((contact && contact.nom) || '—').slice(0, 20), cols2[0], y);
    doc.text((c.type || '—').slice(0, 18), cols2[1], y);
    doc.text((c.formule || '—').slice(0, 16), cols2[2], y);
    doc.text(formatMoney(c.montant) + '/mois', cols2[3], y);
    doc.setTextColor(37, 99, 235);
    doc.text(formatMoney(commRec) + '/mois', cols2[4], y);
    doc.setTextColor(80, 80, 80);
    doc.text(formatDate(c.date_debut), cols2[5], y);
    y += 5;
  });
  if (!recC.length) { doc.text('Aucun abonnement récurrent actif.', 15, y); y += 5; }
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(10, 22, 40);
  doc.text('Sous-total commissions récurrentes HT : ' + formatMoney(totalRec) + ' /mois', 15, y);
  y += 12;

  // === TOTAL TTC ===
  var totalHT = totalSig + totalRec;
  var totalTVA = Math.round(totalHT * 0.2 * 100) / 100;
  var totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;

  doc.setFontSize(11);
  doc.setTextColor(10, 22, 40);
  doc.text('Total commissions HT : ' + formatMoney(totalHT), 15, y);
  y += 6;
  doc.text('TVA 20 % : ' + formatMoney(totalTVA), 15, y);
  y += 6;
  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235);
  doc.text('TOTAL TTC À VERSER : ' + formatMoney(totalTTC), 15, y);
  y += 10;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Versement dans les 15 jours suivant la clôture du mois.', 15, y);
  y += 4;
  doc.text('Barème : SAFEDIRCOM-2026-V1 — En vigueur au 12 juin 2026.', 15, y);

  // === FOOTER ===
  var pages = doc.internal.getNumberOfPages();
  for (var p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('S@FE Digitalisation — SIRET 104 699 558 00011 — Document confidentiel', 15, 290);
    doc.text('Page ' + p + '/' + pages, 190, 290, { align: 'right' });
  }

  var filename = 'Bordereau_Commission_' + (u.prenom || 'user').replace(/\s+/g, '_') + '_' + moisLabel.replace(/\s+/g, '_') + '.pdf';
  doc.save(filename);
}

async function loadAdminUsers() {
  const { data, error } = await sb.rpc('admin_list_users');
  if (error) {
    alert("Erreur de chargement des utilisateurs : " + error.message);
    state.adminUsers = [];
    return;
  }
  state.adminUsers = data || [];
}

function renderAdminUsers() {
  const tbody = $('#admin-users-table tbody');
  if (!state.adminUsers.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Aucun utilisateur.</td></tr>';
    return;
  }
  const now = new Date();
  tbody.innerHTML = state.adminUsers.map(u => {
    const banned = u.banned_until && new Date(u.banned_until) > now;
    const isSelf = u.id === state.user.id;
    return `
      <tr class="${banned ? 'row-banned' : ''}">
        <td>${escapeHtml(u.prenom || '—')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td>${u.is_admin ? '<span class="badge badge-gold">Admin</span>' : '<span class="badge badge-gray">Utilisateur</span>'}</td>
        <td>${banned ? '<span class="badge badge-red">Révoqué</span>' : '<span class="badge badge-green">Actif</span>'}</td>
        <td class="nowrap mut" style="font-size:.82rem">${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
        <td class="actions">
          <button class="btn btn-out btn-sm" data-admin-message="${u.id}" ${isSelf ? 'disabled' : ''}>Message</button>
          <button class="btn btn-out btn-sm" data-admin-toggle-admin="${u.id}" ${isSelf ? 'disabled title="Vous ne pouvez pas vous rétrograder"' : ''}>${u.is_admin ? 'Rétrograder' : 'Promouvoir'}</button>
          <button class="btn ${banned ? 'btn-pri' : 'btn-out'} btn-sm" data-admin-ban="${u.id}|${banned ? '0' : '1'}" ${isSelf ? 'disabled' : ''}>${banned ? 'Restaurer' : 'Révoquer'}</button>
          <button class="btn btn-danger btn-sm" data-admin-delete="${u.id}" ${isSelf ? 'disabled title="Vous ne pouvez pas supprimer votre propre compte"' : ''}>Supprimer</button>
        </td>
      </tr>`;
  }).join('');
}

async function adminToggleAdmin(userId) {
  const u = state.adminUsers.find(x => x.id === userId);
  if (!u) return;
  if (!confirm(u.is_admin
    ? `Rétrograder ${u.prenom || u.email} ? Il/elle ne verra plus l'onglet Administration.`
    : `Promouvoir ${u.prenom || u.email} super-administrateur ? Il/elle aura accès à tous les chiffres et à la gestion des comptes.`)) return;
  const { error } = await sb.rpc('admin_set_admin', { target_user_id: userId, make_admin: !u.is_admin });
  if (error) { alert("Erreur : " + error.message); return; }
  await loadAdminUsers();
  renderAdminUsers();
}

async function adminDeleteUser(userId) {
  const u = state.adminUsers.find(x => x.id === userId);
  if (!u) return;
  const label = u.prenom || u.email;
  // Double confirmation pour une action irréversible
  if (!confirm(
    `⚠️ SUPPRESSION DÉFINITIVE\n\n` +
    `Vous êtes sur le point de supprimer définitivement le compte de ${label} (${u.email}).\n\n` +
    `Cette action est IRRÉVERSIBLE :\n` +
    `• Le compte et son profil seront supprimés\n` +
    `• Les contacts, contrats et tâches qu'il/elle a créés seront conservés mais perdront leur auteur\n` +
    `• Pour seulement bloquer la connexion (réversible), utilisez plutôt "Révoquer"\n\n` +
    `Continuer ?`
  )) return;
  // Confirmation explicite par saisie du prénom/email
  const typed = prompt(`Pour confirmer, tapez exactement : ${label}`);
  if (typed !== label) {
    alert("Suppression annulée (texte non identique).");
    return;
  }
  const { error } = await sb.rpc('admin_delete_user', { target_user_id: userId });
  if (error) { alert("Erreur : " + error.message); return; }
  alert(`✅ Compte ${label} supprimé définitivement.`);
  await loadAdminUsers();
  renderAdminUsers();
  // Recharger les profils pour mettre à jour "Ajouté par" dans les listes
  await loadAllProfiles();
  renderContacts();
  renderContracts();
}

async function adminToggleBan(userId, banned) {
  const u = state.adminUsers.find(x => x.id === userId);
  if (!u) return;
  if (!confirm(banned
    ? `Révoquer ${u.prenom || u.email} ? Il/elle ne pourra plus se connecter.`
    : `Restaurer l'accès pour ${u.prenom || u.email} ?`)) return;
  const { error } = await sb.rpc('admin_set_banned', { target_user_id: userId, banned });
  if (error) { alert("Erreur : " + error.message); return; }
  await loadAdminUsers();
  renderAdminUsers();
}

function openNewUserModal() {
  $('#nu-prenom').value = '';
  $('#nu-email').value = '';
  $('#nu-password').value = '';
  $('#nu-error').textContent = '';
  $('#new-user-modal').classList.add('show');
}

function closeNewUserModal() {
  $('#new-user-modal').classList.remove('show');
}

async function createNewUser() {
  const email = $('#nu-email').value.trim();
  const password = $('#nu-password').value;
  if (!password) { alert('Veuillez générer un mot de passe avant de créer le compte.'); return; }
  const prenom = $('#nu-prenom').value.trim();
  const makeAdmin = $('#nu-is-admin')?.checked || false;
  $('#nu-error').textContent = '';
  if (!email || !password) {
    $('#nu-error').textContent = "L'e-mail et le mot de passe sont obligatoires.";
    return;
  }
  if (password.length < 8) {
    $('#nu-error').textContent = "Le mot de passe doit faire au moins 8 caractères.";
    return;
  }

  // Appel de l'Edge Function admin-create-user (qui utilise l'API Auth Admin Supabase)
  $('#nu-error').textContent = 'Création en cours…';
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("Session expirée — reconnectez-vous.");

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email, password, prenom, is_admin: makeAdmin,
        denomination: $('#nu-denomination')?.value?.trim() || null,
        siret: $('#nu-siret')?.value?.trim() || null,
        adresse_pro: $('#nu-adresse')?.value?.trim() || null,
        tva: $('#nu-tva')?.value?.trim() || null,
     }),
      })

    let body = null;
    try { body = await resp.json(); } catch (_) {}

    if (resp.status === 404 || !body) {
      $('#nu-error').innerHTML =
        "❌ L'Edge Function <code>admin-create-user</code> n'est pas déployée." +
        "<br>Deux options :" +
        "<br>• Déployez la fonction (voir <code>supabase/functions/admin-create-user/README.md</code>)" +
        "<br>• Ou créez l'utilisateur manuellement : Supabase Dashboard → Authentication → Users → Add user, puis revenez ici pour le promouvoir.";
      return;
    }

    if (!resp.ok || body.error) {
      const code = body?.error || `HTTP ${resp.status}`;
      const details = body?.details || body?.reason || '';
      const map = {
        forbidden: "Accès refusé : votre compte n'a pas les droits super-administrateur.",
        invalid_email: "Format d'e-mail invalide.",
        password_too_short: "Mot de passe trop court (8 caractères minimum).",
        create_failed: `Création refusée par Supabase : ${details}`,
        missing_supabase_env: "Edge Function mal déployée (variables d'environnement manquantes).",
      };
      $('#nu-error').textContent = "❌ " + (map[code] || `${code} — ${details}`);
      return;
    }

    closeNewUserModal();
    await Promise.all([loadAdminUsers(), loadAllProfiles()]);
    renderAdminUsers();
    alert(`✅ Utilisateur ${email} créé avec succès.\n\nCommuniquez-lui ses identifiants. Il pourra changer son mot de passe via "Mot de passe oublié ?" depuis l'écran de connexion.`);
  } catch (e) {
    $('#nu-error').textContent = "❌ Erreur : " + (e.message || e);
  }
}

// ---- Messages admin → utilisateur ----
let _sendMessageTargetId = null;
function openSendMessageModal(userId) {
  const u = state.adminUsers.find(x => x.id === userId);
  if (!u) return;
  _sendMessageTargetId = userId;
  $('#sm-recipient-name').textContent = u.prenom || u.email;
  $('#sm-content').value = '';
  $('#sm-error').textContent = '';
  $('#send-message-modal').classList.add('show');
}

function closeSendMessageModal() {
  $('#send-message-modal').classList.remove('show');
  _sendMessageTargetId = null;
}

async function sendAdminMessage() {
  const content = $('#sm-content').value.trim();
  $('#sm-error').textContent = '';
  if (!content) { $('#sm-error').textContent = "Le message ne peut pas être vide."; return; }
  if (!_sendMessageTargetId) { $('#sm-error').textContent = "Destinataire introuvable."; return; }
  const { error } = await sb.from('messages').insert({
    sender_id: state.user.id,
    recipient_id: _sendMessageTargetId,
    content,
  });
  if (error) { $('#sm-error').textContent = "Erreur : " + error.message; return; }
  closeSendMessageModal();
  alert("Message envoyé. Il s'affichera en pop-up sur le tableau de bord du destinataire à sa prochaine connexion.");
}

// =========================================================
// MESSAGES ENTRANTS (pop-up à l'ouverture du dashboard)
// =========================================================
let _incomingQueue = [];

function showIncomingMessagesIfAny() {
  _incomingQueue = [...state.unreadMessages];
  if (_incomingQueue.length) showNextIncomingMessage();
}

function showNextIncomingMessage() {
  const msg = _incomingQueue.shift();
  if (!msg) {
    $('#incoming-message-modal').classList.remove('show');
    return;
  }
  const sender = state.profilesById?.[msg.sender_id]?.prenom || 'Administrateur';
  $('#im-sender').textContent = sender;
  $('#im-date').textContent = new Date(msg.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  $('#im-content').textContent = msg.content;
  $('#im-remaining').textContent = _incomingQueue.length
    ? `${_incomingQueue.length} autre(s) message(s) à lire.`
    : '';
  $('#im-next-btn').dataset.messageId = msg.id;
  $('#im-next-btn').textContent = _incomingQueue.length ? "Suivant →" : "J'ai lu — fermer";
  $('#incoming-message-modal').classList.add('show');
}

async function markCurrentMessageRead() {
  const id = $('#im-next-btn').dataset.messageId;
  if (id) {
    await sb.from('messages').update({ read: true }).eq('id', id);
  }
  showNextIncomingMessage();
}


// userId : id de l'utilisateur dont on calcule les chiffres.
//   - Si non précisé : utilisateur courant (state.user.id)
//   - Si === 'all'  : tous les utilisateurs cumulés (vue admin)
function computeObjectifValue(o, userId) {
  if (userId === undefined) userId = state.user?.id;
  const filterContact = c => userId === 'all' ? true : (c.created_by === userId);
  const filterContract = c => userId === 'all' ? true : (c.created_by === userId);

  switch (o.metric_type) {
    case 'nouveaux_clients':
      return state.contacts.filter(c => filterContact(c) && c.statut === 'Client' && isThisMonth(c.devenu_client_at || c.created_at)).length;
    case 'nouveaux_contacts':
      return state.contacts.filter(c => filterContact(c) && isThisMonth(c.created_at)).length;
    case 'contrats_total':
      return state.contracts.filter(c => filterContract(c) && ['Contrat en cours', 'Terminé'].includes(c.statut) && isThisMonth(c.date_debut || c.created_at)).length;
    case 'contrats_type':
      return state.contracts.filter(c => filterContract(c) && c.type === o.contract_type_filter && ['Contrat en cours', 'Terminé'].includes(c.statut) && isThisMonth(c.date_debut || c.created_at)).length;
    case 'taches_terminees':
      // Pas de created_by sur tasks : on retombe sur l'utilisateur courant uniquement
      if (userId === 'all') return state.tasks.filter(t => t.statut === 'Terminé' && isThisMonth(t.termine_at || t.created_at)).length;
      return state.tasks.filter(t => t.statut === 'Terminé' && isThisMonth(t.termine_at || t.created_at)).length;
    case 'ca_recurrent':
      return state.contracts
        .filter(c => filterContract(c) && c.recurrence === 'Mensuel' && ['Contrat en cours'].includes(c.statut))
        .reduce((sum, c) => sum + Math.max(0, (Number(c.montant) || 0) - (Number(c.remise) || 0)), 0);
    case 'ca_genere':
      return state.contracts
        .filter(c => filterContract(c) && ['Contrat en cours', 'Terminé'].includes(c.statut) && isThisMonth(c.date_debut || c.created_at))
        .reduce((sum, c) => sum + Math.max(0, (Number(c.montant) || 0) - (Number(c.remise) || 0)), 0);
    case 'commissions': {
      return computeMonthlyCommission(userId);
    }
    default:
      return 0;
  }
}

// Calcul des commissions du mois courant pour un utilisateur.
// Barème SAFEDIRCOM-2026-V1 (12 juin 2026) :
//
//   1. Commission à la signature (mois 1) :
//      → montant fixe (comm_signature_fix) si défini,
//      → sinon pourcentage du montant HT (comm_signature_pct).
//
//   2. Bonus fidélité (mois 4) :
//      → montant fixe (comm_bonus_fidelite) versé si le client
//        est toujours actif 3 mois après la date de début.
//        Clause anti-churn : pas de bonus si résiliation < 90j.
//
//   3. Commission récurrente (tous les mois actifs) :
//      → pourcentage du montant mensuel HT (comm_recurrent_pct).
//
function computeMonthlyCommission(userId) {
  if (userId === undefined) userId = state.user?.id;
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const contracts = state.contracts.filter(c =>
    (userId === 'all' || c.created_by === userId) &&
    ['Contrat en cours', 'Terminé'].includes(c.statut)
  );

  let total = 0;
  for (const c of contracts) {
    const preset = (FORMULE_PRESETS[c.type] || []).find(f => f.label === c.formule);
    const montant = Math.max(0, (Number(c.montant) || 0) - (Number(c.remise) || 0));
    const dateDebut = c.date_debut ? new Date(c.date_debut + 'T00:00:00') : null;
    const signedThisMonth = dateDebut && dateDebut >= startMonth && dateDebut <= endMonth;

    // --- 1. Commission à la signature (mois de signature uniquement) ---
    if (signedThisMonth) {
      if (preset?.comm_signature_fix != null && preset.comm_signature_fix > 0) {
        // Montant fixe (SEO, Cyber, DPO, Audits RGPD TPE/PME)
        total += preset.comm_signature_fix;
      } else if (preset?.comm_signature_pct > 0) {
        // Pourcentage du montant HT (Audit ETI sur devis, options à la carte)
        total += montant * preset.comm_signature_pct;
      } else if (!preset && montant > 0) {
        // Formule personnalisée : fallback 10 %
        total += montant * COMMISSION_FALLBACK.comm_signature_pct;
      }
    }

    // --- 2. Bonus fidélité (mois 4 = 3 mois après date_debut) ---
    if (dateDebut && preset?.comm_bonus_fidelite > 0) {
      const month4Start = new Date(dateDebut.getFullYear(), dateDebut.getMonth() + 3, 1);
      const month4End   = new Date(month4Start.getFullYear(), month4Start.getMonth() + 1, 0, 23, 59, 59);
      const isMonth4 = (startMonth <= month4End && endMonth >= month4Start);
      // Le contrat doit toujours être actif (pas résilié)
      if (isMonth4 && c.statut !== 'Résilié') {
        total += preset.comm_bonus_fidelite;
      }
    }

    // --- 3. Commission récurrente (tous les mois actifs) ---
    const recPct = preset?.comm_recurrent_pct ?? COMMISSION_FALLBACK.comm_recurrent_pct;
    if (c.recurrence === 'Mensuel' && recPct > 0 && dateDebut && dateDebut <= endMonth) {
      const dateEch = c.date_echeance ? new Date(c.date_echeance + 'T23:59:59') : null;
      if (!dateEch || dateEch >= startMonth) {
        total += montant * recPct;
      }
    }
  }
  return total;
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

  // N'affiche QUE les objectifs de l'utilisateur courant.
  const mine = state.objectifs.filter(o => o.user_id === state.user.id);
  const grid = $('#gauges-grid');
  if (!mine.length) {
    grid.innerHTML = '<p class="empty">Aucun objectif configuré. Si vous venez d\'arriver, rechargez la page : vos objectifs par défaut seront créés automatiquement.</p>';
    return;
  }
  grid.innerHTML = mine.map(o => {
    const value = computeObjectifValue(o);
    const target = computeObjectifTarget(o);
    const pct = target > 0 ? (value / target) * 100 : (value > 0 ? 100 : 0);
    const isMoney = ['ca_recurrent', 'ca_genere', 'commissions'].includes(o.metric_type);
    const valLabel = isMoney ? formatMoney(value) : value;
    const targetLabel = isMoney ? formatMoney(target) : target;
    return `
      <div class="gauge-card">
        <div class="gauge-wrap">${gaugeSvg(pct)}</div>
        <h4>${escapeHtml(o.metric_type === 'commissions' ? 'Commissions' : o.label)}</h4>
        <div class="gauge-values">${valLabel} / ${targetLabel}</div>
      </div>`;
  }).join('');

  // 🏆 Si l'objectif commission est atteint ce mois-ci, on lance le feu d'artifice
  checkAndCelebrateCommissions();
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
  const mine = state.objectifs.filter(o => o.user_id === state.user.id);
  // Seul l'objectif commission est modifiable par l'utilisateur
  const commObj = mine.find(o => o.metric_type === 'commissions');
  list.innerHTML = mine.map(o => {
    const isMoney = ['ca_recurrent', 'ca_genere', 'commissions'].includes(o.metric_type);
    const unit = (isMoney ? '€ ' : '') + (o.scale_by_days ? `/ ${o.jours_reference}j` : '');
    const editable = o.metric_type === 'commissions';
    let row = `
    <div class="objectif-row">
      <label>${escapeHtml(o.metric_type === 'commissions' ? 'Commissions' : o.label)}</label>
      <input type="number" step="0.01" min="0" data-objectif-id="${o.id}" value="${o.objectif_base}" ${editable ? '' : 'disabled style="opacity:.5"'}>
      <span class="unit">${unit}</span>
    </div>`;
    if (o.metric_type === 'commissions') {
      row += `
    <div class="objectif-row" style="padding-top:0">
      <label class="mut" style="font-size:.82rem">↳ Calcul automatique selon barème SAFEDIRCOM-2026-V1</label>
      <span class="unit" style="width:auto;font-family:var(--ff-mono)">grille</span>
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
  const inputs = $all('#objectifs-edit-list input[data-objectif-id]:not(:disabled)');
  for (const inp of inputs) {
    const { error } = await sb.from('objectifs')
      .update({ objectif_base: Number(inp.value) || 0 })
      .eq('id', inp.dataset.objectifId);
    if (error) return alert('Erreur : ' + error.message);
  }
  closeObjectifsModal();
  await loadObjectifs();
  renderObjectifs();
}

// =========================================================
// SÉCURITÉ — Protections côté navigateur
// (la vraie sécurité est côté serveur : RLS Supabase,
//  triggers, Edge Functions. Ces protections client sont
//  des barrières supplémentaires, pas des garanties.)
// =========================================================

// Empêcher l'accès direct aux variables globales via la console
Object.defineProperty(window, 'sb', { configurable: false, writable: false });
Object.defineProperty(window, 'state', { configurable: false, writable: false });

// Bloquer certains raccourcis DevTools en production
if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    // F12
    if (e.key === 'F12') { e.preventDefault(); return; }
    // Ctrl+Shift+I / Cmd+Opt+I (Inspecteur)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') { e.preventDefault(); return; }
    // Ctrl+Shift+J / Cmd+Opt+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') { e.preventDefault(); return; }
    // Ctrl+U / Cmd+U (View Source)
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); return; }
  });
}

// ---------------------------------------------------------
// ÉVÉNEMENTS
// ---------------------------------------------------------
// =========================================================
// FONCTIONNALITÉS COMPLÉMENTAIRES
// (assistance, RGPD utilisateur, confetti, inactivité,
//  bons de commande PDF, registre RGPD)
// =========================================================

// --- Bouton d'assistance ---
function openHelpModal() {
  $('#help-message').value = '';
  $('#help-modal').classList.add('show');
}

async function sendHelp() {
  const subject = $('#help-subject').value;
  const message = $('#help-message').value.trim();
  if (!message) { alert('Décrivez votre demande.'); return; }
  const btn = $('#help-send-btn');
  btn.disabled = true;
  btn.textContent = 'Envoi…';
  try {
    const { error } = await sb.from('help_requests').insert({
      user_id: state.user.id,
      sujet:   subject,
      message,
      statut:  'ouvert',
    });
    if (error) throw new Error(error.message);
    $('#help-modal').classList.remove('show');
    $('#help-message').value = '';
    alert('✅ Votre demande a été transmise à l\'administrateur.');
    await loadHelpRequests();
  } catch(e) {
    alert('Erreur : ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Envoyer';
  }
}

// --- Mes données (droits RGPD de l'utilisateur sur le CRM) ---
function openMyDataModal() {
  if (!state.user) return;
  const p = state.profile || {};
  const html = `
    <div class="field"><label>Prénom</label><input id="myd-prenom" type="text" value="${escapeHtml(p.prenom || '')}"></div>
    <div class="field-row">
      <div class="field"><label>E-mail (modifiable depuis votre profil)</label><input type="email" value="${escapeHtml(state.user.email || '')}" disabled></div>
      <div class="field"><label>Identifiant utilisateur</label><input type="text" value="${escapeHtml(state.user.id || '')}" disabled></div>
    </div>
    <div class="note" style="margin-top:6px">
      <b>Données traitées par S@FE pour le compte du CRM</b> :
      e-mail (authentification), prénom et photo de profil (interface), contacts/contrats/tâches/objectifs créés (responsabilité du CRM).
      Base légale : exécution du contrat de travail / mission (art. 6.1.b RGPD).
      Conservation : durée de la mission + 5 ans (obligations comptables).
      Vous disposez d'un droit d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité.
    </div>`;
  $('#mydata-content').innerHTML = html;
  $('#mydata-modal').classList.add('show');
}

async function saveMyData() {
  const prenom = $('#myd-prenom')?.value.trim() || null;
  const { error } = await sb.from('profiles')
    .update({ prenom })
    .eq('id', state.user.id);
  if (error) { alert('Erreur : ' + error.message); return; }
  state.profile.prenom = prenom;
  $('#mydata-modal').classList.remove('show');
  renderDashboard();
  if (typeof renderSidebarProfile === 'function') renderSidebarProfile();
}

function requestMyDataExport() {
  const subject = '[CRM RGPD] Demande sur mes données personnelles';
  const body = `Bonjour,\n\nJe souhaite exercer un de mes droits RGPD sur les données me concernant traitées par S@FE dans le CRM :\n\n  ☐ Accès (copie complète de mes données)\n  ☐ Rectification\n  ☐ Effacement (clôture de mon compte)\n  ☐ Portabilité (export structuré)\n  ☐ Opposition / limitation\n\nMon identifiant : ${state.user?.id || ''}\nMon e-mail : ${state.user?.email || ''}\n\nMerci de me confirmer la réception de cette demande et le délai de traitement (1 mois maximum prévu par l'article 12 du RGPD).\n\nCordialement.`;
  window.location.href = `mailto:contact@safe-digitalisation.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// --- Confetti + félicitations objectif commission atteint ---
function fireConfetti() {
  const c = $('#confetti-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  c.width = window.innerWidth; c.height = window.innerHeight;
  const colors = ['#f59e0b', '#fbbf24', '#3b82f6', '#22c55e', '#ef4444', '#a855f7'];
  const N = 180;
  const parts = Array.from({ length: N }, () => ({
    x: c.width / 2 + (Math.random() - 0.5) * 60,
    y: c.height / 2 + (Math.random() - 0.5) * 60,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 14 - 4,
    g: 0.35,
    r: Math.random() * 5 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  }));
  const start = performance.now();
  function frame(t) {
    const elapsed = t - start;
    ctx.clearRect(0, 0, c.width, c.height);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
      ctx.restore();
    });
    if (elapsed < 3000) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, c.width, c.height);
  }
  requestAnimationFrame(frame);
}

function checkAndCelebrateCommissions() {
  const o = state.objectifs?.find(o => o.metric_type === 'commissions');
  if (!o) return;
  const actual = computeObjectifValue(o);
  const target = computeObjectifTarget(o);
  if (target <= 0 || actual < target) return;
  // N'afficher qu'une fois par mois calendaire et par utilisateur
  const ym = new Date().toISOString().slice(0, 7);
  const key = `safecrm.celebrated.${state.user?.id}.${ym}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  $('#felicitations-detail').textContent =
    `Vous avez atteint ${Math.round(actual).toLocaleString('fr-FR')} € sur ${Math.round(target).toLocaleString('fr-FR')} € d'objectif. Bravo !`;
  $('#felicitations-modal').classList.add('show');
  fireConfetti();
}

// --- Déconnexion par inactivité (5 minutes) ---
let _inactivityTimer = null;
const INACTIVITY_MS = 5 * 60 * 1000;
function resetInactivity() {
  clearTimeout(_inactivityTimer);
  if (!state.user) return;
  _inactivityTimer = setTimeout(async () => {
    await sb.auth.signOut();
    alert('Session expirée après 5 minutes d\'inactivité. Veuillez vous reconnecter.');
    location.reload();
  }, INACTIVITY_MS);
}
function setupInactivityTimeout() {
  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(evt => {
    window.addEventListener(evt, resetInactivity, { passive: true });
  });
  // Si l'utilisateur ferme l'onglet → la session reste valide côté Supabase
  // mais on déclenche un signOut quand il revient si > 5 min d'inactivité
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.user) {
      const last = Number(localStorage.getItem('safecrm.lastActivity') || 0);
      if (last && Date.now() - last > INACTIVITY_MS) {
        sb.auth.signOut().then(() => {
          alert('Session expirée. Veuillez vous reconnecter.');
          location.reload();
        });
        return;
      }
    }
  });
  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(evt => {
    window.addEventListener(evt, () => localStorage.setItem('safecrm.lastActivity', Date.now()), { passive: true });
  });
  resetInactivity();
}

// =========================================================
// TRANSFERT DE CLIENT (propriétaire ou admin)
// =========================================================

function openTransferModal() {
  const id = $('#c-id').value;
  if (!id) return;
  const c = state.contacts.find(x => x.id === id);
  if (!c) return;
  if (!canEditContact(c)) {
    alert("Vous ne pouvez transférer que les clients dont vous êtes propriétaire.");
    return;
  }
  // Construction de la liste des destinataires (exclut le propriétaire actuel)
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
  const contactId = state._transferContactId;
  const targetUserId = $('#transfer-target').value;
  if (!contactId || !targetUserId) return;
  const c = state.contacts.find(x => x.id === contactId);
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
  // Recharge complète pour refléter les nouvelles propriétés
  await loadAll();
}

// --- Envoi du bon de commande au client (lien de paiement Stripe) ---
async function sendOrderLink() {
  const id = $('#ct-id').value;
  if (!id) { alert('Enregistrez le contrat avant de l\'envoyer.'); return; }
  const contract = state.contracts.find(c => c.id === id);
  if (!contract) { alert('Contrat introuvable.'); return; }
  const contact = state.contacts.find(c => c.id === contract.contact_id);
  if (!contact) { alert('Contact lié introuvable.'); return; }
  if (!contact.email) { alert("Le contact n'a pas d'e-mail. Ajoutez-le avant d'envoyer le bon de commande."); return; }

  if (!confirm(
    `Créer un lien de paiement pour ${contact.nom || '—'} (${contact.email}) ?\n\n` +
    `Produit : ${contract.type || '—'} — ${contract.formule || '—'}\n` +
    `Montant : ${Number(contract.montant || 0).toFixed(2)} € HT${contract.recurrence === 'Mensuel' ? ' / mois' : ''}\n\n` +
    `Un lien sera généré. Le contrat doit rester en statut "Devis envoyé" pour que le client puisse y accéder.`
  )) return;

  // L'UUID du contrat sert de token (déjà aléatoire et indevinable)
  const orderUrl = `${location.origin}/order.html?id=${contract.id}&name=${encodeURIComponent(contact.nom || '')}&email=${encodeURIComponent(contact.email || '')}&entreprise=${encodeURIComponent(contact.entreprise || '')}&siret=${encodeURIComponent(contact.siret || '')}`;

  // Copie dans le presse-papier
  try { await navigator.clipboard.writeText(orderUrl); } catch (_) {}

  // Ouvre le client mail avec le lien pré-rempli
  const subject = encodeURIComponent(`Votre bon de commande S@FE — ${contract.type}${contract.formule ? ' ' + contract.formule : ''}`);
  const body = encodeURIComponent(
    `Bonjour ${contact.nom || ''},\n\n` +
    `Veuillez trouver ci-dessous le lien vers votre bon de commande S@FE :\n\n` +
    `${orderUrl}\n\n` +
    `Ce lien vous permettra de :\n` +
    `• Consulter le récapitulatif de votre commande\n` +
    `• Lire et accepter nos Conditions Générales de Vente\n` +
    `• Procéder au paiement sécurisé en ligne (CB / SEPA)\n\n` +
    `Pour toute question, n'hésitez pas à me contacter.\n\n` +
    `Cordialement,\n` +
    `${state.profile?.prenom || 'L\'équipe S@FE'}\n` +
    `S@FE Digitalisation\n` +
    `01 84 16 26 29 — contact@safe-digitalisation.fr`
  );
  window.location.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;

  await sb.from('contracts').update({ statut: 'Envoyé' }).eq('id', contract.id);

  alert(
    `✅ Lien créé et copié dans le presse-papier !\n\n` +
    `Votre client mail s'est ouvert avec le lien pré-rempli.\n` +
    `Vous pouvez aussi coller le lien dans WhatsApp ou un SMS.\n\n` +
    `Lien : ${orderUrl}`
  );
}

// --- Bon de commande PDF (Bon de commande + CGV combinés) ---
function generateContractPDF() {
  const id = $('#ct-id').value;
  if (!id) { 
    alert('Enregistrez le contrat avant de générer le bon de commande.'); 
    return; 
  }
  
  const contract = state.contracts.find(c => c.id === id);
  if (!contract) { 
    alert('Contrat introuvable.'); 
    return; 
  }
  
  const contact = state.contacts.find(c => c.id === contract.contact_id);
  if (!contact) { 
    alert('Contact lié introuvable.'); 
    return; 
  }
  
  // Validation des mentions légales obligatoires sur une facture/bon de commande (Facturation)
  if (!contact.siret || !contact.code_postal_ville) {
    if (!confirm("Le SIRET ou l'adresse de facturation (code postal + ville) du client ne sont pas renseignés. Les bons de commande doivent comporter ces mentions obligatoires.\n\nGénérer quand même un PDF avec lignes à compléter manuellement ?")) {
      return;
    }
  }
  
  // Appel du générateur de PDF (Vérifiez bien que votre fichier contract-pdf.js attend les mêmes propriétés)
  const res = window.ContractPDF.generate({
    id: contract.id, // Transmet l'UUID qui sera utilisé par slice(0,8) pour la Réf BON-XXXXXXXX
    type: contract.type,
    formule: contract.formule,
    montant: contract.montant,
    recurrence: contract.recurrence,
    frais_mise_en_place: contract.frais_mise_en_place,
    engagement_mois: contract.engagement_mois,
    remise: contract.remise,
  }, contact);
  
  if (res && res.filename) {
    alert(`Bon de commande téléchargé : ${res.filename}`);
  }
}
// =========================================================
// DOUBLE AUTHENTIFICATION TOTP (QR code)
// =========================================================

async function refreshTOTPStatus() {
  if (!state.user) return;
  try {
    const { data } = await sb.auth.mfa.listFactors();
    const verified = (data?.totp || []).filter(f => f.status === 'verified');
    const enrolled = verified.length > 0;
    state._totpFactors = data?.totp || [];
    $('#totp-status-label').textContent = enrolled
      ? '🔒 2FA activée — appli d\'authentification requise à chaque connexion.'
      : 'Non activée — appuyez sur le bouton pour scanner un QR code.';
    $('#totp-enroll-btn').style.display = enrolled ? 'none' : 'inline-flex';
    $('#totp-disable-btn').style.display = enrolled ? 'inline-flex' : 'none';
  } catch (e) { console.warn('listFactors:', e); }
}

async function openTotpEnroll() {
  const err = $('#totp-enroll-error'); err.style.display = 'none';
  $('#totp-code').value = '';
  try {
    // 1. Lister les facteurs déjà existants pour cet utilisateur
    const { data: factorsData, error: listErr } = await sb.auth.mfa.listFactors();
    if (listErr) { alert("Erreur (listFactors) : " + (listErr.message || JSON.stringify(listErr))); console.error(listErr); return; }
    const allTotp = (factorsData?.totp) || [];

    // S'il existe déjà un facteur vérifié, on bloque
    const verified = allTotp.find(f => f.status === 'verified');
    if (verified) {
      alert("Votre compte a déjà la 2FA activée. Désactivez-la d'abord pour en enregistrer une nouvelle.");
      return;
    }

    // Nettoyer les anciens enrôlements non vérifiés (Supabase n'autorise qu'un seul facteur en cours)
    for (const f of allTotp) {
      if (f.status !== 'verified') {
        try { await sb.auth.mfa.unenroll({ factorId: f.id }); }
        catch (e) { console.warn('unenroll cleanup:', e); }
      }
    }

    // 2. Démarrer un nouvel enrôlement (sans friendlyName pour éviter les conflits de doublon)
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      alert("Erreur Supabase MFA : " + (error.message || JSON.stringify(error)) + "\n\nLog technique : " + JSON.stringify(error));
      console.error('mfa.enroll error:', error);
      return;
    }
    if (!data?.totp) {
      alert("Réponse inattendue de Supabase : aucun QR code retourné. Vérifiez que MFA TOTP est bien activé dans Authentication → Settings → Multi-Factor Authentication.\n\nRéponse reçue : " + JSON.stringify(data));
      console.error('mfa.enroll unexpected:', data);
      return;
    }

    state._totpEnrollFactorId = data.id;

    // 3. Affichage du QR code
    const otpauth = data.totp.uri;
    const container = $('#totp-qr'); container.innerHTML = '';

    // Plan A : librairie qrcode.js (canvas)
    if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
      const canvas = document.createElement('canvas');
      await window.QRCode.toCanvas(canvas, otpauth, { width: 220, margin: 1, color: { dark: '#0a1628', light: '#ffffff' } });
      container.appendChild(canvas);
    }
    // Plan B : qr_code envoyé par Supabase en SVG dataURL (selon version SDK)
    else if (data.totp.qr_code) {
      const img = document.createElement('img');
      img.src = data.totp.qr_code;
      img.alt = 'QR code TOTP';
      img.style.cssText = 'width:220px;height:220px;background:#fff;padding:10px;border-radius:8px';
      container.appendChild(img);
    }
    // Plan C : générateur en ligne (sans réseau utilisateur)
    else {
      const img = document.createElement('img');
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(otpauth);
      img.alt = 'QR code TOTP';
      img.style.cssText = 'background:#fff;padding:10px;border-radius:8px';
      container.appendChild(img);
    }

    // Fallback texte si rien ne s'affiche (au pire l'utilisateur peut taper la clé manuellement)
    const hint = document.createElement('p');
    hint.className = 'mut';
    hint.style.cssText = 'font-size:.78rem;margin-top:8px;text-align:center';
    hint.textContent = "Si le QR code ne s'affiche pas, saisissez la clé secrète ci-dessous dans votre application.";
    container.appendChild(hint);

    $('#totp-secret').value = data.totp.secret;
    $('#totp-enroll-modal').classList.add('show');

  } catch (e) {
    // Erreur non Supabase (ex. réseau, lib non chargée)
    alert("Exception lors de l'enrôlement TOTP : " + (e.message || e) + "\n\nVoir la console (F12) pour le détail technique.");
    console.error('openTotpEnroll exception:', e);
  }
}

async function verifyTotpEnroll() {
  const err = $('#totp-enroll-error'); err.style.display = 'none';
  const code = $('#totp-code').value.trim();
  const factorId = state._totpEnrollFactorId;
  if (!factorId) { err.textContent = "Aucun enrôlement en cours."; err.style.display = 'block'; return; }
  if (!/^\d{6}$/.test(code)) { err.textContent = "Saisissez un code à 6 chiffres."; err.style.display = 'block'; return; }
  try {
    const ch = await sb.auth.mfa.challenge({ factorId });
    if (ch.error) throw ch.error;
    const v = await sb.auth.mfa.verify({ factorId, challengeId: ch.data.id, code });
    if (v.error) throw v.error;
    $('#totp-enroll-modal').classList.remove('show');
    alert('✅ Double authentification activée. Vous devrez désormais saisir un code à 6 chiffres à chaque connexion.');
    refreshTOTPStatus();
  } catch (e) {
    err.textContent = 'Code refusé : ' + (e.message || e);
    err.style.display = 'block';
  }
}

async function disableTotp() {
  if (!confirm("Désactiver la double authentification ? Vous pourrez la réactiver à tout moment.")) return;
  try {
    const factors = state._totpFactors || [];
    for (const f of factors) {
      await sb.auth.mfa.unenroll({ factorId: f.id });
    }
    alert('Double authentification désactivée.');
    refreshTOTPStatus();
  } catch (e) { alert('Erreur : ' + (e.message || e)); }
}

// Vérification TOTP après login (appelé depuis handleLogin)
async function challengeTOTPIfNeeded() {
  try {
    const { data: aalData } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aalData) return true;
    if (aalData.currentLevel === aalData.nextLevel) return true;
    // L'utilisateur a un facteur TOTP non vérifié pour cette session — challenger
    const { data: factorsData } = await sb.auth.mfa.listFactors();
    const totp = (factorsData?.totp || []).find(f => f.status === 'verified');
    if (!totp) return true;
    return await new Promise((resolve) => {
      const modal = $('#totp-challenge-modal');
      const err = $('#totp-challenge-error'); err.style.display = 'none';
      $('#totp-challenge-code').value = '';
      modal.classList.add('show');
      $('#totp-challenge-cancel').onclick = async () => {
        modal.classList.remove('show');
        await sb.auth.signOut();
        resolve(false);
      };
      $('#totp-challenge-verify').onclick = async () => {
        const code = $('#totp-challenge-code').value.trim();
        if (!/^\d{6}$/.test(code)) { err.textContent = 'Code à 6 chiffres.'; err.style.display = 'block'; return; }
        try {
          const ch = await sb.auth.mfa.challenge({ factorId: totp.id });
          if (ch.error) throw ch.error;
          const v = await sb.auth.mfa.verify({ factorId: totp.id, challengeId: ch.data.id, code });
          if (v.error) throw v.error;
          modal.classList.remove('show');
          resolve(true);
        } catch (e) {
          err.textContent = 'Code refusé : ' + (e.message || e);
          err.style.display = 'block';
        }
      };
    });
  } catch (e) { console.warn('AAL check:', e); return true; }
}

// --- Registre RGPD (Article 30) ---
const REGISTRE_RGPD = [
  {
    traitement: 'Gestion des comptes utilisateurs du CRM',
    finalite: "Permettre l'authentification et l'usage du CRM par les commerciaux S@FE",
    base: "Exécution du contrat de travail / mission (art. 6.1.b RGPD)",
    categories: "E-mail, prénom, photo de profil, journaux de connexion",
    destinataires: "Direction S@FE, hébergeur Supabase (sous-traitant)",
    duree: "Durée du contrat + 5 ans (obligations comptables)",
    securite: "Authentification chiffrée, RLS Postgres, chiffrement en transit (TLS), MFA optionnelle"
  },
  {
    traitement: 'Gestion des contacts (prospects et clients)',
    finalite: "Suivi commercial, mise en relation, exécution des contrats",
    base: "Intérêt légitime (prospection BtoB) / exécution du contrat (clients) (art. 6.1.f et 6.1.b)",
    categories: "Nom, prénom, entreprise, e-mail, téléphone, adresse, SIRET, consentements, notes commerciales",
    destinataires: "Commerciaux S@FE habilités, hébergeur Supabase",
    duree: "3 ans après dernier contact (prospects) — durée du contrat + 5 ans (clients)",
    securite: "RLS par rôle, journalisation des accès, droit d'opposition (RGPD KO) avec effacement immédiat des coordonnées"
  },
  {
    traitement: 'Gestion des contrats commerciaux',
    finalite: "Suivi de la relation contractuelle et facturation",
    base: "Exécution du contrat (art. 6.1.b)",
    categories: "Type de prestation, formule, montant, dates, statut, lien vers le contact",
    destinataires: "Commerciaux S@FE, direction, comptabilité",
    duree: "Durée du contrat + 10 ans (pièces comptables)",
    securite: "RLS, sauvegardes chiffrées Supabase, historique des modifications"
  },
  {
    traitement: 'Suivi des objectifs commerciaux',
    finalite: "Pilotage individuel de la performance commerciale",
    base: "Intérêt légitime de l'employeur (art. 6.1.f)",
    categories: "Identifiant utilisateur, métriques agrégées (nb contacts, CA généré, commissions)",
    destinataires: "Commercial concerné (ses propres chiffres) et super-administrateur S@FE",
    duree: "5 ans glissants",
    securite: "RLS stricte (un utilisateur ne voit que ses propres chiffres ; seul l'admin voit l'ensemble)"
  },
  {
    traitement: 'Messagerie interne (notifications admin)',
    finalite: "Information ponctuelle des utilisateurs par la direction",
    base: "Intérêt légitime",
    categories: "Identifiant émetteur, identifiant destinataire, contenu du message",
    destinataires: "Destinataire et émetteur uniquement",
    duree: "1 an après lecture",
    securite: "RLS, accès journalisé"
  },
];

function renderRegistreRGPD() {
  const tbody = $('#registre-rgpd-body');
  if (!tbody) return;
  tbody.innerHTML = REGISTRE_RGPD.map(r => `
    <tr>
      <td><b>${escapeHtml(r.traitement)}</b></td>
      <td>${escapeHtml(r.finalite)}</td>
      <td>${escapeHtml(r.base)}</td>
      <td>${escapeHtml(r.categories)}</td>
      <td>${escapeHtml(r.destinataires)}</td>
      <td>${escapeHtml(r.duree)}</td>
      <td>${escapeHtml(r.securite)}</td>
    </tr>`).join('');
}

function exportRegistrePDF() {
  if (!window.jspdf) { alert('jsPDF non chargé.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(10, 22, 40);
  doc.text('Registre des activités de traitement — S@FE SAS (CRM)', 15, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')} — Responsable de traitement : S@FE SAS — SIRET 104 699 558 00011`, 15, 24);
  let y = 32;
  REGISTRE_RGPD.forEach((r, i) => {
    if (y > 180) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(10, 22, 40);
    doc.text(`${i + 1}. ${r.traitement}`, 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    [
      ['Finalité', r.finalite],
      ['Base légale', r.base],
      ['Catégories de données', r.categories],
      ['Destinataires', r.destinataires],
      ['Durée de conservation', r.duree],
      ['Mesures de sécurité', r.securite],
    ].forEach(([k, v]) => {
      const lines = doc.splitTextToSize(`${k} : ${v}`, 260);
      lines.forEach(l => { doc.text(l, 18, y); y += 4.2; });
    });
    y += 3;
  });
  doc.save(`registre-rgpd-safe-${new Date().toISOString().slice(0,10)}.pdf`);
}

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

  // Navigation (uniquement les liens de la sidebar — pas les sous-onglets admin
  // qui ont `data-admin-tab` mais portent aussi la classe .navlink pour le style)
  $all('.navlink[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));

  // Filtres
  ['contacts-search', 'contacts-filter-activite'].forEach(id => {
    $('#' + id).addEventListener('input', renderContacts);
  });
  ['contracts-filter-statut', 'contracts-filter-recurrence'].forEach(id => {
    $('#' + id).addEventListener('input', renderContracts);
  });
  $('#tasks-filter-assigne').addEventListener('input', renderTasks);
// Auto-complétion ville par code postal (API Géo gouv.fr)
  $('#c-code-postal')?.addEventListener('input', async function() {
    const cp = this.value.trim();
    const sel = $('#c-ville');
    if (cp.length !== 5 || !/^\d{5}$/.test(cp)) {
      sel.innerHTML = '<option value="">Saisissez un code postal (5 chiffres)</option>';
      return;
    }
    sel.innerHTML = '<option value="">Recherche…</option>';
    try {
      const resp = await fetch('https://geo.api.gouv.fr/communes?codePostal=' + cp + '&fields=nom&format=json');
      const communes = await resp.json();
      if (!communes.length) {
        sel.innerHTML = '<option value="">Aucune commune trouvée</option>';
        return;
      }
      sel.innerHTML = communes.map(function(c) { return '<option value="' + c.nom + '">' + c.nom + '</option>'; }).join('');
      $('#c-code-postal-ville').value = cp + ' ' + sel.value;
    } catch (e) {
      sel.innerHTML = '<option value="">Erreur de recherche</option>';
    }
  });
  $('#c-ville')?.addEventListener('change', function() {
    var cp = $('#c-code-postal').value.trim();
    $('#c-code-postal-ville').value = cp + ' ' + this.value;
  });
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
  $('#ct-date-debut').addEventListener('change', autoCalcEcheance);
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
  $('#t-type').addEventListener('change', onTaskTypeChange);

  // Profil utilisateur
  $('#profile-btn').addEventListener('click', openProfileModal);
  $('#profile-cancel-btn').addEventListener('click', closeProfileModal);
  $('#profile-save-btn').addEventListener('click', saveProfile);
  $('#profile-photo-input').addEventListener('change', previewProfilePhoto);
  $('#password-save-btn').addEventListener('click', changePassword);

  // Objectifs
  $('#save-jours-btn').addEventListener('click', saveJoursTravailles);
  $('#btn-edit-objectifs')?.addEventListener('click', openObjectifsModal);
  $('#objectifs-cancel-btn').addEventListener('click', closeObjectifsModal);
  $('#objectifs-save-btn').addEventListener('click', saveObjectifsModal);

  // --- Administration ---
  $all('[data-admin-tab]').forEach(b => b.addEventListener('click', () => switchAdminTab(b.dataset.adminTab)));
  $('#btn-new-user').addEventListener('click', openNewUserModal);
  $('#new-user-cancel-btn').addEventListener('click', closeNewUserModal);
  $('#new-user-save-btn').addEventListener('click', createNewUser);
  $('#send-message-cancel-btn').addEventListener('click', closeSendMessageModal);
  $('#send-message-send-btn').addEventListener('click', sendAdminMessage);
  $('#im-next-btn').addEventListener('click', markCurrentMessageRead);

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

    const msgBtn = e.target.closest('[data-admin-message]');
    if (msgBtn) return openSendMessageModal(msgBtn.dataset.adminMessage);

    const banBtn = e.target.closest('[data-admin-ban]');
    if (banBtn) {
      const [uid, flag] = banBtn.dataset.adminBan.split('|');
      return adminToggleBan(uid, flag === '1');
    }

    const toggleAdmBtn = e.target.closest('[data-admin-toggle-admin]');
    if (toggleAdmBtn) return adminToggleAdmin(toggleAdmBtn.dataset.adminToggleAdmin);

    const deleteBtn = e.target.closest('[data-admin-delete]');
    if (deleteBtn) return adminDeleteUser(deleteBtn.dataset.adminDelete);
  });

  // Fermeture des modales en cliquant en dehors
  $all('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $all('.modal.show').forEach(m => m.classList.remove('show'));
  });

  // === Bouton flottant d'assistance ===
  $('#help-fab')?.addEventListener('click', openHelpModal);
  $('#help-cancel-btn')?.addEventListener('click', () => $('#help-modal').classList.remove('show'));
  $('#help-send-btn')?.addEventListener('click', sendHelp);

  // === Mes données (RGPD utilisateur) ===
  $('#open-mydata-btn')?.addEventListener('click', openMyDataModal);
  $('#mydata-cancel-btn')?.addEventListener('click', () => $('#mydata-modal').classList.remove('show'));
  $('#mydata-save-btn')?.addEventListener('click', saveMyData);
  $('#mydata-request-btn')?.addEventListener('click', requestMyDataExport);

  // === Félicitations objectif atteint ===
  $('#felicitations-close-btn')?.addEventListener('click', () => $('#felicitations-modal').classList.remove('show'));

  // === Bon de commande PDF ===
  $('#contract-pdf-btn')?.addEventListener('click', generateContractPDF);
  $('#contract-send-btn')?.addEventListener('click', sendOrderLink);

  // === Transfert de client ===
  $('#contact-transfer-btn')?.addEventListener('click', openTransferModal);
  $('#transfer-cancel-btn')?.addEventListener('click', () => $('#transfer-modal').classList.remove('show'));
  $('#transfer-confirm-btn')?.addEventListener('click', confirmTransferContact);

  // === Double authentification TOTP ===
  $('#totp-enroll-btn')?.addEventListener('click', openTotpEnroll);
  $('#totp-disable-btn')?.addEventListener('click', disableTotp);
  $('#totp-enroll-cancel')?.addEventListener('click', () => $('#totp-enroll-modal').classList.remove('show'));
  $('#totp-enroll-verify')?.addEventListener('click', verifyTotpEnroll);

  // === Onglet Registre RGPD ===
  $('#btn-export-registre')?.addEventListener('click', exportRegistrePDF);

  // === Onglet Résultats ===
  $('#resultats-back-btn')?.addEventListener('click', renderResultats);
  $('#resultats-bordereau-btn')?.addEventListener('click', generateBordereauCommission);

  // === Suivi client : interactions ===
  document.getElementById('btn-add-interaction')?.addEventListener('click', () => {
    const contactId = document.getElementById('c-id').value;
    openInteractionModal(contactId);
  });
  document.getElementById('int-cancel-btn')?.addEventListener('click', closeInteractionModal);
  document.getElementById('int-save-btn')?.addEventListener('click', saveInteraction);
  document.getElementById('int-delete-btn')?.addEventListener('click', deleteInteraction);

  // === Résiliation abonnement Stripe ===
  document.getElementById('contract-resilier-btn')?.addEventListener('click', () => {
    const contractId = document.getElementById('contract-resilier-btn').dataset.contractId;
    openResilierModal(contractId);
  });
  document.getElementById('resilier-cancel-btn')?.addEventListener('click', closeResilierModal);
  document.getElementById('resilier-confirm-btn')?.addEventListener('click', confirmResilierAbonnement);

  // === Portail client Stripe ===
  document.getElementById('contract-portal-btn')?.addEventListener('click', () => {
    const contractId = document.getElementById('contract-portal-btn').dataset.contractId;
    openCustomerPortal(contractId);
  });

  // === Bordereaux (rechargement si changement période géré dans loadBordereaux) ===

  // === Réinitialisation données test ===
  setupResetConfirmInput();

  // === Changement de mot de passe ===
  document.getElementById('cp-save-btn')?.addEventListener('click', saveNewPassword);
  setupPasswordValidation();

  // === Proposition 2FA ===
  document.getElementById('totp-propose-skip')?.addEventListener('click', async () => {
    document.getElementById('totp-propose-modal')?.classList.remove('show');
    await checkProfilCompleted();
  });
  document.getElementById('totp-propose-activate')?.addEventListener('click', async () => {
    document.getElementById('totp-propose-modal')?.classList.remove('show');
    await openTotpEnroll();
    await checkProfilCompleted();
  });

  // === Déconnexion par inactivité (5 min) ===
  setupInactivityTimeout();
}

// ==========================================================================
// SUIVI CLIENT — Interactions & RGPD automatique
// ==========================================================================

async function checkRgpdExpiry() {
  try {
    await sb.rpc('check_rgpd_expiry');
    await loadContacts();
  } catch(e) {
    console.warn('check_rgpd_expiry:', e.message);
  }
}

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


// ==========================================================================
// RÉSILIATION ABONNEMENT STRIPE
// ==========================================================================

function openResilierModal(contractId) {
  document.getElementById('resilier-contract-id').value = contractId;
  document.getElementById('resilier-modal').classList.add('show');
}

function closeResilierModal() {
  document.getElementById('resilier-modal').classList.remove('show');
}

async function confirmResilierAbonnement() {
  const contractId = document.getElementById('resilier-contract-id').value;
  const btn = document.getElementById('resilier-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Résiliation en cours…';

  try {
    // 1. Sauvegarder d'abord les modifications du contrat si payload en attente
    if (window._pendingResilierPayload && window._pendingResilierContractId === contractId) {
      const { error: saveErr } = await sb.from('contracts').update(window._pendingResilierPayload).eq('id', contractId);
      if (saveErr) throw new Error(saveErr.message);
      window._pendingResilierPayload    = null;
      window._pendingResilierContractId = null;
    }

    const contract = state.contracts.find(c => c.id === contractId) || { id: contractId };
    // Recharger pour avoir les données à jour
    await loadContracts();
    const contractFresh = state.contracts.find(c => c.id === contractId);

    if (contractFresh?.stripe_subscription_id && !contractFresh?.resilié_at) {
      // Abonnement Stripe actif → appel Edge Function
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ contract_id: contractId, cancelled_by: state.profile?.prenom || state.user?.email || 'Admin' }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.details || result.error || 'Erreur inconnue');
      const msg = result.period_end
        ? `✅ Résiliation enregistrée. L'abonnement se terminera le ${formatDate(result.period_end)}.`
        : '✅ Résiliation enregistrée. Le client ne sera plus débité à la prochaine échéance.';
      alert(msg);
    } else {
      // Pas d'abonnement Stripe → résiliation directe dans Supabase
      const { error } = await sb.from('contracts').update({
        statut: 'Terminé',
        resilié_at: new Date().toISOString(),
      }).eq('id', contractId);
      if (error) throw new Error(error.message);
      if (contract?.contact_id) {
        await sb.from('interactions').insert({
          contact_id: contractFresh.contact_id,
          created_by: state.user.id,
          type: 'Autre',
          date: new Date().toISOString().slice(0,10),
          objet: 'Résiliation contrat',
          contenu: 'Contrat résilié manuellement par l\'administrateur.',
          suite_a_donner: null,
        });
      }
      alert('✅ Contrat résilié.');
    }

    closeResilierModal();
    await loadContracts();
    await loadInteractions();
    renderContracts();
  } catch(e) {
    alert('Erreur : ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmer la résiliation';
  }
}


// ==========================================================================
// PORTAIL CLIENT STRIPE
// ==========================================================================

async function openCustomerPortal(contractId) {
  const btn = document.getElementById('contract-portal-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Génération du lien…'; }

  try {
    const { data: { session } } = await sb.auth.getSession();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ contract_id: contractId }),
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result.details || result.error || 'Erreur inconnue');

    // Copier le lien dans le presse-papier
    await navigator.clipboard.writeText(result.url);
    alert('✅ Lien copié dans le presse-papier !\n\nEnvoyez-le au client par email :\n' + result.url);
  } catch(e) {
    alert('Erreur : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Portail client'; }
  }
}


// ==========================================================================
// BORDEREAUX DE COMMISSION — Gestion admin
// ==========================================================================

// Calcule l'avant-dernier jour ouvré du mois donné
function avantDernierJourOuvre(year, month) {
  // Partir du dernier jour du mois et remonter
  let joursOuvres = 0;
  let d = new Date(year, month, 0); // dernier jour du mois
  while (joursOuvres < 2) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) joursOuvres++; // lundi-vendredi
    if (joursOuvres < 2) d.setDate(d.getDate() - 1);
  }
  return d;
}

async function loadBordereaux() {
  if (!isAdmin()) return;

  // Vérifier si on est à partir de l'avant-dernier jour ouvré du mois courant
  const now = new Date();
  const avantDernier = avantDernierJourOuvre(now.getFullYear(), now.getMonth() + 1);
  const isAlertePeriode = now >= avantDernier;

  // Construire la liste des 6 derniers mois pour le select
  const sel = document.getElementById('bordereau-periode');
  if (!sel) return;
  const opts = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    opts.push(`<option value="${val}">${label.charAt(0).toUpperCase() + label.slice(1)}</option>`);
  }
  sel.innerHTML = opts.join('');
  sel.addEventListener('change', renderBordereaux);

  // N'afficher l'alerte que si on est dans la fenêtre de l'avant-dernier jour ouvré
  if (!isAlertePeriode) {
    const block = document.getElementById('bordereaux-alert');
    if (block) block.style.display = 'none';
    return;
  }

  await renderBordereaux();
}

async function renderBordereaux() {
  const sel = document.getElementById('bordereau-periode');
  if (!sel) return;
  const periode = sel.value;
  const block   = document.getElementById('bordereaux-alert');
  const list    = document.getElementById('bordereaux-list');
  if (!block || !list) return;

  try {
    const { data, error } = await sb.rpc('get_pending_bordereaux', { p_periode: periode });
    if (error) throw error;

    const users = data || [];
    if (!users.length) { block.style.display = 'none'; return; }

    block.style.display = 'block';
    list.innerHTML = users.map(u => {
      const sent = u.sent_at;
      const sentLabel = sent
        ? `<span class="badge badge-ok">✅ Envoyé le ${formatDate(sent.slice(0,10))}</span>`
        : `<span class="badge badge-red">⏳ En attente</span>`;
      return `<div class="mini-item">
        <div>
          <div class="t">${escapeHtml(u.prenom || u.email)}</div>
          <div class="s">${escapeHtml(u.email)} — Période : ${escapeHtml(periode)}</div>
        </div>
        ${sentLabel}
        <button class="btn btn-out btn-sm" style="margin-left:8px;font-size:.72rem"
          onclick="genererBordereau('${u.user_id}','${escapeHtml(u.prenom || '')}','${escapeHtml(u.email)}','${periode}')">
          📄 Générer PDF
        </button>
        ${!sent ? `<button class="btn btn-ok btn-sm" style="margin-left:4px;font-size:.72rem;background:var(--ok);color:#fff;border:none"
          onclick="marquerBordereauEnvoye('${u.user_id}','${periode}')">
          ✅ Fait
        </button>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    console.error('loadBordereaux:', e);
  }
}

async function genererBordereau(userId, prenom, email, periode) {
  // Calculer les commissions de la période
  const [year, month] = periode.split('-').map(Number);
  const startMonth = new Date(year, month - 1, 1);
  const endMonth   = new Date(year, month, 0, 23, 59, 59);

  const contracts = state.contracts.filter(c => {
    if (c.created_by !== userId) return false;
    if (!c.date_debut) return false;
    const d = new Date(c.date_debut + 'T00:00:00');
    return d >= startMonth && d <= endMonth;
  });

  const recurrents = state.contracts.filter(c =>
    c.created_by === userId &&
    c.recurrence === 'Mensuel' &&
    !['Terminé'].includes(c.statut) &&
    c.date_debut && new Date(c.date_debut + 'T00:00:00') <= endMonth
  );

  // Calculer montant total
  let total = 0;
  const rows = [];

  contracts.forEach(ct => {
    const preset = (FORMULE_PRESETS[ct.type] || []).find(f => f.label === ct.formule);
    const comm = preset?.comm_signature_fix || (preset?.comm_signature_pct ? Math.round(Number(ct.montant || 0) * preset.comm_signature_pct * 100) / 100 : 0);
    if (comm > 0) {
      total += comm;
      rows.push({ type: 'Signature', contact: contactName(ct.contact_id), formule: ct.formule || ct.type, montant: comm });
    }
  });

  recurrents.forEach(ct => {
    const preset = (FORMULE_PRESETS[ct.type] || []).find(f => f.label === ct.formule);
    const pct = preset?.comm_recurrent_pct || 0;
    const comm = Math.round(Number(ct.montant || 0) * pct * 100) / 100;
    if (comm > 0) {
      total += comm;
      rows.push({ type: 'Récurrent', contact: contactName(ct.contact_id), formule: ct.formule || ct.type, montant: comm });
    }
  });

  // Enregistrer dans bordereau_log
  await sb.from('bordereau_log').upsert({
    user_id: userId,
    periode,
    montant_total: total,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,periode' });

  // Générer le PDF via generateBordereauCommission adapté
  if (window.ContractPDF && window.ContractPDF.generateBordereau) {
    window.ContractPDF.generateBordereau({ prenom, email, periode, rows, total });
  } else {
    // Fallback : bordereau texte simple
    const lines = rows.map(r => `${r.type} | ${r.contact} | ${r.formule} | ${formatMoney(r.montant)}`).join('\n');
    alert(`Bordereau ${prenom} — ${periode}\n\n${lines || 'Aucune commission ce mois'}\n\nTOTAL : ${formatMoney(total)}`);
  }

  await renderBordereaux();
}

async function marquerBordereauEnvoye(userId, periode) {
  if (!confirm(`Confirmer que le bordereau de ${periode} a été envoyé ?`)) return;
  const { error } = await sb.from('bordereau_log').upsert({
    user_id: userId,
    periode,
    sent_at: new Date().toISOString(),
    sent_by: state.user.id,
  }, { onConflict: 'user_id,periode' });
  if (error) { alert('Erreur : ' + error.message); return; }
  await renderBordereaux();
}


// ==========================================================================
// DEMANDES D'ASSISTANCE
// ==========================================================================

const HELP_SEEN_KEY = 'safe_help_seen'; // { requestId: timestamp }

async function loadHelpRequests() {
  const block    = document.getElementById('help-requests-alert');
  const myBlock  = document.getElementById('my-help-requests-alert');

  // Charger toutes les demandes ouvertes
  const { data, error } = await sb.from('help_requests')
    .select('*')
    .eq('statut', 'ouvert')
    .order('created_at', { ascending: false });

  if (error) { console.error('loadHelpRequests:', error); return; }
  const requests = data || [];

  // ── VUE ADMIN ──
  if (isAdmin() && block) {
    const adminRequests = requests; // toutes les demandes ouvertes
    if (adminRequests.length) {
      block.style.display = 'block';
      const list = document.getElementById('help-requests-list');
      list.innerHTML = adminRequests.map(r => {
        const profile = state.profilesById?.[r.user_id];
        const nom = profile?.prenom || r.user_id.slice(0,8);
        return `<div class="mini-item">
          <div>
            <div class="t">${escapeHtml(nom)} — ${escapeHtml(r.sujet)}</div>
            <div class="s">${escapeHtml(r.message.slice(0,120))}${r.message.length > 120 ? '…' : ''}</div>
            <div class="s mut" style="font-size:.75rem">${formatDate(r.created_at.slice(0,10))}</div>
          </div>
          <button class="btn btn-ok btn-sm" style="margin-left:8px;font-size:.72rem;background:var(--ok);color:#fff;border:none;flex-shrink:0"
            onclick="traiterHelpRequest('${r.id}')">
            ✅ Traité
          </button>
        </div>`;
      }).join('');
    } else {
      block.style.display = 'none';
    }
  }

  // ── VUE UTILISATEUR (ses propres demandes) ──
  if (myBlock) {
    const seen = JSON.parse(localStorage.getItem(HELP_SEEN_KEY) || '{}');
    const now  = Date.now();
    const myRequests = requests.filter(r => r.user_id === state.user?.id);

    // Filtrer : afficher si pas vu, ou vu il y a plus de 4h
    const toShow = myRequests.filter(r => {
      const seenAt = seen[r.id];
      return !seenAt || (now - seenAt) > 4 * 60 * 60 * 1000;
    });

    if (toShow.length) {
      myBlock.style.display = 'block';
      const myList = document.getElementById('my-help-requests-list');
      myList.innerHTML = toShow.map(r => `
        <div class="mini-item">
          <div>
            <div class="t">${escapeHtml(r.sujet)}</div>
            <div class="s">${escapeHtml(r.message.slice(0,100))}${r.message.length > 100 ? '…' : ''}</div>
            <div class="s mut" style="font-size:.75rem">Envoyée le ${formatDate(r.created_at.slice(0,10))} — En attente de traitement</div>
          </div>
          <button class="btn btn-out btn-sm" style="margin-left:8px;font-size:.72rem;flex-shrink:0"
            onclick="vuHelpRequest('${r.id}')">
            👁 Vu
          </button>
          <button class="btn btn-danger btn-sm" style="margin-left:4px;font-size:.72rem;flex-shrink:0"
            onclick="terminerHelpRequest('${r.id}')">
            ✕ Terminé
          </button>
        </div>`).join('');
    } else {
      myBlock.style.display = 'none';
    }
  }
}

async function traiterHelpRequest(id) {
  if (!confirm('Marquer cette demande comme traitée ?')) return;
  const { error } = await sb.from('help_requests').update({
    statut:     'traite',
    treated_at: new Date().toISOString(),
    treated_by: state.user.id,
  }).eq('id', id);
  if (error) { alert('Erreur : ' + error.message); return; }
  await loadHelpRequests();
}

function vuHelpRequest(id) {
  const seen = JSON.parse(localStorage.getItem(HELP_SEEN_KEY) || '{}');
  seen[id] = Date.now();
  localStorage.setItem(HELP_SEEN_KEY, JSON.stringify(seen));
  loadHelpRequests();
}

async function terminerHelpRequest(id) {
  if (!confirm('Marquer cette demande comme terminée ? Elle disparaîtra de vos alertes.')) return;
  const { error } = await sb.from('help_requests').update({
    statut:     'traite',
    treated_at: new Date().toISOString(),
    treated_by: state.user.id,
  }).eq('id', id);
  if (error) { alert('Erreur : ' + error.message); return; }
  await loadHelpRequests();
}


// ==========================================================================
// VÉRIFICATION MANDAT SIGNÉ (non-admin uniquement)
// ==========================================================================
async function checkMandatSigne() {
  if (isAdmin()) return;
  try {
    const { data, error } = await sb.from('mandats')
      .select('id,statut')
      .eq('user_id', state.user.id)
      .eq('statut', 'signe')
      .maybeSingle();
    if (error) { console.warn('checkMandatSigne:', error); return; }
    if (!data) {
      // Aucun mandat signé → redirection vers la page de signature
      window.location.href = '/mandat.html';
    }
  } catch(e) {
    console.warn('checkMandatSigne:', e);
  }
}


// ==========================================================================
// GESTION MOT DE PASSE — Validation, changement, rotation 45j
// ==========================================================================

const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

function validatePassword(pwd) {
  return {
    length:   pwd.length >= 8,
    lower:    /[a-z]/.test(pwd),
    upper:    /[A-Z]/.test(pwd),
    digit:    /\d/.test(pwd),
    special:  /[^a-zA-Z0-9]/.test(pwd),
    valid:    PWD_REGEX.test(pwd),
  };
}

function genererMotDePasse() {
  const chars = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const specials = '!@#$%&*-_+?';
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += specials[Math.floor(Math.random() * specials.length)];
  const all = chars + upper + digits + specials;
  while (pwd.length < 12) pwd += all[Math.floor(Math.random() * all.length)];
  // Mélanger
  pwd = pwd.split('').sort(() => Math.random() - 0.5).join('');
  document.getElementById('nu-password').value = pwd;
  // Copier dans le presse-papier
  navigator.clipboard.writeText(pwd).then(() => {
    const btn = document.querySelector('button[onclick="genererMotDePasse()"]');
    if (btn) { const old = btn.textContent; btn.textContent = '✅ Copié !'; setTimeout(() => btn.textContent = old, 2000); }
  }).catch(() => {});
}

function openChangePasswordModal(isFirst = true) {
  const modal = document.getElementById('change-password-modal');
  if (!modal) return;
  document.getElementById('change-password-title').textContent = isFirst
    ? '🔐 Choisissez votre mot de passe'
    : '🔑 Renouvellement de mot de passe';
  document.getElementById('change-password-subtitle').textContent = isFirst
    ? 'Pour sécuriser votre compte, choisissez un mot de passe robuste dès maintenant.'
    : 'Votre mot de passe a plus de 45 jours. Choisissez un nouveau mot de passe pour maintenir la sécurité de votre compte.';
  document.getElementById('cp-password').value = '';
  document.getElementById('cp-password2').value = '';
  document.getElementById('cp-save-btn').disabled = true;
  document.getElementById('cp-strength').style.display = 'none';
  modal.classList.add('show');
}

function closeChangePasswordModal() {
  document.getElementById('change-password-modal')?.classList.remove('show');
}

// Validation en temps réel
function setupPasswordValidation() {
  const input  = document.getElementById('cp-password');
  const input2 = document.getElementById('cp-password2');
  const saveBtn = document.getElementById('cp-save-btn');
  if (!input) return;

  const criteria = [
    { id: 'str-length',  key: 'length',  label: '8 caractères minimum' },
    { id: 'str-lower',   key: 'lower',   label: 'Une lettre minuscule' },
    { id: 'str-upper',   key: 'upper',   label: 'Une lettre majuscule' },
    { id: 'str-digit',   key: 'digit',   label: 'Un chiffre' },
    { id: 'str-special', key: 'special', label: 'Un caractère spécial (!@#$%...)' },
  ];

  const criteriaEl = document.getElementById('cp-criteria');
  if (criteriaEl) {
    criteriaEl.innerHTML = criteria.map(c =>
      `<div id="${c.id}" style="display:flex;align-items:center;gap:6px;color:var(--mut)">
        <span class="crit-icon">○</span><span style="font-size:.76rem">${c.label}</span>
      </div>`
    ).join('');
  }

  const checkMatch = () => {
    const v = validatePassword(input.value);
    const match = input.value === input2.value && input2.value.length > 0;
    const matchErr = document.getElementById('cp-match-error');
    if (matchErr) matchErr.style.display = (input2.value && !match) ? 'block' : 'none';
    saveBtn.disabled = !(v.valid && match);
  };

  input.addEventListener('input', () => {
    const pwd = input.value;
    const v = validatePassword(pwd);
    document.getElementById('cp-strength').style.display = pwd.length ? 'block' : 'none';

    // Barres de force
    const score = [v.length, v.lower || v.upper, v.digit, v.special].filter(Boolean).length;
    const colors = ['var(--alert)', 'var(--gold)', 'var(--gold)', 'var(--ok)'];
    for (let i = 1; i <= 4; i++) {
      const bar = document.getElementById('str-' + i);
      if (bar) bar.style.background = i <= score ? colors[score-1] : 'var(--line)';
    }

    // Critères
    criteria.forEach(c => {
      const el = document.getElementById(c.id);
      if (!el) return;
      const ok = v[c.key];
      el.style.color = ok ? 'var(--ok)' : 'var(--mut)';
      el.querySelector('.crit-icon').textContent = ok ? '✓' : '○';
    });

    checkMatch();
  });

  input2.addEventListener('input', checkMatch);
}

async function saveNewPassword() {
  const pwd  = document.getElementById('cp-password').value;
  const pwd2 = document.getElementById('cp-password2').value;
  if (!validatePassword(pwd).valid) { alert('Le mot de passe ne respecte pas les critères de sécurité.'); return; }
  if (pwd !== pwd2) { alert('Les mots de passe ne correspondent pas.'); return; }

  const btn = document.getElementById('cp-save-btn');
  btn.disabled = true; btn.textContent = 'Enregistrement…';

  try {
    const { error } = await sb.auth.updateUser({ password: pwd });
    if (error) throw new Error(error.message);

    // Mettre à jour password_set et password_changed_at
    await sb.from('profiles').update({
      password_set:        true,
      password_changed_at: new Date().toISOString(),
    }).eq('id', state.user.id);

    closeChangePasswordModal();
    document.getElementById('password-renewal-banner').style.display = 'none';

    // Proposer la 2FA si pas encore fait et pas déjà activée
    const profile = state.profile;
    if (!profile?.totp_proposed) {
      await sb.from('profiles').update({ totp_proposed: true }).eq('id', state.user.id);
      document.getElementById('totp-propose-modal')?.classList.add('show');
    } else {
      // Vérifier si le profil est complété
      await checkProfilCompleted();
    }
  } catch(e) {
    alert('Erreur : ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enregistrer le mot de passe';
  }
}

async function checkProfilCompleted() {
  const p = state.profile;
  if (!p?.profil_completed && !p?.prenom) {
    // Ouvrir la modale profil
    openProfileModal();
  }
}

async function checkPasswordStatus() {
  if (!state.user) return;
  try {
    const { data } = await sb.rpc('needs_password_renewal', { p_user_id: state.user.id });
    const needsRenewal = data;

    if (needsRenewal && !state.profile?.password_set) {
      // Première connexion → modale bloquante (non-admin)
      if (!isAdmin()) {
        openChangePasswordModal(true);
        return;
      }
    }

    if (needsRenewal && isAdmin()) {
      // Admin → banner non bloquant
      const banner = document.getElementById('password-renewal-banner');
      if (banner) banner.style.display = 'flex';
      return;
    }

    if (needsRenewal && !isAdmin()) {
      // DCI → modale bloquante renouvellement
      openChangePasswordModal(false);
      return;
    }

    // Vérifier profil complété (non-admin seulement)
    if (!isAdmin()) await checkProfilCompleted();

  } catch(e) {
    console.warn('checkPasswordStatus:', e);
  }
}


// ==========================================================================
// ALERTE FACTURATION DCI — dernier jour ouvré du mois
// ==========================================================================

async function loadBordereauDCI() {
  if (isAdmin()) return; // Admins ne voient pas cette alerte

  const block = document.getElementById('my-bordereau-alert');
  if (!block) return;

  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth() + 1;

  // Vérifier si on est le dernier jour ouvré du mois
  const dernierJour = dernierJourOuvreMois(year, month);
  const isLastOuvre = (
    now.getFullYear() === dernierJour.getFullYear() &&
    now.getMonth()    === dernierJour.getMonth() &&
    now.getDate()     === dernierJour.getDate()
  );

  if (!isLastOuvre) { block.style.display = 'none'; return; }

  // Calculer les commissions du mois courant
  const periode  = `${year}-${String(month).padStart(2,'0')}`;
  const startM   = new Date(year, month - 1, 1);
  const endM     = new Date(year, month, 0, 23, 59, 59);

  const myContracts = (state.contracts || []).filter(c => c.created_by === state.user?.id);

  // Signatures du mois
  const signatures = myContracts.filter(c => {
    if (!c.date_debut) return false;
    const d = new Date(c.date_debut + 'T00:00:00');
    return d >= startM && d <= endM;
  });

  // Récurrents actifs
  const recurrents = myContracts.filter(c =>
    c.recurrence === 'Mensuel' &&
    !['Terminé'].includes(c.statut) &&
    c.date_debut && new Date(c.date_debut + 'T00:00:00') <= endM
  );

  // Calcul montant estimé
  let total = 0;
  signatures.forEach(c  => { total += Math.round((Number(c.montant) || 0) * 0.15); });
  recurrents.forEach(c  => { total += Math.round((Number(c.montant) || 0) * 0.10); });

  if (total === 0 && signatures.length === 0 && recurrents.length === 0) {
    block.style.display = 'none';
    return;
  }

  const periodLabel = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const mailSubject = encodeURIComponent(`Facture de commissions S@FE — ${periodLabel}`);
  const mailBody    = encodeURIComponent(
    `Bonjour,

Veuillez trouver ci-joint ma facture de commissions pour le mois de ${periodLabel}.

Montant total : ${total} € HT

Cordialement,
${state.profile?.prenom || ''}`
  );

  block.style.display = 'block';
  const list = document.getElementById('my-bordereau-list');
  if (list) list.innerHTML = `
    <div class="mini-item" style="flex-direction:column;gap:12px;align-items:flex-start">
      <div>
        <div class="t">💶 Commissions estimées — ${periodLabel}</div>
        <div class="s" style="margin-top:4px">
          ${signatures.length} contrat${signatures.length>1?'s':''} signés
          · ${recurrents.length} abonnement${recurrents.length>1?'s':''} actifs
          · <strong style="color:var(--gold)">~${total} € HT</strong>
        </div>
        <div class="s mut" style="font-size:.75rem;margin-top:4px">
          ⚠️ Le virement sera effectué à réception de votre facture. Sans facture, aucun paiement ne sera déclenché.
        </div>
      </div>
      <a href="mailto:compta@safe-digitalisation.fr?subject=${mailSubject}&body=${mailBody}"
        class="btn btn-pri" style="font-size:.78rem;padding:8px 14px;text-decoration:none">
        ✉️ Envoyer ma facture à S@FE
      </a>
    </div>`;
}

function dernierJourOuvreMois(year, month) {
  let d = new Date(year, month, 0); // dernier jour calendaire
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}


// ==========================================================================
// NOTIFICATIONS NOUVEAUX CONTRATS — dashboard admin
// ==========================================================================

async function loadNotifContracts() {
  if (!isAdmin()) return;
  const block = document.getElementById('notif-contracts-alert');
  if (!block) return;

  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .eq('type', 'new_contract')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data?.length) { block.style.display = 'none'; return; }

  block.style.display = 'block';
  const list = document.getElementById('notif-contracts-list');
  list.innerHTML = data.map(n => {
    const d  = n.data || {};
    const dt = formatDate(n.created_at.slice(0, 10));
    const montant = d.montant ? ` — ${Number(d.montant).toLocaleString('fr-FR')} € HT` : '';
    return `<div class="mini-item">
      <div>
        <div class="t">${escapeHtml(n.message || '')}${escapeHtml(montant)}</div>
        <div class="s mut" style="font-size:.75rem">${dt}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;margin-left:8px">
        ${d.contact_id ? `<button class="btn btn-out btn-sm" style="font-size:.72rem;padding:4px 8px"
          onclick="switchView('contacts');openContactModal('${d.contact_id}')">
          👤 Voir
        </button>` : ''}
        <button class="btn btn-ok btn-sm" style="font-size:.72rem;background:var(--ok);color:#fff;border:none;padding:4px 8px"
          onclick="marquerNotifLue('${n.id}')">
          ✅ Lu
        </button>
      </div>
    </div>`;
  }).join('');
}

async function marquerNotifLue(id) {
  await sb.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  await loadNotifContracts();
}

async function marquerToutesLues() {
  await sb.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('type', 'new_contract')
    .is('read_at', null);
  await loadNotifContracts();
}


// ==========================================================================
// RÉINITIALISATION DONNÉES TEST — admin, one-shot
// ==========================================================================

async function checkResetFlag() {
  if (!isAdmin()) return;
  const { data } = await sb.from('app_settings')
    .select('value').eq('key', 'reset_done').maybeSingle();
  const wrap = document.getElementById('reset-test-btn-wrap');
  if (wrap) {
    wrap.style.display = (data?.value === 'false') ? 'block' : 'none';
  }
}

function openResetModal() {
  document.getElementById('reset-confirm-input').value = '';
  document.getElementById('reset-confirm-btn').disabled = true;
  document.getElementById('reset-confirm-btn').style.opacity = '.4';
  document.getElementById('reset-confirm-btn').style.cursor = 'not-allowed';
  document.getElementById('reset-test-modal').classList.add('show');
}

function setupResetConfirmInput() {
  const input = document.getElementById('reset-confirm-input');
  const btn   = document.getElementById('reset-confirm-btn');
  if (!input || !btn) return;
  input.addEventListener('input', () => {
    const ok = input.value.trim() === 'RÉINITIALISER';
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '.4';
    btn.style.cursor  = ok ? 'pointer' : 'not-allowed';
  });
}

async function executeReset() {
  const input = document.getElementById('reset-confirm-input');
  if (input.value.trim() !== 'RÉINITIALISER') return;

  const btn = document.getElementById('reset-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Réinitialisation en cours…';

  try {
    const { data, error } = await sb.rpc('reset_test_data');
    if (error) throw new Error(error.message);

    document.getElementById('reset-test-modal').classList.remove('show');
    document.getElementById('reset-test-btn-wrap').style.display = 'none';

    // Recharger les données
    await renderAll();
    alert('✅ Réinitialisation effectuée. Toutes les données de test ont été supprimées.');
  } catch(e) {
    alert('Erreur : ' + e.message);
    btn.disabled = false;
    btn.textContent = '🗑 Réinitialiser définitivement';
  }
}


// ==========================================================================
// INTELLIGENCE COMMERCIALE — Upsell & Churn Risk
// ==========================================================================

// Gammes disponibles pour détecter les manques
const GAMMES = ['SEO', 'RGPD', 'Cybersécurité', 'DPO'];

function detectGamme(type) {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes('seo') || t.includes('réf') || t.includes('ref') || t.includes('local')) return 'SEO';
  if (t.includes('rgpd') || t.includes('conform')) return 'RGPD';
  if (t.includes('cyber') || t.includes('sécu') || t.includes('secu')) return 'Cybersécurité';
  if (t.includes('dpo')) return 'DPO';
  return null;
}

async function loadUpsellOpportunities() {
  const block = document.getElementById('upsell-alert');
  const list  = document.getElementById('upsell-list');
  if (!block) return;

  const myId = state.user?.id;
  const contacts  = (state.contacts  || []).filter(c => c.created_by === myId && c.statut === 'Client');
  const contracts = (state.contracts || []).filter(c => c.created_by === myId && !['Terminé'].includes(c.statut));

  // Pour chaque client actif, quelles gammes lui manquent ?
  const opps = [];
  for (const contact of contacts) {
    const clientContracts = contracts.filter(c => c.contact_id === contact.id);
    const gammes = clientContracts.map(c => detectGamme(c.type)).filter(Boolean);
    const manquantes = GAMMES.filter(g => !gammes.some(cg => cg === g || cg?.includes(g)));
    if (manquantes.length > 0 && gammes.length > 0) {
      opps.push({ contact, gammes_actives: gammes, manquantes });
    }
  }

  // Trier par nombre de gammes manquantes (le plus de potentiel en premier)
  opps.sort((a, b) => b.manquantes.length - a.manquantes.length);
  const top = opps.slice(0, 5);

  if (!top.length) { block.style.display = 'none'; return; }

  block.style.display = 'block';
  list.innerHTML = top.map(o => {
    const nom = escapeHtml((o.contact.entreprise || o.contact.nom || '—').slice(0, 30));
    const actives   = o.gammes_actives.map(g => `<span style="background:rgba(34,197,94,.12);color:#16a34a;font-size:.7rem;padding:1px 6px;border-radius:999px">${escapeHtml(g)}</span>`).join(' ');
    const manquants = o.manquantes.map(g => `<span style="background:rgba(59,130,246,.1);color:#2563eb;font-size:.7rem;padding:1px 6px;border-radius:999px;cursor:pointer" onclick="switchView('contacts');openContactModal('${o.contact.id}')">${escapeHtml(g)}</span>`).join(' ');
    return `<div class="mini-item" style="flex-direction:column;align-items:flex-start;gap:6px">
      <div class="t" style="cursor:pointer" onclick="switchView('contacts');openContactModal('${o.contact.id}')">${nom}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">
        <span style="font-size:.72rem;color:var(--mut)">Actif :</span> ${actives}
        <span style="font-size:.72rem;color:var(--mut);margin-left:4px">À proposer :</span> ${manquants}
      </div>
    </div>`;
  }).join('');
}

async function loadChurnRisk() {
  const block = document.getElementById('churn-alert');
  const list  = document.getElementById('churn-list');
  if (!block) return;

  const myId    = state.user?.id;
  const now     = new Date();
  const limite  = new Date(now - 60 * 24 * 60 * 60 * 1000); // 60 jours

  // Clients actifs avec contrat en cours
  const contacts  = (state.contacts  || []).filter(c => c.created_by === myId && c.statut === 'Client' && !c.rgpd_ko);
  const contracts = (state.contracts || []).filter(c => c.created_by === myId && !['Terminé'].includes(c.statut));
  const clientsAvecContrat = contacts.filter(c => contracts.some(ct => ct.contact_id === c.id));

  // Chercher la dernière interaction pour chaque client
  const { data: interactions } = await sb
    .from('interactions')
    .select('contact_id, date')
    .in('contact_id', clientsAvecContrat.map(c => c.id))
    .order('date', { ascending: false });

  const risques = [];
  for (const contact of clientsAvecContrat) {
    const ints = (interactions || []).filter(i => i.contact_id === contact.id);
    const lastDate = ints.length ? new Date(ints[0].date) : new Date(contact.created_at || 0);
    const joursEcoules = Math.floor((now - lastDate) / (24 * 60 * 60 * 1000));
    if (joursEcoules >= 60) {
      risques.push({ contact, joursEcoules, lastDate });
    }
  }

  // Trier par le plus longtemps sans contact
  risques.sort((a, b) => b.joursEcoules - a.joursEcoules);
  const top = risques.slice(0, 5);

  if (!top.length) { block.style.display = 'none'; return; }

  block.style.display = 'block';
  list.innerHTML = top.map(r => {
    const nom  = escapeHtml((r.contact.entreprise || r.contact.nom || '—').slice(0, 30));
    const j    = r.joursEcoules;
    const couleur = j >= 120 ? 'var(--alert)' : j >= 90 ? '#f59e0b' : 'var(--mut)';
    return `<div class="mini-item">
      <div>
        <div class="t" style="cursor:pointer" onclick="switchView('contacts');openContactModal('${r.contact.id}')">${nom}</div>
        <div class="s" style="color:${couleur};font-size:.75rem">Dernier contact il y a <strong>${j} jours</strong></div>
      </div>
      <button class="btn btn-pri btn-sm"
        style="font-size:.72rem;padding:5px 10px;flex-shrink:0;margin-left:8px"
        onclick="switchView('contacts');openContactModal('${r.contact.id}')">
        📞 Relancer
      </button>
    </div>`;
  }).join('');
}


init()
