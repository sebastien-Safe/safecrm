// =========================================================
// S@FE CRM — Logique applicative
// =========================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  contacts: [],
  contracts: [],
  tasks: [],
  tournees: [],
  profile: null,
  profilesById: {},
  objectifs: [],
  user: null,
  unreadMessages: [],
  adminUsers: [],
  adminView: 'me', // 'me' (mes chiffres) | 'all' (tous) | 'users' (gestion)
  adminFilterUserId: null, // pour visualiser les objectifs d'un utilisateur précis (admin)
};

// Helpers → assets/js/utils/helpers.js  ($, $all, escapeHtml, formatDate, formatMoney, todayISO, isOverdue, monthKey, isThisMonth, gaugeColor)
// Composants → assets/js/composants/gauge.js (gaugeSvg) | toast.js (showCrmToast) | session-banner.js (_showSessionWarningBanner, checkSessionExpiry)
// → contacts/contacts.js : CONTACT_STATUT_BADGE, ACTIVITE_BADGE, CONTACT_FIELD_IDS, CONTACT_CONSENT_IDS, contactName
// → contracts/contracts.js : CONTRACT_STATUT_BADGE, CONTRACT_ICONS, getContractIcon, FORMULE_PRESETS, FORMULE_CUSTOM, COMMISSION_FALLBACK
// → tasks/tasks.js : PRIORITY_BADGE, TASK_TYPE_BADGE, getFilteredTasks, taskCardHtml, renderTasks, openTaskModal, closeTaskModal, saveTask, deleteTask, quickSetTaskStatus

// ---------------------------------------------------------
// AUTHENTIFICATION
// ---------------------------------------------------------
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    // Vérifier si la session dépasse 4h dès le démarrage (ex: rechargement de page)
    const signinAt = parseInt(localStorage.getItem('safe_signin_at') || '0', 10);
    if (signinAt && Date.now() - signinAt > SESSION_MAX_MS) {
      localStorage.removeItem('safe_signin_at');
      await sb.auth.signOut();
      showLogin();
      return;
    }
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
  $('#login-screen').classList.remove('is-hidden');
  $('#reset-screen').classList.add('is-hidden');
  $('#app').classList.add('is-hidden');
  showLoginPanel();
}

function showResetScreen() {
  $('#login-screen').classList.add('is-hidden');
  $('#app').classList.add('is-hidden');
  $('#reset-error').textContent = '';
  $('#reset-password').value = '';
  $('#reset-password-2').value = '';
  $('#reset-screen').classList.remove('is-hidden');
  history.replaceState({}, document.title, window.location.pathname);
}

function showLoginPanel() {
  $('#forgot-panel').classList.add('is-hidden');
  $('#login-panel').classList.remove('is-hidden');
}

function showForgotPanel() {
  $('#login-panel').classList.add('is-hidden');
  $('#forgot-panel').classList.remove('is-hidden');
  $('#forgot-error').textContent = '';
  $('#forgot-success').classList.add('is-hidden');
}

async function sendPasswordReset() {
  const email = $('#forgot-email').value.trim();
  $('#forgot-error').textContent = '';
  $('#forgot-success').classList.add('is-hidden');
  if (!email) { $('#forgot-error').textContent = 'Merci de renseigner votre e-mail.'; return; }

  $('#forgot-error').textContent = 'Envoi en cours…';
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectTo }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok && body.error !== undefined) {
      $('#forgot-error').textContent = 'Erreur lors de l\'envoi. Veuillez réessayer.';
      return;
    }
  } catch (e) {
    $('#forgot-error').textContent = 'Erreur réseau. Vérifiez votre connexion.';
    return;
  }

  $('#forgot-error').textContent = '';
  if (typeof logRgpd === 'function') logRgpd('mot_de_passe_reinitialise', 'Sécurité', {
    criticite: 'Attention', donnees: 'email', details: { email },
  });
  $('#forgot-success').classList.remove('is-hidden');
}

function _sendPasswordChangedConfirmation(email) {
  fetch(`${SUPABASE_URL}/functions/v1/send-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'confirmation', email }),
  }).catch(() => {});
}

async function submitNewPassword() {
  const pw1 = $('#reset-password').value;
  const pw2 = $('#reset-password-2').value;
  $('#reset-error').textContent = '';
  if (!pw1 || pw1.length < 6) { $('#reset-error').textContent = 'Le mot de passe doit contenir au moins 6 caractères.'; return; }
  if (pw1 !== pw2) { $('#reset-error').textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
  const { error, data: updData } = await sb.auth.updateUser({ password: pw1 });
  if (error) { $('#reset-error').textContent = 'Erreur : ' + error.message; return; }
  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user || null;
  _sendPasswordChangedConfirmation(updData?.user?.email || session?.user?.email || '');
  $('#reset-screen').classList.add('is-hidden');
  await showApp();
}

async function showApp() {
  $('#login-screen').classList.add('is-hidden');
  $('#reset-screen').classList.add('is-hidden');
  await loadProfile();
  const wallShown = await _checkAndShowSignatureWall();
  if (wallShown) return;
  await _afterSignatures();
}

async function _afterSignatures() {
  $('#app').classList.remove('is-hidden');
  await loadAll();
  const workGoto = sessionStorage.getItem('safe_work_goto');
  if (workGoto && isAdmin()) {
    sessionStorage.removeItem('safe_work_goto');
    switchView('admin');
    setTimeout(() => switchAdminTab(workGoto), 80);
    return;
  }
  // Lien direct vers une vue via ?v=agenda (ex : depuis la sidebar prospection terrain)
  const vParam = new URLSearchParams(window.location.search).get('v');
  if (vParam) {
    history.replaceState({}, document.title, window.location.pathname);
    switchView(vParam);
  }
}

async function login() {
  const email    = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const errEl    = $('#login-error');
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = 'Merci de renseigner e-mail et mot de passe.';
    return;
  }

  // Vérifier le verrou local (sessionStorage, réinitialisé à la fermeture de l'onglet)
  const failKey  = 'safe_login_fails_' + btoa(email);
  const failData = JSON.parse(sessionStorage.getItem(failKey) || '{"count":0}');
  if (failData.count >= 5) {
    errEl.textContent = '🔒 Compte suspendu. Contactez votre administrateur pour débloquer votre accès.';
    return;
  }

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    // Détecter un compte déjà banni côté Supabase
    if (error.message?.toLowerCase().includes('ban')) {
      errEl.textContent = '🔒 Compte suspendu. Contactez votre administrateur.';
      return;
    }

    // Incrémenter côté serveur + bannissement au 5ᵉ échec
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/record-login-failure`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body:    JSON.stringify({ email }),
      });
      if (resp.ok) {
        const data = await resp.json();
        failData.count = data.attempts || failData.count + 1;
        sessionStorage.setItem(failKey, JSON.stringify(failData));
        if (data.banned) {
          errEl.textContent = '🔒 Compte suspendu après 5 tentatives échouées. Contactez votre administrateur.';
          return;
        }
        if (data.remaining === 1) {
          errEl.textContent = `Identifiants incorrects. ⚠️ Dernière tentative avant suspension du compte.`;
          return;
        }
        if (data.remaining > 0) {
          errEl.textContent = `Identifiants incorrects (${data.remaining} tentative${data.remaining > 1 ? 's' : ''} restante${data.remaining > 1 ? 's' : ''}).`;
          return;
        }
      }
    } catch (_) {}

    errEl.textContent = 'Identifiants incorrects.';
    return;
  }

  // Succès → réinitialiser le compteur local + marquer l'heure de connexion (limite 8h)
  sessionStorage.removeItem(failKey);
  localStorage.setItem('safe_signin_at', String(Date.now()));

  // TOTP obligatoire (enrôlement forcé si absent, trust 2h si déjà validé)
  const ok = await challengeTOTPIfNeeded();
  if (!ok) {
    errEl.textContent = 'Connexion annulée (double authentification requise).';
    return;
  }
}

async function logout() {
  localStorage.removeItem('safe_signin_at');
  await sb.auth.signOut();
}

// SESSION_MAX_MS, SESSION_WARN_MS, _sessionWarnShown, _showSessionWarningBanner, checkSessionExpiry
// → déplacés dans assets/js/composants/session-banner.js

// ---------------------------------------------------------
// CHARGEMENT DES DONNÉES
// ---------------------------------------------------------
async function loadAll() {
  await Promise.all([
    loadContacts(), loadContracts(), loadTasks(), loadTournees(),
    loadProfile(), loadAllProfiles(), loadObjectifs(),
    loadUnreadMessages(), loadInteractions(),
  ]);
  await ensureUserObjectifs();
  renderAll();
  checkRgpdExpiry(); // Vérification RGPD automatique au login
  checkPasswordStatus();             // Vérification mot de passe + renouvellement 45j
  loadBordereaux();     // Bordereaux admin
  loadNotifContracts(); // Notifications nouveaux contrats (admin)
  loadBordereauDCI();   // Rappel facturation DCI
  loadMessagesDCI();    // Messages du DCI (niveau 1)
  loadCooptationDCI();  // Prime cooptation DCI
  loadHelpRequests();   // Demandes d'assistance
  loadUpsellOpportunities(); // Potentiel montée en gamme
  loadChurnRisk();           // Risque résiliation
}

// → déplacé dans contacts/contacts.service.js : loadContacts
// → déplacé dans contracts/contracts.service.js : loadContracts

async function loadTournees() {
  const { data, error } = await sb.from('tournees')
    .select('*, tournee_etapes(*)')
    .eq('commercial_id', state.user.id)
    .neq('statut', 'annulée')
    .order('date_tournee', { ascending: true });
  if (error) { console.error('Erreur chargement tournées :', error.message); state.tournees = []; return; }
  state.tournees = (data || []).map(t => ({
    ...t,
    etapes: (t.tournee_etapes || []).sort((a, b) => a.ordre - b.ordre),
  }));
}

async function loadTasks() {
  const { data, error } = await sb.from('tasks').select('*').eq('created_by', state.user.id).order('echeance', { ascending: true, nullsFirst: false });
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
  const { data, error } = await sb.from('profiles')
    .select('id, prenom, nom, is_admin, role, dci_parent_id, region, departement, secteur, siret, denomination, adresse_pro, tva');
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
  if (!view) return;
  if (view === 'admin' && !isAdmin()) return; // guard : vue admin réservée aux administrateurs
  $all('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $all('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'admin') renderAdmin();
  if (view === 'resultats') renderResultats();
  if (view === 'agenda') renderAgenda();
  if (view === 'pipeline' && typeof loadPipeline === 'function') loadPipeline();
  if (view === 'journal') loadJournalView();
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
  if (isAdmin()) renderResiliationAlerts();

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
    alertBlock.classList.remove('is-hidden');
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
          <button class="btn btn-pri btn-sm btn-interact-alert" onclick="interactAlert('${c.id}','${c.contact_id}',${days})">👉 Interagir</button>
        </div>`;
    }).join('');
  } else {
    alertBlock.classList.add('is-hidden');
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
  const hasActiveContract = id => (state.contracts || []).some(
    ct => ct.contact_id === id && !['Terminé','Résilié'].includes(ct.statut)
  );
  recentEl.innerHTML = recent.length ? recent.map(c => {
    const statut = hasActiveContract(c.id) ? c.statut : 'Prospect';
    return `
    <div class="mini-item">
      <div>
        <div class="t">${escapeHtml(c.nom)}${c.entreprise ? ' — ' + escapeHtml(c.entreprise) : ''}</div>
        <div class="s">${(c.activites || []).map(a => escapeHtml(a)).join(', ') || '—'}</div>
      </div>
      <span class="badge ${CONTACT_STATUT_BADGE[statut] || 'badge-gray'}">${escapeHtml(statut)}</span>
    </div>`;
  }).join('') : '<p class="empty">Aucun contact pour le moment.</p>';

  // Pop-up des messages non lus (à la première ouverture du dashboard)
  if (!state._messagesShown && state.unreadMessages.length) {
    state._messagesShown = true;
    showIncomingMessagesIfAny();
  }
}

// ---------------------------------------------------------
// CONTACTS
// ---------------------------------------------------------
// → déplacé dans contacts/contacts-ui.js : getFilteredContacts, renderContacts, setContactFieldsLocked, canEditContact, openContactModal, closeContactModal
// → déplacé dans contacts/contacts.service.js : saveContact, deleteContact

// → déplacé dans contracts/contracts-ui.js : getFilteredContracts, renderContracts, populateContactSelects, populateContractSelects, openContractModal, closeContractModal
// → déplacé dans contracts/contracts-formulas.js : populateFormuleSelect, onFormuleChange, updateNetDisplay, autoCalcEcheance, onContractTypeChange
// → déplacé dans contracts/contracts.service.js : saveContract, deleteContract

// → déplacé dans tasks/tasks.js : getFilteredTasks, taskCardHtml, renderTasks, onTaskTypeChange,
//   openTaskModal, closeTaskModal, saveTask, deleteTask, quickSetTaskStatus

// ---------------------------------------------------------
// PROFIL UTILISATEUR (prénom, photo, jours travaillés)
// ---------------------------------------------------------
function renderUserBadge() {
  const name = state.profile?.prenom || (state.user?.email ? state.user.email.split('@')[0] : 'Utilisateur');
  $('#user-name').textContent = name;
  setAvatar($('#user-avatar'), state.profile?.photo_url, name);
  // Onglet Administration visible uniquement pour les super-admins
  $all('.admin-only').forEach(el => el.classList.toggle('is-hidden', !isAdmin()));
  if (isAdmin()) checkResetFlag();
  applyRoleVisibility();
  updateMobMenuRole();
  checkProfilComplet();
  checkMFAExpiry();
  checkUpsellFirstLogin();
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
  $('#profile-prenom').value   = state.profile?.prenom     || '';
  if (document.getElementById('profile-nom'))       document.getElementById('profile-nom').value       = state.profile?.nom        || '';
  if (document.getElementById('profile-telephone')) document.getElementById('profile-telephone').value = state.profile?.telephone  || '';
  if (document.getElementById('profile-adresse'))   document.getElementById('profile-adresse').value   = state.profile?.adresse    || '';
  if (document.getElementById('profile-rcpro'))        document.getElementById('profile-rcpro').value        = state.profile?.rcpro_numero  || '';
  if (document.getElementById('profile-siret'))        document.getElementById('profile-siret').value        = state.profile?.siret         || '';
  if (document.getElementById('profile-code-postal'))  document.getElementById('profile-code-postal').value  = state.profile?.code_postal   || '';
  const _pvEl = document.getElementById('profile-ville');
  if (_pvEl) {
    const _sv = state.profile?.ville || '';
    _pvEl.innerHTML = _sv
      ? `<option value="${escapeHtml(_sv)}">${escapeHtml(_sv)}</option>`
      : '<option value="">— Saisissez un code postal —</option>';
  }
  if (document.getElementById('profile-region'))       document.getElementById('profile-region').value       = state.profile?.region        || '';
  if (document.getElementById('profile-departement'))  document.getElementById('profile-departement').value  = state.profile?.departement   || '';
  if (document.getElementById('profile-secteur'))      document.getElementById('profile-secteur').value      = state.profile?.secteur       || '';

  // Vérifier si la clause est signée
  (async () => {
    const signedBlock   = document.getElementById('clause-signed-block');
    const unsignedBlock = document.getElementById('clause-unsigned-block');
    if (!signedBlock || !unsignedBlock) return;

    const { data } = await sb.from('clauses_confidentialite')
      .select('id, signed_at')
      .eq('user_id', state.user.id)
      .maybeSingle();

    if (data) {
      signedBlock.classList.remove('is-hidden');
      unsignedBlock.classList.add('is-hidden');
      const dateStr = new Date(data.signed_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'});
      signedBlock.querySelector('span').textContent = '✅ Clause signée le ' + dateStr;
      document.getElementById('clause-signed-link').href = '/clause.html?view=' + data.id;
    } else {
      signedBlock.classList.add('is-hidden');
      unsignedBlock.classList.remove('is-hidden');
    }
  })();
  $('#profile-photo-input').value = '';
  $('#profile-error').textContent = '';
  $('#profile-new-password').value = '';
  refreshTOTPStatus();
  $('#profile-new-password-2').value = '';
  $('#password-error').textContent = '';
  $('#password-success').classList.add('is-hidden');
  setAvatar($('#profile-avatar-preview'), state.profile?.photo_url, state.profile?.prenom || state.user?.email);
  $('#profile-modal').classList.add('show');
}

function closeProfileModal() {
  $('#profile-modal').classList.remove('show');
}

// Modale de confirmation avant envoi de devis — retourne une Promise<boolean>
function _confirmSendDevis({ nom, email, type, formule, montant, recurrence }) {
  return new Promise(resolve => {
    const modal   = document.getElementById('send-confirm-modal');
    const details = document.getElementById('send-confirm-details');
    const btnYes  = document.getElementById('send-confirm-yes');
    const btnNo   = document.getElementById('send-confirm-no');
    if (!modal || !btnYes || !btnNo) { resolve(true); return; }

    details.innerHTML =
      `<div><span style="color:#64748b">Client :</span> <strong style="color:#f1f5f9">${escapeHtml(nom)}</strong> <span style="color:#475569">(${escapeHtml(email)})</span></div>` +
      `<div><span style="color:#64748b">Produit :</span> ${escapeHtml(type)}${formule ? ' — ' + escapeHtml(formule) : ''}</div>` +
      `<div><span style="color:#64748b">Montant :</span> <strong style="color:#f59e0b">${escapeHtml(montant)} € HT${recurrence === 'Mensuel' ? ' / mois' : ''}</strong></div>`;

    modal.classList.add('show');

    const close = (result) => {
      modal.classList.remove('show');
      btnYes.removeEventListener('click', onYes);
      btnNo.removeEventListener('click', onNo);
      resolve(result);
    };
    const onYes = () => close(true);
    const onNo  = () => close(false);
    btnYes.addEventListener('click', onYes);
    btnNo.addEventListener('click', onNo);
  });
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
  const prenom      = $('#profile-prenom').value.trim() || null;
  const nom         = (document.getElementById('profile-nom')?.value||'').trim() || null;
  const telephone   = (document.getElementById('profile-telephone')?.value||'').trim() || null;
  const adresse     = (document.getElementById('profile-adresse')?.value||'').trim() || null;
  const rcpro       = (document.getElementById('profile-rcpro')?.value||'').trim() || null;
  const siret       = (document.getElementById('profile-siret')?.value||'').trim() || null;
  const code_postal = (document.getElementById('profile-code-postal')?.value||'').trim() || null;
  const ville       = (document.getElementById('profile-ville')?.value||'').trim() || null;
  const region      = (document.getElementById('profile-region')?.value||'').trim() || null;
  const departement = (document.getElementById('profile-departement')?.value||'').trim() || null;
  const secteur     = (document.getElementById('profile-secteur')?.value||'').trim() || null;
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

const { error } = await sb.from('profiles').upsert({
  id: state.user.id,
  prenom,
  nom,
  telephone,
  adresse,
  code_postal,
  ville,
  siret,
  rcpro_numero: rcpro,
  photo_url,
  region,
  departement,
  secteur,
  profil_completed: !!(prenom && nom && telephone && adresse && code_postal && ville && siret)
});  if (error) { $('#profile-error').textContent = 'Erreur : ' + error.message; return; }

  if (typeof logRgpd === 'function') await logRgpd('profil_modifie', 'Profil', {
    entityType: 'profile', entityId: state.user.id,
    donnees: 'prénom, nom, téléphone, adresse, SIRET, photo',
    criticite: 'Attention',
  });
  closeProfileModal();
  await loadProfile();
  renderUserBadge();
  renderObjectifs();
}

async function changePassword() {
  const pw1 = $('#profile-new-password').value;
  const pw2 = $('#profile-new-password-2').value;
  $('#password-error').textContent = '';
  $('#password-success').classList.add('is-hidden');

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
  _sendPasswordChangedConfirmation(state.user?.email || '');
  if (typeof logRgpd === 'function') logRgpd('mot_de_passe_modifie', 'Sécurité', {
    criticite: 'Attention', donnees: 'mot de passe (non stocké)',
  });
  $('#profile-new-password').value = '';
  $('#profile-new-password-2').value = '';
  $('#password-success').classList.remove('is-hidden');
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
  ['overview', 'per-user', 'users', 'registre', 'securite', 'archives', 'reglages'].forEach(t => {
    const el = $('#admin-panel-' + t);
    if (el) el.classList.toggle('is-hidden', t !== tab);
  });
  if (tab === 'users')    loadAdminUsers().then(renderAdminUsers);
  if (tab === 'overview') renderAdminOverview();
  if (tab === 'per-user') renderAdminPerUser();
  if (tab === 'registre') renderRegistreRGPD();
  if (tab === 'securite') renderSecurityPanel();
  if (tab === 'archives') loadArchivedUsers().then(renderArchivedUsers);
  if (tab === 'reglages') { loadFournisseurs(); loadPurgeInfo(); }
}

// ── Panel Sécurité ────────────────────────────────────────
async function renderSecurityPanel() {
  const tbody      = $('#security-audit-body');
  const alertsWrap = $('#security-alerts-wrap');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Chargement…</td></tr>';
  if (alertsWrap) alertsWrap.innerHTML = '';

  try {
    // Alertes non résolues
    const { data: alerts } = await sb.rpc('get_login_alerts');
    const unresolved = (alerts || []).filter(a => !a.resolved);
    if (alertsWrap && unresolved.length) {
      alertsWrap.innerHTML = unresolved.map(a => `
        <div style="background:rgba(220,38,38,.07);border:1px solid rgba(220,38,38,.25);border-radius:10px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <div style="font-weight:700;font-size:.85rem;color:#dc2626">🚨 Intrusion détectée — ${escapeHtml(a.email)}</div>
            <div style="font-size:.78rem;color:var(--fg-2,#6b7280);margin-top:3px">${escapeHtml(a.details || '')} · ${new Date(a.created_at).toLocaleString('fr-FR')}</div>
          </div>
          <button class="btn btn-out btn-sm" onclick="resolveSecurityAlert('${a.id}')">Résolu ✓</button>
        </div>`).join('');
    }

    // Journal
    const { data: rows, error } = await sb.rpc('get_login_audit', { p_limit: 50 });
    if (error) throw error;
    if (!rows || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">Aucune tentative enregistrée.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const dt      = new Date(r.created_at).toLocaleString('fr-FR');
      const okBadge = r.success
        ? '<span style="color:#16a34a;font-weight:600">✓ Succès</span>'
        : '<span style="color:#dc2626;font-weight:600">✗ Échec</span>';
      const lockBadge = r.locked
        ? '<span style="background:#dc2626;color:#fff;font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:4px">VERROU</span>'
        : '—';
      const rowStyle = r.locked ? 'background:rgba(220,38,38,.04)' : '';
      return `<tr style="${rowStyle}">
        <td class="nowrap" style="font-size:.8rem">${dt}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${okBadge}</td>
        <td>${lockBadge}</td>
        <td style="font-size:.78rem;color:var(--fg-2,#6b7280)">${escapeHtml(r.ip_hint || '—')}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Erreur : ${escapeHtml(e.message)}</td></tr>`;
  }
}

async function resolveSecurityAlert(id) {
  await sb.rpc('resolve_login_alert', { p_id: id });
  renderSecurityPanel();
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

// --------------------------------------------------------------------------
// Bandeau résiliations en attente (sidebar + dashboard admin)
// --------------------------------------------------------------------------
function renderResiliationAlerts() {
  if (!isAdmin()) return;

  const STATUTS_ALERT = ['Demande de résiliation', 'Résiliation en attente Stripe', 'Erreur résiliation'];
  const pending = (state.contracts || []).filter(c => STATUTS_ALERT.includes(c.statut));

  // Sidebar
  const sidebarEl = document.getElementById('resiliation-pending-alert');
  const listEl    = document.getElementById('resiliation-pending-list');
  if (!sidebarEl || !listEl) return;

  if (!pending.length) { sidebarEl.classList.add('is-hidden'); return; }
  sidebarEl.classList.remove('is-hidden');

  listEl.innerHTML = pending.map(ct => {
    const contact = (state.contacts || []).find(c => c.id === ct.contact_id);
    const clientNom  = contact?.nom || '—';
    const refContrat = 'CT-' + ct.id.slice(0, 8).toUpperCase();
    const dateDemande = ct.resiliation_demande_at ? formatDate(ct.resiliation_demande_at.slice(0,10)) : '—';
    const stripeId   = ct.stripe_subscription_id || '';

    const isErreur  = ct.statut === 'Erreur résiliation';
    const isAttente = ct.statut === 'Résiliation en attente Stripe';
    const isDemande = ct.statut === 'Demande de résiliation';

    return `<div class="mini-item" style="flex-direction:column;align-items:flex-start;gap:8px;padding:12px;border-left:3px solid ${isErreur ? '#fc8181' : '#f59e0b'}">
      <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:4px">
        <strong style="font-size:.85rem">${escapeHtml(clientNom)}</strong>
        <span class="badge ${isErreur ? 'badge-red' : 'badge-orange'}" style="font-size:.7rem">${escapeHtml(ct.statut)}</span>
      </div>
      <div class="mut" style="font-size:.78rem">
        ${escapeHtml(refContrat)} · ${escapeHtml(ct.type || '—')}${ct.formule ? ' ' + escapeHtml(ct.formule) : ''}<br>
        Demande le : ${dateDemande}
      </div>
      ${isErreur ? `
        <div style="background:rgba(252,129,129,.08);border:1px solid rgba(252,129,129,.3);border-radius:6px;padding:8px 10px;font-size:.78rem;color:#fc8181;width:100%;box-sizing:border-box">
          ⚠️ Résiliation non confirmée par Stripe après 48 h.<br>
          Vérifiez l'abonnement directement dans Stripe.
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${stripeId ? `<a href="https://dashboard.stripe.com/subscriptions/${escapeHtml(stripeId)}" target="_blank" rel="noopener" class="btn btn-out btn-sm" style="font-size:.75rem">🔗 Ouvrir dans Stripe</a>` : ''}
          <button class="btn btn-pri btn-sm" style="font-size:.75rem" onclick="resynchroResiliation('${escapeHtml(ct.id)}')">🔄 Relancer</button>
        </div>` : ''}
      ${isDemande ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-danger btn-sm" style="font-size:.75rem" onclick="validerResiliation('${escapeHtml(ct.id)}')">✅ Résiliation validée</button>
          <button class="btn btn-out btn-sm" style="font-size:.75rem" onclick="rejeterResiliation('${escapeHtml(ct.id)}')">✗ Rejeter</button>
        </div>` : ''}
      ${isAttente ? `<span class="mut" style="font-size:.75rem">🔄 Traitement Stripe en cours…</span>` : ''}
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
// MODULE RÉSULTATS — Cockpit commercial (Gestion → Résultats)
// =========================================================

// Filtres actifs du cockpit
let _resultatsFilters = { region: '', departement: '', secteur: '', niveau2: '', niveau1: '', statut: '' };
let _resultatsDetailUserId = null; // userId affiché en drill-down

// Point d'entrée : adapte l'affichage selon le rôle
function renderResultats() {
  const container  = document.getElementById('resultats-main-container');
  const title      = document.getElementById('resultats-view-title');
  const subtitle   = document.getElementById('resultats-view-subtitle');
  const actionsEl  = document.getElementById('resultats-view-actions');
  if (!container) return;

  _resultatsDetailUserId = null;

  if (!isAtLeast('dci')) {
    // Niveau 1 → affiche ses propres objectifs dans view-objectifs
    $all('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'objectifs' || b.dataset.view === 'resultats'));
    $all('.view').forEach(v => {
      v.classList.toggle('active',
        v.id === 'view-objectifs' || (v.id === 'view-resultats' && false));
    });
    renderObjectifs();
    return;
  }

  if (title)   title.textContent   = '📊 Résultats';
  if (subtitle) subtitle.textContent = isRole('dci')
    ? 'Cockpit de votre secteur — production de votre équipe'
    : 'Cockpit commercial — performance par secteur et par équipe';
  if (actionsEl) actionsEl.innerHTML = '';

  container.innerHTML = '<p class="empty" style="padding:20px">Chargement…</p>';
  renderResultatsCockpit(container);
}

// Vue cockpit : filtres + cartes secteurs
async function renderResultatsCockpit(container) {
  // Récupérer les bordereaux pour afficher les statuts de commission
  let bordereaux = [];
  try {
    const { data } = await sb.from('bordereau_log').select('*').order('generated_at', { ascending: false });
    bordereaux = data || [];
  } catch(e) {}
  state._bordereaux = bordereaux;

  // Construire les cartes par secteur
  const allProfiles = Object.values(state.profilesById);
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Déterminer les Niveau 2 visibles selon le rôle
  let niveau2Users = allProfiles.filter(p => p.role === 'dci');
  if (isRole('dci')) niveau2Users = niveau2Users.filter(p => p.id === state.user.id);

  // Filtres actifs
  const f = _resultatsFilters;
  if (f.region)      niveau2Users = niveau2Users.filter(p => (p.region||'').toLowerCase().includes(f.region.toLowerCase()));
  if (f.departement) niveau2Users = niveau2Users.filter(p => (p.departement||'').toLowerCase().includes(f.departement.toLowerCase()));
  if (f.secteur)     niveau2Users = niveau2Users.filter(p => (p.secteur||'').toLowerCase().includes(f.secteur.toLowerCase()));
  if (f.niveau2)     niveau2Users = niveau2Users.filter(p => p.id === f.niveau2);

  // Construire les données pour les cartes
  const cards = [];
  for (const dci of niveau2Users) {
    // Niveau 1 rattachés
    let niveau1 = allProfiles.filter(p => p.dci_parent_id === dci.id && p.role === 'user');
    if (f.niveau1) niveau1 = niveau1.filter(p => p.id === f.niveau1);

    // Liste d'utilisateurs pour calcul : DCI + ses Niveau 1
    const teamIds = [dci.id, ...niveau1.map(p => p.id)];

    // KPIs
    const contratsActifs = state.contracts.filter(c => teamIds.includes(c.created_by) && c.statut === 'Contrat en cours').length;
    const contratsSigPeriode = state.contracts.filter(c => {
      if (!teamIds.includes(c.created_by)) return false;
      if (!c.date_debut) return false;
      const d = new Date(c.date_debut + 'T00:00:00');
      return d >= startMonth && d <= endMonth && ['Contrat en cours','Terminé'].includes(c.statut);
    }).length;
    const ca = state.contracts
      .filter(c => teamIds.includes(c.created_by) && ['Contrat en cours','Terminé'].includes(c.statut) && c.date_debut && new Date(c.date_debut+'T00:00:00') >= startMonth)
      .reduce((s, c) => s + Math.max(0, (Number(c.montant)||0) - (Number(c.remise)||0)), 0);
    const caRecurrent = state.contracts
      .filter(c => teamIds.includes(c.created_by) && c.recurrence === 'Mensuel' && c.statut === 'Contrat en cours')
      .reduce((s, c) => s + Math.max(0, (Number(c.montant)||0) - (Number(c.remise)||0)), 0);
    const totalContacts = state.contacts.filter(c => teamIds.includes(c.created_by)).length;
    const tauxTransfo = totalContacts > 0 ? Math.round((contratsSigPeriode / totalContacts) * 100) : 0;

    // Objectifs
    const tCa    = getObjectifTarget(dci.id, 'ca_genere');
    const tComm  = getObjectifTarget(dci.id, 'commissions');
    const rComm  = computeMonthlyCommission(dci.id);
    const tauxAtteinte = tCa > 0 ? Math.round((ca / tCa) * 100) : 0;

    // Dernière activité
    const lastContrat = state.contracts
      .filter(c => teamIds.includes(c.created_by))
      .map(c => c.updated_at || c.created_at)
      .sort().pop();
    const lastContact = state.contacts
      .filter(c => teamIds.includes(c.created_by))
      .map(c => c.updated_at || c.created_at)
      .sort().pop();
    const lastActivity = [lastContrat, lastContact].filter(Boolean).sort().pop();

    // Bordereau DCI
    const periodeKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const bord = bordereaux.find(b => b.user_id === dci.id && b.periode === periodeKey);

    cards.push({ dci, niveau1, contratsActifs, contratsSigPeriode, ca, caRecurrent, tauxTransfo, tauxAtteinte, tCa, tComm, rComm, lastActivity, bord, periodeKey });
  }

  // Rendu filtres
  const filtersHtml = _buildResultatsFilters(allProfiles, niveau2Users);

  if (!cards.length) {
    container.innerHTML = filtersHtml + `<p class="empty" style="padding:30px 0">Aucun secteur trouvé${Object.values(f).some(Boolean) ? ' pour ces filtres.' : '.'}</p>`;
    _bindResultatsFilters();
    return;
  }

  // Rendu cartes
  const cardsHtml = cards.map(c => _buildSecteurCard(c)).join('');
  container.innerHTML = filtersHtml + `<div class="secteur-card-grid">${cardsHtml}</div>`;
  _bindResultatsFilters();
}

function _buildResultatsFilters(allProfiles, niveau2Users) {
  const regions  = [...new Set(allProfiles.filter(p => p.region).map(p => p.region))].sort();
  const depts    = [...new Set(allProfiles.filter(p => p.departement).map(p => p.departement))].sort();
  const secteurs = [...new Set(allProfiles.filter(p => p.secteur).map(p => p.secteur))].sort();
  const f = _resultatsFilters;
  return `
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;align-items:flex-end">
    <div>
      <div style="font-size:.7rem;font-weight:700;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em">Région</div>
      <select id="rf-region" class="form-control" style="font-size:.82rem;padding:6px 10px">
        <option value="">Toutes</option>
        ${regions.map(r => `<option value="${escapeHtml(r)}" ${f.region===r?'selected':''}>${escapeHtml(r)}</option>`).join('')}
      </select>
    </div>
    <div>
      <div style="font-size:.7rem;font-weight:700;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em">Département</div>
      <select id="rf-departement" class="form-control" style="font-size:.82rem;padding:6px 10px">
        <option value="">Tous</option>
        ${depts.map(d => `<option value="${escapeHtml(d)}" ${f.departement===d?'selected':''}>${escapeHtml(d)}</option>`).join('')}
      </select>
    </div>
    <div>
      <div style="font-size:.7rem;font-weight:700;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em">Secteur</div>
      <select id="rf-secteur" class="form-control" style="font-size:.82rem;padding:6px 10px">
        <option value="">Tous</option>
        ${secteurs.map(s => `<option value="${escapeHtml(s)}" ${f.secteur===s?'selected':''}>${escapeHtml(s)}</option>`).join('')}
      </select>
    </div>
    <div>
      <div style="font-size:.7rem;font-weight:700;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em">Niveau 2</div>
      <select id="rf-niveau2" class="form-control" style="font-size:.82rem;padding:6px 10px">
        <option value="">Tous</option>
        ${niveau2Users.map(u => `<option value="${u.id}" ${f.niveau2===u.id?'selected':''}>${escapeHtml((u.prenom||'')+(u.nom?' '+u.nom:''))}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-out btn-sm" onclick="_resetResultatsFilters()" style="font-size:.76rem">↺ Réinitialiser</button>
  </div>`;
}

function _bindResultatsFilters() {
  const apply = () => {
    _resultatsFilters.region      = document.getElementById('rf-region')?.value || '';
    _resultatsFilters.departement = document.getElementById('rf-departement')?.value || '';
    _resultatsFilters.secteur     = document.getElementById('rf-secteur')?.value || '';
    _resultatsFilters.niveau2     = document.getElementById('rf-niveau2')?.value || '';
    const c = document.getElementById('resultats-main-container');
    if (c) renderResultatsCockpit(c);
  };
  ['rf-region','rf-departement','rf-secteur','rf-niveau2'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', apply);
  });
}

function _resetResultatsFilters() {
  _resultatsFilters = { region: '', departement: '', secteur: '', niveau2: '', niveau1: '', statut: '' };
  const c = document.getElementById('resultats-main-container');
  if (c) renderResultatsCockpit(c);
}

// Construction d'une carte secteur
function _buildSecteurCard(c) {
  const dci = c.dci;
  const nom = [dci.prenom, dci.nom].filter(Boolean).join(' ') || '—';
  const _geoRaw = [dci.region, dci.departement, dci.secteur].filter(Boolean).join(' · ');
  const geo = _geoRaw ? escapeHtml(_geoRaw) : '<span class="mut" style="font-size:.75rem">Géographie non renseignée</span>';

  // Badge statut commission
  let commBadge = '';
  if (c.bord) {
    const statut = c.bord.statut || 'Bordereau envoyé';
    const cls = { 'Bordereau envoyé': 'commission-envoyé', 'Facture en attente': 'commission-attente', 'Facture reçue': 'commission-recue', 'Facture payée': 'commission-payée' }[statut] || 'commission-envoyé';
    const ico = { 'Bordereau envoyé': '🔵', 'Facture en attente': '🟣', 'Facture reçue': '🟢', 'Facture payée': '👍' }[statut] || '🔵';
    commBadge = `<span class="commission-badge ${cls}">${ico} ${escapeHtml(statut)}</span>`;
  }

  // Bouton bordereau / suivi commission
  const bordBtns = _buildBordereauButtons(dci.id, c.bord, c.periodeKey);

  const taux = c.tauxAtteinte;
  const tauxColor = taux >= 100 ? '#22c55e' : taux >= 75 ? '#f59e0b' : '#3b82f6';

  return `
  <div class="secteur-card" onclick="openResultatsDetail('${escapeHtml(dci.id)}')" id="sc-${escapeHtml(dci.id)}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:12px">
      <div>
        <div style="font-family:var(--ff-disp);font-weight:700;color:#fff;font-size:1rem">${escapeHtml(nom)}</div>
        <div style="font-size:.78rem;color:#64748b;margin-top:3px">🤝 DCI (Niveau 2)</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.72rem;font-weight:700;color:${tauxColor}">${taux}%</div>
        <div style="font-size:.65rem;color:#64748b">d'objectif</div>
      </div>
    </div>
    <div style="font-size:.78rem;color:#94a3b8;margin-bottom:12px">📍 ${geo}</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:.72rem;color:#64748b">Niveau 1 rattachés</span>
      <span style="font-size:.8rem;font-weight:700;color:#fff">${c.niveau1.length}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px">
        <div style="font-size:.65rem;color:#64748b;margin-bottom:2px">Contrats actifs</div>
        <div style="font-size:1.1rem;font-weight:700;color:#fff">${c.contratsActifs}</div>
      </div>
      <div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px">
        <div style="font-size:.65rem;color:#64748b;margin-bottom:2px">Signés ce mois</div>
        <div style="font-size:1.1rem;font-weight:700;color:#3b82f6">${c.contratsSigPeriode}</div>
      </div>
      <div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px">
        <div style="font-size:.65rem;color:#64748b;margin-bottom:2px">CA ce mois</div>
        <div style="font-size:.9rem;font-weight:700;color:#f59e0b">${formatMoney(c.ca)}</div>
      </div>
      <div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px">
        <div style="font-size:.65rem;color:#64748b;margin-bottom:2px">CA récurrent</div>
        <div style="font-size:.9rem;font-weight:700;color:#22c55e">${formatMoney(c.caRecurrent)}/m</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:.75rem;color:#64748b">Taux de transfo</span>
      <span style="font-size:.8rem;font-weight:700;color:#fff">${c.tauxTransfo}%</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:.75rem;color:#64748b">Dernière activité</span>
      <span style="font-size:.78rem;color:#94a3b8">${c.lastActivity ? new Date(c.lastActivity).toLocaleDateString('fr-FR') : '—'}</span>
    </div>
    ${commBadge ? `<div style="margin-bottom:10px">${commBadge}</div>` : ''}
    <div onclick="event.stopPropagation()" style="display:flex;flex-wrap:wrap;gap:6px">
      ${bordBtns}
    </div>
  </div>`;
}

// Boutons bordereau selon statut
function _buildBordereauButtons(userId, bord, periodeKey) {
  if (!bord) {
    return `<button class="btn btn-out btn-sm" onclick="event.stopPropagation();_genererBordereauCockpit('${escapeHtml(userId)}','${escapeHtml(periodeKey)}')" style="font-size:.75rem">
      📄 Envoyer le bordereau
    </button>`;
  }
  const statut = bord.statut || 'Bordereau envoyé';
  const btn = [];
  if (statut === 'Bordereau envoyé' || statut === 'Facture en attente') {
    btn.push(`<button class="btn btn-out btn-sm" onclick="event.stopPropagation();_updateCommissionStatut('${escapeHtml(bord.id)}','Facture reçue')" style="font-size:.72rem;color:#4ade80;border-color:rgba(34,197,94,.4)">🟢 Marquer facture reçue</button>`);
  }
  if (statut === 'Facture reçue') {
    btn.push(`<button class="btn btn-out btn-sm" onclick="event.stopPropagation();_updateCommissionStatut('${escapeHtml(bord.id)}','Facture payée')" style="font-size:.72rem;color:#fbbf24;border-color:rgba(245,158,11,.4)">👍 Marquer payée</button>`);
  }
  btn.push(`<button class="btn btn-out btn-sm" onclick="event.stopPropagation();openResultatsDetail('${escapeHtml(userId)}')" style="font-size:.72rem">📊 Détail</button>`);
  return btn.join('');
}

// Générer un bordereau depuis le cockpit
async function _genererBordereauCockpit(userId, periodeKey) {
  state._resultatsUserId = userId;
  const u = state.profilesById[userId];
  if (!u) return;
  const pdfResult = generateBordereauCommission();
  // Mettre à jour le statut dans la DB
  const now = new Date().toISOString();
  const nomAdmin = [state.profile?.prenom, state.profile?.nom].filter(Boolean).join(' ');
  const history  = [
    { statut: 'Bordereau envoyé',  date: now, user_id: state.user.id, user_nom: nomAdmin },
    { statut: 'Facture en attente', date: now, auto: true },
  ];
  await sb.from('bordereau_log').upsert({
    user_id: userId, periode: periodeKey,
    statut: 'Facture en attente',
    statut_history: history,
    sent_at: now, sent_by: state.user.id,
  }, { onConflict: 'user_id,periode' });
  // Envoyer email Brevo au commercial
  try {
    const { data: { session } } = await sb.auth.getSession();
    await fetch(`${SUPABASE_URL}/functions/v1/send-crm-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ type: 'bordereau', user_id: userId, periode: periodeKey, montant_ttc: pdfResult?.totalTTC || 0, nb_contrats: pdfResult?.nbContrats || 0, pdf_base64: pdfResult?.pdfBase64 || null }),
    });
  } catch (e) { console.warn('Email bordereau non envoyé :', e); }
  // Rafraîchir
  const c = document.getElementById('resultats-main-container');
  if (c) await renderResultatsCockpit(c);
}

// Mettre à jour le statut commission
async function _updateCommissionStatut(bordereauId, newStatut) {
  const bord = (state._bordereaux || []).find(b => b.id === bordereauId);
  if (!bord) return;
  const now     = new Date().toISOString();
  const nomUser = [state.profile?.prenom, state.profile?.nom].filter(Boolean).join(' ');
  const history = [...(bord.statut_history || []), { statut: newStatut, date: now, user_id: state.user.id, user_nom: nomUser }];
  const { error } = await sb.from('bordereau_log')
    .update({ statut: newStatut, statut_history: history })
    .eq('id', bordereauId);
  if (error) { alert('Erreur : ' + error.message); return; }
  // Email Brevo au commercial quand la commission est payée
  if (newStatut === 'Facture payée') {
    try {
      const { data: { session } } = await sb.auth.getSession();
      await fetch(`${SUPABASE_URL}/functions/v1/send-crm-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ type: 'commission_payee', bordereau_id: bordereauId }),
      });
    } catch (e) { console.warn('Email commission payée non envoyé :', e); }
  }
  const c = document.getElementById('resultats-main-container');
  if (c) await renderResultatsCockpit(c);
}

// Vue détail d'un secteur (drill-down Niveau 1)
function openResultatsDetail(userId) {
  const dci = state.profilesById[userId];
  if (!dci) return;
  _resultatsDetailUserId = userId;

  const niveau1 = Object.values(state.profilesById).filter(p => p.dci_parent_id === userId && p.role === 'user');
  const container = document.getElementById('resultats-main-container');
  if (!container) return;

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const periodeKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  // DCI row
  const dciRow = _buildUserDetailRow(dci, startMonth, endMonth);

  // Niveau 1 rows
  const n1Rows = niveau1.map(u => _buildUserDetailRow(u, startMonth, endMonth)).join('');

  const backLabel = isRole('dci') ? '' : `<button class="btn btn-out btn-sm" onclick="renderResultats()" style="margin-bottom:16px">← Retour au cockpit</button>`;

  container.innerHTML = `
    ${backLabel}
    <div style="margin-bottom:20px">
      <div style="font-family:var(--ff-disp);font-weight:700;color:#fff;font-size:1.2rem">
        Secteur : ${escapeHtml([dci.region, dci.departement, dci.secteur].filter(Boolean).join(' · ') || 'Non renseigné')}
      </div>
      <div style="font-size:.82rem;color:#64748b;margin-top:2px">DCI responsable : ${escapeHtml([dci.prenom,dci.nom].filter(Boolean).join(' ')||'—')}</div>
    </div>

    <!-- Détail DCI -->
    <div style="margin-bottom:24px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:10px">👨‍💼 DCI (Niveau 2)</div>
      <div class="panel-block" style="margin-bottom:0">
        ${_buildUserDetailCard(dci, startMonth, endMonth, periodeKey)}
      </div>
    </div>

    <!-- Niveau 1 rattachés -->
    <div>
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:10px">👤 Niveau 1 rattachés (${niveau1.length})</div>
      ${niveau1.length
        ? `<div style="display:flex;flex-direction:column;gap:12px">${niveau1.map(u => `<div class="panel-block" style="margin-bottom:0">${_buildUserDetailCard(u, startMonth, endMonth, periodeKey)}</div>`).join('')}</div>`
        : '<p class="empty">Aucun Niveau 1 rattaché à ce DCI.</p>'}
    </div>`;
}

function _buildUserDetailCard(u, startMonth, endMonth, periodeKey) {
  const nom          = [u.prenom, u.nom].filter(Boolean).join(' ') || '—';
  const geo          = [u.region, u.departement, u.secteur].filter(Boolean).join(' · ') || '—';
  const contratsSig  = state.contracts.filter(c => c.created_by === u.id && c.date_debut && new Date(c.date_debut+'T00:00:00') >= startMonth && new Date(c.date_debut+'T00:00:00') <= endMonth && ['Contrat en cours','Terminé'].includes(c.statut)).length;
  const contratsAct  = state.contracts.filter(c => c.created_by === u.id && c.statut === 'Contrat en cours').length;
  const ca           = state.contracts.filter(c => c.created_by === u.id && ['Contrat en cours','Terminé'].includes(c.statut) && c.date_debut && new Date(c.date_debut+'T00:00:00') >= startMonth).reduce((s,c) => s + Math.max(0,(Number(c.montant)||0)-(Number(c.remise)||0)), 0);
  const caRec        = state.contracts.filter(c => c.created_by === u.id && c.recurrence === 'Mensuel' && c.statut === 'Contrat en cours').reduce((s,c) => s + Math.max(0,(Number(c.montant)||0)-(Number(c.remise)||0)), 0);
  const totalContact = state.contacts.filter(c => c.created_by === u.id).length;
  const tauxTransfo  = totalContact > 0 ? Math.round((contratsSig / totalContact) * 100) : 0;
  const tCa          = getObjectifTarget(u.id, 'ca_genere');
  const tauxAtteinte = tCa > 0 ? Math.round((ca / tCa) * 100) : 0;
  const tComm        = getObjectifTarget(u.id, 'commissions');
  const rComm        = computeMonthlyCommission(u.id);
  const tauxColor    = tauxAtteinte >= 100 ? '#22c55e' : tauxAtteinte >= 75 ? '#f59e0b' : '#3b82f6';

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-weight:700;color:#fff;font-size:.95rem">${escapeHtml(nom)}</div>
        <div style="font-size:.76rem;color:#64748b;margin-top:2px">📍 ${escapeHtml(geo)}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,auto);gap:16px;text-align:right">
        <div><div style="font-size:.65rem;color:#64748b">Actifs</div><div style="font-weight:700;color:#fff">${contratsAct}</div></div>
        <div><div style="font-size:.65rem;color:#64748b">Signés</div><div style="font-weight:700;color:#3b82f6">${contratsSig}</div></div>
        <div><div style="font-size:.65rem;color:#64748b">CA mois</div><div style="font-weight:700;color:#f59e0b">${formatMoney(ca)}</div></div>
        <div><div style="font-size:.65rem;color:#64748b">Récurrent</div><div style="font-weight:700;color:#22c55e">${formatMoney(caRec)}/m</div></div>
      </div>
    </div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:10px">
      <span style="font-size:.78rem;color:#94a3b8">Taux de transfo : <b style="color:#fff">${tauxTransfo}%</b></span>
      <span style="font-size:.78rem;color:#94a3b8">Objectif CA : <b style="color:#fff">${formatMoney(tCa)}</b></span>
      <span style="font-size:.78rem;color:#94a3b8">Atteinte : <b style="color:${tauxColor}">${tauxAtteinte}%</b></span>
      <span style="font-size:.78rem;color:#94a3b8">Commissions : <b style="color:#f59e0b">${formatMoney(rComm)} / ${formatMoney(tComm)}</b></span>
    </div>`;
}

function _buildUserDetailRow(u, startMonth, endMonth) { return ''; } // utilisé plus bas si nécessaire

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
  if (typeof logRgpd === 'function') logRgpd('export_bordereau_commission', 'Contrats', {
    donnees: 'prénom commercial, SIRET, TVA, commissions, montants contrats',
    criticite: 'Attention',
    details: { commercial: u.prenom || null, periode: moisLabel },
  });
  return { pdfBase64: doc.output('datauristring').split(',')[1], totalTTC, nbContrats: newC.length + recC.length };
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
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Aucun utilisateur.</td></tr>';
    return;
  }
  const now = new Date();
  const roleLabels = {
    'super_admin': '⚡ Super Admin',
    'admin_candy': '⚙️ Admin (Niveau 3)',
    'dci':         '🤝 DCI (Niveau 2)',
    'user':        '👤 Utilisateur (Niveau 1)',
  };
  tbody.innerHTML = state.adminUsers.map(u => {
    const bannedUntil  = u.banned_until ? new Date(u.banned_until) : null;
    const isBanned     = bannedUntil && bannedUntil > now;
    // Distinguer blocage temporaire (< 1h = login failures) vs révocation permanente
    const isLocked     = isBanned && bannedUntil < new Date(now.getTime() + 3600_000);
    const isRevoked    = isBanned && !isLocked;
    const isSelf       = u.id === state.user.id;
    const role         = u.role || (u.is_admin ? 'admin_candy' : 'user');
    const roleLbl      = roleLabels[role] || '👤 Utilisateur';
    const profil       = u.profil_completed ? '🟢' : '🔴';
    const revoc        = u.profil_revocation_flag ? ' <span class="badge badge-red" style="font-size:.62rem">⚠ Révocation</span>' : '';

    let statutBadge;
    if (isLocked)       statutBadge = '<span class="badge badge-orange" title="Bloqué après 5 tentatives échouées">🔒 Bloqué</span>';
    else if (isRevoked) statutBadge = '<span class="badge badge-red">Révoqué</span>';
    else                statutBadge = '<span class="badge badge-green">Actif</span>';

    return `
      <tr class="${isBanned ? 'row-banned' : ''}">
        <td>${escapeHtml(u.prenom || '—')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td><span class="badge badge-gray" style="font-size:.72rem">${roleLbl}</span></td>
        <td style="text-align:center;font-size:1.1rem" title="${u.profil_completed ? 'Profil complet' : 'Profil incomplet'}">${profil}${revoc}</td>
        <td>${statutBadge}</td>
        <td class="nowrap mut" style="font-size:.82rem">${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
        <td class="actions">
          <button class="btn btn-out btn-sm" onclick="openEditUserModal('${u.id}')" ${isSelf ? 'disabled' : ''} title="Modifier">✏️ Modifier</button>
          <button class="btn btn-out btn-sm" data-admin-message="${u.id}" ${isSelf ? 'disabled' : ''}>Message</button>
          ${isLocked ? `<button class="btn btn-pri btn-sm" onclick="adminDebloquer('${u.id}','${escapeHtml(u.email||'')}')">🔓 Débloquer</button>` : `<button class="btn btn-out btn-sm" data-admin-toggle-admin="${u.id}" ${isSelf ? 'disabled title="Vous ne pouvez pas modifier votre propre rôle"' : ''}>${u.is_admin ? 'Révoquer admin' : 'Rendre admin'}</button>`}
          <button class="btn btn-danger btn-sm" data-admin-delete="${u.id}" ${isSelf ? 'disabled title="Vous ne pouvez pas supprimer votre propre compte"' : ''}>Supprimer</button>
        </td>
      </tr>`;
  }).join('');
}

// Modale édition utilisateur (niveau 3/4)
function openEditUserModal(userId) {
  const u = state.adminUsers.find(x => x.id === userId);
  if (!u) return;

  let modal = document.getElementById('edit-user-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'edit-user-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="box" style="max-width:480px">
        <h3>✏️ Modifier l'utilisateur</h3>
        <p class="mut" style="font-size:.8rem;margin-bottom:14px">Les informations sont en lecture seule. Seul le rôle est modifiable.</p>
        <input type="hidden" id="eu-id">
        <div class="field"><label>Prénom</label><input id="eu-prenom" type="text" readonly style="opacity:.6;cursor:default"></div>
        <div class="field"><label>Nom</label><input id="eu-nom" type="text" readonly style="opacity:.6;cursor:default"></div>
        <div class="field"><label>Téléphone</label><input id="eu-telephone" type="tel" readonly style="opacity:.6;cursor:default"></div>
        <div class="field"><label>Adresse</label><input id="eu-adresse" type="text" readonly style="opacity:.6;cursor:default"></div>
        <div class="field"><label>SIRET</label><input id="eu-siret" type="text" readonly style="opacity:.6;cursor:default"></div>
        <div class="field"><label>N° RC Pro</label><input id="eu-rcpro" type="text" readonly style="opacity:.6;cursor:default"></div>
        <div class="field" style="border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 12px;background:rgba(255,255,255,.03)">
          <label>N° de mandat</label>
          <input id="eu-numero-mandat" type="text" placeholder="Ex : M-2024-001">
        </div>
        <div class="field" style="border:1px solid var(--accent);border-radius:8px;padding:10px 12px;background:rgba(59,130,246,.04)">
          <label style="color:var(--accent)">🎭 Rôle (modifiable)</label>
          <select id="eu-role" style="margin-top:4px">
            <option value="user">👤 Utilisateur (Niveau 1)</option>
            <option value="dci">🤝 DCI (Niveau 2)</option>
            <option value="admin_candy">⚙️ Admin (Niveau 3)</option>
          </select>
        </div>
        <div class="field" style="border:1px solid rgba(245,158,11,.35);border-radius:8px;padding:10px 12px;background:rgba(245,158,11,.04)">
          <label style="color:#f59e0b">🌍 Quota Google Places / mois (modifiable)</label>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <input id="eu-limite-places" type="number" min="0" max="500" step="1"
              style="width:100px;margin:0"
              placeholder="20">
            <span style="font-size:.78rem;color:var(--mut)">requêtes / mois · défaut : 20</span>
          </div>
        </div>
        <p class="error" id="eu-error"></p>
        <div class="modal-actions">
          <button class="btn btn-out" onclick="$('#edit-user-modal').classList.remove('show')">Fermer</button>
          <button class="btn btn-pri" onclick="saveEditUser()">Enregistrer</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  document.getElementById('eu-id').value            = u.id;
  document.getElementById('eu-prenom').value        = u.prenom       || '—';
  document.getElementById('eu-nom').value           = u.nom          || '—';
  document.getElementById('eu-telephone').value     = u.telephone    || '—';
  document.getElementById('eu-adresse').value       = u.adresse      || '—';
  document.getElementById('eu-siret').value         = u.siret        || '—';
  document.getElementById('eu-rcpro').value         = u.rcpro_numero || '—';
  document.getElementById('eu-numero-mandat').value = u.numero_mandat || '';
  document.getElementById('eu-role').value          = u.role || 'user';
  document.getElementById('eu-limite-places').value = u.limite_requetes_google_places ?? 20;
  document.getElementById('eu-error').textContent = '';
  document.getElementById('edit-user-modal').classList.add('show');
}

async function saveEditUser() {
  const id      = document.getElementById('eu-id').value;
  const prenom  = document.getElementById('eu-prenom').value.trim();
  const role    = document.getElementById('eu-role').value;
  const errEl   = document.getElementById('eu-error');
  if (!prenom) { errEl.textContent = 'Le prénom est obligatoire.'; return; }

  const numeroMandat   = document.getElementById('eu-numero-mandat')?.value?.trim() || null;
  const limiteRaw      = parseInt(document.getElementById('eu-limite-places')?.value, 10);
  const limiteGPlaces  = (!isNaN(limiteRaw) && limiteRaw >= 0) ? limiteRaw : 20;

  const { error } = await sb.from('profiles').update({
    role,
    is_admin: ['admin_candy','super_admin'].includes(role),
    numero_mandat: numeroMandat,
    limite_requetes_google_places: limiteGPlaces,
  }).eq('id', id);

  if (error) { errEl.textContent = 'Erreur : ' + error.message; return; }
  document.getElementById('edit-user-modal').classList.remove('show');
  await loadAdminUsers();
  renderAdminUsers();
}


async function adminToggleAdmin(userId) {
  const u = state.adminUsers.find(x => x.id === userId);
  if (!u) return;
  if (!confirm(u.is_admin
    ? `Rétrograder ${u.prenom || u.email} ? Il/elle ne verra plus l'onglet Administration.`
    : `Promouvoir ${u.prenom || u.email} super-administrateur ? Il/elle aura accès à tous les chiffres et à la gestion des comptes.`)) return;
  const { error } = await sb.rpc('admin_set_admin', { target_user_id: userId, make_admin: !u.is_admin });
  if (error) { alert("Erreur : " + error.message); return; }
  if (typeof logRgpd === 'function') logRgpd('role_utilisateur_modifie', 'Administration', {
    entityType: 'utilisateur', entityId: userId, criticite: 'Critique',
    donnees: 'rôle, is_admin',
    details: { utilisateur: u.prenom || u.email, action: !u.is_admin ? 'Promotion admin' : 'Rétrogradation admin' },
  });
  await loadAdminUsers();
  renderAdminUsers();
}

async function adminDeleteUser(userId) {
  const u = state.adminUsers.find(x => x.id === userId);
  if (!u) return;
  const label = u.prenom ? `${u.prenom} ${u.nom || ''}`.trim() : u.email;
  const manager = u.dci_parent_id
    ? (state.profilesById?.[u.dci_parent_id]?.prenom || 'le manager NIV2')
    : 'un administrateur';

  if (!confirm(
    `⚠️ SUPPRESSION DÉFINITIVE — ${label}\n\n` +
    `Actions qui seront effectuées :\n` +
    `• Profil et accès supprimés définitivement\n` +
    `• Données personnelles archivées 5 ans (RGPD) dans un fichier sécurisé\n` +
    `• Contacts et contrats réassignés à : ${manager}\n\n` +
    `Pour bloquer sans supprimer, utilisez "Révoquer" à la place.\n\n` +
    `Continuer ?`
  )) return;

  const typed = prompt(`Pour confirmer, tapez exactement : ${label}`);
  if (typed !== label) { alert('Suppression annulée (texte non identique).'); return; }

  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) { alert('Session expirée — reconnectez-vous.'); return; }

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ target_user_id: userId }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || !body.ok) {
      alert('Erreur lors de la suppression : ' + (body.error || `HTTP ${resp.status}`));
      return;
    }
  } catch (e) {
    alert('Erreur réseau : ' + e.message);
    return;
  }

  if (typeof logRgpd === 'function') logRgpd('utilisateur_supprime', 'Administration', {
    entityType: 'utilisateur', entityId: userId, criticite: 'Critique',
    donnees: 'user_id, email, profil — archivé dans Storage (archives/)',
    details: { utilisateur: label, email: u.email },
  });

  alert(`✅ Compte ${label} supprimé. Données archivées pour 5 ans (RGPD).`);
  await loadAdminUsers();
  renderAdminUsers();
  await loadAllProfiles();
  renderContacts();
  renderContracts();
}

// ═══════════════════════════════════════════
// ARCHIVES UTILISATEURS (RGPD 5 ans)
// ═══════════════════════════════════════════

async function loadArchivedUsers() {
  const { data, error } = await sb.from('archived_users').select('*').order('archived_at', { ascending: false });
  if (error) { console.error('Erreur chargement archives:', error); return []; }
  state.archivedUsers = data || [];
  return state.archivedUsers;
}

function renderArchivedUsers() {
  const el = document.getElementById('archives-list');
  if (!el) return;
  const list = state.archivedUsers || [];
  if (!list.length) {
    el.innerHTML = '<p class="empty">Aucun utilisateur archivé.</p>';
    return;
  }
  el.innerHTML = `<table class="tbl">
    <thead><tr>
      <th>Nom</th><th>E-mail</th><th>N° mandat</th><th>Rôle</th>
      <th>Archivé le</th><th>Suppression le</th><th>Actions</th>
    </tr></thead>
    <tbody>${list.map(a => {
      const archiveDate  = new Date(a.archived_at).toLocaleDateString('fr-FR');
      const deleteDate   = new Date(a.delete_after).toLocaleDateString('fr-FR');
      const nom = [a.prenom, a.nom].filter(Boolean).join(' ') || '—';
      return `<tr>
        <td>${escapeHtml(nom)}</td>
        <td class="mut">${escapeHtml(a.email)}</td>
        <td>${escapeHtml(a.numero_mandat || '—')}</td>
        <td><span class="badge badge-gray" style="font-size:.72rem">${escapeHtml(a.role || '—')}</span></td>
        <td class="mut" style="font-size:.82rem">${archiveDate}</td>
        <td class="mut" style="font-size:.82rem">${deleteDate}</td>
        <td class="actions">
          <button class="btn btn-out btn-sm" onclick="downloadUserArchive('${escapeHtml(a.storage_path)}','${escapeHtml(nom)}')">⬇ JSON</button>
          <button class="btn btn-out btn-sm" onclick="exportArchivePdf('${a.id}')">📄 PDF</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

async function downloadUserArchive(storagePath, label) {
  const { data, error } = await sb.storage.from('archives').createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) { alert('Erreur accès archive : ' + (error?.message || 'URL non disponible')); return; }
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = storagePath.split('/').pop() || 'archive.json';
  a.click();
}

async function exportArchivePdf(archiveId) {
  const archive = (state.archivedUsers || []).find(a => a.id === archiveId);
  if (!archive) return;

  // Récupérer le JSON depuis Storage
  const { data: urlData } = await sb.storage.from('archives').createSignedUrl(archive.storage_path, 60);
  if (!urlData?.signedUrl) { alert('Archive introuvable.'); return; }

  let archiveJson;
  try {
    const resp = await fetch(urlData.signedUrl);
    archiveJson = await resp.json();
  } catch { alert('Impossible de lire l\'archive.'); return; }

  const nom = [archive.prenom, archive.nom].filter(Boolean).join(' ') || archive.email;
  const archiveDate = new Date(archive.archived_at).toLocaleDateString('fr-FR');
  const deleteDate  = new Date(archive.delete_after).toLocaleDateString('fr-FR');

  const win = window.open('', '_blank');
  const nomS          = escapeHtml(nom);
  const mandatS       = escapeHtml(archive.numero_mandat || '—');
  const emailS        = escapeHtml(archive.email);
  const roleS         = escapeHtml(archive.role || '—');
  const userIdS       = escapeHtml(archive.original_user_id);
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Archive RGPD — ${nomS}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:13px;color:#1e293b;padding:32px;max-width:800px;margin:auto}
      h1{font-size:20px;border-bottom:2px solid #2563eb;padding-bottom:8px;color:#2563eb}
      h2{font-size:15px;margin-top:24px;color:#334155}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      td,th{padding:7px 10px;border:1px solid #e2e8f0;font-size:12px}
      th{background:#f1f5f9;font-weight:600}
      .meta{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-bottom:20px}
      .meta p{margin:4px 0;font-size:12px}
      @media print{.no-print{display:none}}
    </style>
  </head><body>
    <div class="no-print" style="margin-bottom:20px">
      <button onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Imprimer / Enregistrer PDF</button>
    </div>
    <h1>🗄 Archive RGPD — ${nomS}</h1>
    <div class="meta">
      <p><strong>Objet :</strong> Conservation légale 5 ans (Art. L123-22 C.com)</p>
      <p><strong>Archivé le :</strong> ${archiveDate}</p>
      <p><strong>Suppression prévue le :</strong> ${deleteDate}</p>
      <p><strong>N° de mandat :</strong> ${mandatS}</p>
    </div>
    <h2>Identité</h2>
    <table>
      <tr><th>Champ</th><th>Valeur</th></tr>
      <tr><td>Nom complet</td><td>${nomS}</td></tr>
      <tr><td>E-mail</td><td>${emailS}</td></tr>
      <tr><td>Rôle</td><td>${roleS}</td></tr>
      <tr><td>ID utilisateur</td><td>${userIdS}</td></tr>
    </table>
    <h2>Journal RGPD (${(archiveJson.journal_rgpd || []).length} entrées)</h2>
    <table>
      <tr><th>Date</th><th>Action</th><th>Module</th><th>Criticité</th></tr>
      ${(archiveJson.journal_rgpd || []).slice(0, 200).map(l =>
        `<tr><td>${new Date(l.created_at).toLocaleDateString('fr-FR')}</td>
         <td>${escapeHtml(l.action || '')}</td><td>${escapeHtml(l.module || '')}</td><td>${escapeHtml(l.criticite || '')}</td></tr>`
      ).join('')}
    </table>
  </body></html>`);
  win.document.close();
}

async function adminToggleBan(userId, banned) {
  const u = state.adminUsers.find(x => x.id === userId);
  if (!u) return;
  if (!confirm(banned
    ? `Révoquer ${u.prenom || u.email} ? Il/elle ne pourra plus se connecter.`
    : `Restaurer l'accès pour ${u.prenom || u.email} ?`)) return;
  const { error } = await sb.rpc('admin_set_banned', { target_user_id: userId, banned });
  if (error) { alert("Erreur : " + error.message); return; }
  if (typeof logRgpd === 'function') logRgpd(banned ? 'utilisateur_bloque' : 'utilisateur_debloque', 'Administration', {
    entityType: 'utilisateur', entityId: userId, criticite: 'Critique',
    donnees: 'statut connexion',
    details: { utilisateur: u.prenom || u.email, email: u.email, action: banned ? 'Accès révoqué' : 'Accès restauré' },
  });
  await loadAdminUsers();
  renderAdminUsers();
}

// Déblocage d'un compte temporairement suspendu suite à 5 tentatives échouées
async function adminDebloquer(userId, email) {
  if (!confirm(`Débloquer le compte de ${email} ?\n\nLe compteur d'échecs sera réinitialisé.`)) return;
  const { error } = await sb.rpc('admin_set_banned', { target_user_id: userId, banned: false });
  if (error) { alert('Erreur déblocage : ' + error.message); return; }
  // Réinitialiser le compteur d'échecs en base
  const { error: e2 } = await sb.rpc('reset_login_attempts', { user_email: email });
  if (e2) console.warn('reset_login_attempts:', e2.message);
  await loadAdminUsers();
  renderAdminUsers();
  if (typeof logRgpd === 'function') logRgpd('profil_modifie', 'Admin', {
    donnees: 'Déblocage compte après suspension', criticite: 'Attention',
    details: { user_id: userId, email },
  });
}

function openNewUserModal() {
  $('#nu-prenom').value = '';
  $('#nu-email').value = '';
  $('#nu-password').value = '';
  if ($('#nu-numero-mandat')) $('#nu-numero-mandat').value = '';
  $('#nu-error').textContent = '';
  // Peupler le sélecteur manager (DCI / NIV2)
  const sel = $('#nu-manager-id');
  if (sel) {
    const managers = Object.values(state.profilesById || {}).filter(p => p.role === 'dci' || p.is_admin);
    sel.innerHTML = '<option value="">— Aucun (admin par défaut) —</option>'
      + managers.map(p => `<option value="${p.id}">${escapeHtml(p.prenom || '')} ${escapeHtml(p.nom || '')} (${p.role || 'admin'})</option>`).join('');
  }
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

  // Recharger depuis Supabase pour éviter les faux positifs sur données en cache
  $('#nu-error').textContent = 'Vérification en cours…';
  await loadAdminUsers();
  const emailExistant = (state.adminUsers || []).find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (emailExistant) {
    $('#nu-error').textContent = "Cet e-mail est déjà utilisé par un compte existant (" + (emailExistant.prenom || emailExistant.email) + "). Utilisez une adresse différente.";
    return;
  }
  $('#nu-error').textContent = '';
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
        numero_mandat: $('#nu-numero-mandat')?.value?.trim() || null,
        dci_parent_id: $('#nu-manager-id')?.value || null,
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

    // Ouvrir la modale d'envoi des identifiants
    ouvrirMailIdentifiants(email, password, prenom);
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
async function openMyDataModal() {
  if (!state.user) return;
  const p = state.profile || {};
  const html = `
    <div class="field"><label>Prénom</label><input id="myd-prenom" type="text" value="${escapeHtml(p.prenom || '')}"></div>
    <div class="field-row">
      <div class="field"><label>E-mail</label><input type="email" value="${escapeHtml(state.user.email || '')}" disabled></div>
      <div class="field"><label>Rôle</label><input type="text" value="${escapeHtml(p.role || '—')}" disabled></div>
    </div>
    <div class="field-row">
      <div class="field"><label>N° mandat</label><input type="text" value="${escapeHtml(p.numero_mandat || '—')}" disabled></div>
      <div class="field"><label>Identifiant interne</label><input type="text" value="${escapeHtml(state.user.id || '')}" disabled style="font-size:.78rem"></div>
    </div>`;
  $('#mydata-content').innerHTML = html;
  // Charger les stats en arrière-plan
  const statsEl = $('#mydata-export-stats');
  if (statsEl) {
    statsEl.textContent = 'Chargement des statistiques…';
    try {
      const [{ count: nbContacts }, { count: nbContrats }, { count: nbTaches }] = await Promise.all([
        sb.from('contacts').select('id', { count: 'exact', head: true }).eq('created_by', state.user.id),
        sb.from('contracts').select('id', { count: 'exact', head: true }).eq('created_by', state.user.id),
        sb.from('tasks').select('id', { count: 'exact', head: true }).eq('created_by', state.user.id),
      ]);
      statsEl.innerHTML = `Données associées à votre compte : <strong>${nbContacts ?? 0}</strong> contacts · <strong>${nbContrats ?? 0}</strong> contrats · <strong>${nbTaches ?? 0}</strong> tâches`;
    } catch { statsEl.textContent = ''; }
  }
  $('#mydata-modal').classList.add('show');
}

async function exportMyDataCSV() {
  if (!state.user) return;
  const btn = $('#mydata-export-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Préparation…'; }
  try {
    const [{ data: profil }, { data: contacts }, { data: contrats }, { data: taches }] = await Promise.all([
      sb.from('profiles').select('*').eq('id', state.user.id).single(),
      sb.from('contacts').select('nom,prenom,email,telephone,entreprise,statut,created_at').eq('created_by', state.user.id).order('created_at'),
      sb.from('contracts').select('type,formule,montant,recurrence,statut,date_debut,date_echeance,created_at').eq('created_by', state.user.id).order('created_at'),
      sb.from('tasks').select('titre,statut,priorite,echeance,created_at').eq('created_by', state.user.id).order('created_at'),
    ]);

    const csvBlocks = [];
    const toCSV = (rows, label) => {
      if (!rows?.length) return `=== ${label} ===\nAucune donnée\n\n`;
      const keys = Object.keys(rows[0]);
      const lines = [keys.join(';'), ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(';'))];
      return `=== ${label} ===\n${lines.join('\n')}\n\n`;
    };

    csvBlocks.push(`S@FE CRM — Export de données personnelles (Art.20 RGPD)\nDate d'export : ${new Date().toLocaleString('fr-FR')}\nUtilisateur : ${state.user.email}\n\n`);
    csvBlocks.push(toCSV(profil ? [profil] : [], 'Profil'));
    csvBlocks.push(toCSV(contacts, 'Contacts créés'));
    csvBlocks.push(toCSV(contrats, 'Contrats créés'));
    csvBlocks.push(toCSV(taches, 'Tâches créées'));

    const blob = new Blob([csvBlocks.join('')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safe-crm-mes-donnees-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof logRgpd === 'function') {
      await logRgpd('export_donnees_personnelles', 'RGPD', {
        criticite: 'Moyen', donnees: 'Profil, Contacts, Contrats, Tâches', resultat: 'Succès',
        details: { article: 'Art.20 RGPD — Portabilité' },
      });
    }
  } catch (e) {
    alert('Erreur lors de l\'export : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Exporter mes données (CSV)'; }
  }
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

// → déplacé dans contacts/contacts-transfer.js : openTransferModal, confirmTransferContact

// --- Envoi du bon de commande au client (lien de paiement Stripe) ---
// → déplacé dans contracts/contracts-pdf.js : sendOrderLink, generateContractPDF
// → déplacé dans totp/totp.js : TOTP_REQUIRED_ROLES, refreshTOTPStatus, openTotpEnroll,
//   verifyTotpEnroll, disableTotp, _logTotpEvent, challengeTOTPIfNeeded, _forceTotpEnrollment

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
    categories: "Nom, prénom, entreprise, e-mail, Téléphone, adresse, SIRET, consentements, notes commerciales",
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
  if (typeof logRgpd === 'function') logRgpd('export_registre_pdf', 'RGPD', {
    donnees: 'Registre Article 30 RGPD complet',
    criticite: 'Critique',
  });
}

function initProfileAddressListeners() {
  const cpInput  = document.getElementById('profile-code-postal');
  const villeEl  = document.getElementById('profile-ville');
  const regionEl = document.getElementById('profile-region');
  const deptEl   = document.getElementById('profile-departement');
  if (!cpInput || !villeEl) return;

  let _communes = [];

  function _applyGeo(commune) {
    if (regionEl) regionEl.value = commune.region?.nom || '';
    if (deptEl)   deptEl.value   = commune.departement
      ? commune.codeDepartement + ' — ' + commune.departement.nom
      : commune.codeDepartement || '';
  }

  cpInput.addEventListener('input', async function () {
    const cp = this.value.trim();
    villeEl.innerHTML = '<option value="">— Saisissez un code postal —</option>';
    if (regionEl) regionEl.value = '';
    if (deptEl)   deptEl.value   = '';
    _communes = [];
    if (cp.length !== 5 || !/^\d{5}$/.test(cp)) return;

    villeEl.innerHTML = '<option value="">Recherche…</option>';
    try {
      const resp = await fetch(
        'https://geo.api.gouv.fr/communes?codePostal=' + encodeURIComponent(cp) +
        '&fields=nom,codeDepartement,departement,region&format=json'
      );
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      _communes = await resp.json();
      if (!Array.isArray(_communes) || !_communes.length) {
        villeEl.innerHTML = '<option value="">Aucune commune trouvée</option>';
        return;
      }
      villeEl.innerHTML = _communes
        .map(c => `<option value="${escapeHtml(c.nom)}">${escapeHtml(c.nom)}</option>`)
        .join('');
      _applyGeo(_communes[0]);
    } catch (e) {
      villeEl.innerHTML = '<option value="">Erreur — réessayez</option>';
    }
  });

  villeEl.addEventListener('change', function () {
    const c = _communes.find(x => x.nom === this.value);
    if (c) _applyGeo(c);
  });
}

// ── MONITORING ERREURS JS ────────────────────────────────────────────────────

function initErrorMonitoring() {
  const IGNORE = [
    /Script error/i,
    /ResizeObserver loop/i,
    /Extension context invalidated/i,
    /Non-Error promise rejection/i,
    /Loading chunk/i,
  ];

  const _seen = new Map(); // message → timestamp dernière capture

  async function _reportError(message, source, err) {
    const msg = String(message || 'Unknown error').slice(0, 500);
    if (IGNORE.some(r => r.test(msg))) return;

    const now = Date.now();
    if (_seen.has(msg) && now - _seen.get(msg) < 30000) return;
    _seen.set(msg, now);

    try {
      await sb.from('audit_logs').insert({
        user_id:            state?.user?.id   || null,
        user_role:          state?.profile?.role || 'inconnu',
        action:             'js_error',
        module:             'Monitoring',
        criticite:          'Critique',
        resultat:           'Erreur',
        donnees_concernees: null,
        details: {
          message: msg,
          source:  String(source || '').slice(0, 300),
          stack:   err?.stack?.slice(0, 1000) || null,
          url:     location.href,
        },
      });
    } catch { /* éviter la boucle infinie */ }
  }

  window.addEventListener('error', e => {
    _reportError(e.message, (e.filename || '') + (e.lineno ? ':' + e.lineno : ''), e.error);
  });

  window.addEventListener('unhandledrejection', e => {
    const reason = e.reason;
    _reportError(
      'Promise rejetée : ' + (reason?.message || String(reason)).slice(0, 300),
      null,
      reason instanceof Error ? reason : null,
    );
  });
}

// ── VIOLATION DE DONNÉES — Art. 33 RGPD ─────────────────────────────────────

function openViolationModal() {
  const today = new Date().toISOString().slice(0, 10);
  const dateEl = document.getElementById('violation-date');
  if (dateEl && !dateEl.value) dateEl.value = today;
  document.getElementById('violation-modal').classList.add('show');
}

function closeViolationModal() {
  document.getElementById('violation-modal').classList.remove('show');
}

async function submitViolation() {
  const desc       = (document.getElementById('violation-desc')?.value || '').trim();
  const date       = document.getElementById('violation-date')?.value || '';
  const categories = (document.getElementById('violation-categories')?.value || '').trim();
  const nb         = document.getElementById('violation-nb')?.value || '';

  if (!desc) { alert('La description de la violation est obligatoire.'); return; }

  const btn = document.getElementById('btn-violation-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours…'; }

  try {
    const { data: { session } } = await sb.auth.getSession();
    const resp = await fetch(
      'https://qwzqatfewbzwrvqhvpbo.supabase.co/functions/v1/send-crm-email',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({
          type: 'violation_cnil',
          description: desc,
          date_decouverte: date,
          categories_donnees: categories || null,
          nb_personnes: nb ? parseInt(nb, 10) : null,
        }),
      }
    );
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    if (typeof logRgpd === 'function') {
      await logRgpd('incident_nis2_declare', 'RGPD', {
        criticite: 'Critique',
        donnees: categories || 'Non précisé',
        resultat: 'Succès',
        details: {
          date_decouverte: date,
          description: desc,
          nb_personnes: nb || null,
          alerte_email: 'Envoyée',
          lien_cnil: 'https://notifications.cnil.fr',
        },
      });
    }

    closeViolationModal();
    document.getElementById('violation-desc').value       = '';
    document.getElementById('violation-categories').value = '';
    document.getElementById('violation-nb').value         = '';

    alert('✅ Alerte envoyée à l\'administrateur.\nViolation enregistrée dans le journal RGPD.\n\nÉtape suivante : déclarer sur https://notifications.cnil.fr (délai 72h Art.33)');
  } catch (e) {
    console.error('[Violation CNIL]', e);
    alert('Erreur lors de l\'envoi. Réessayez ou contactez le support.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🚨 Envoyer l\'alerte & journaliser'; }
  }
}

function initModalAria() {
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let _trap = null;
  let _lastFocus = null;

  function trapFocus(box, e) {
    if (e.key !== 'Tab') return;
    const els = [...box.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function onShow(modal) {
    const box = modal.querySelector('.box,.modal-box');
    if (!box) return;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const heading = box.querySelector('h2,h3,h4');
    if (heading) {
      if (!heading.id) heading.id = modal.id + '-aria-title';
      box.setAttribute('aria-labelledby', heading.id);
    }
    _lastFocus = document.activeElement;
    const first = box.querySelector(FOCUSABLE);
    if (first) setTimeout(() => first.focus(), 50);
    if (_trap) document.removeEventListener('keydown', _trap);
    _trap = (e) => trapFocus(box, e);
    document.addEventListener('keydown', _trap);
  }

  function onHide() {
    if (_trap) { document.removeEventListener('keydown', _trap); _trap = null; }
    if (_lastFocus?.focus) { _lastFocus.focus(); _lastFocus = null; }
  }

  $all('.modal').forEach(modal => {
    new MutationObserver(() => {
      if (modal.classList.contains('show')) onShow(modal);
      else onHide();
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  });
}

function bindEvents() {
  initErrorMonitoring();
  initModalAria();

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
// → déplacé dans contacts/contacts-address.js : initContactAddressListeners
  initContactAddressListeners();
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
    $('#ct-remise').classList.toggle('is-hidden', !e.target.checked);
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
  initProfileAddressListeners();

  // Objectifs
  $('#save-jours-btn').addEventListener('click', saveJoursTravailles);
  $('#btn-edit-objectifs')?.addEventListener('click', openObjectifsModal);
  $('#objectifs-cancel-btn').addEventListener('click', closeObjectifsModal);
  $('#objectifs-save-btn').addEventListener('click', saveObjectifsModal);

  // --- Administration ---
  $all('[data-admin-tab]').forEach(b => b.addEventListener('click', () => switchAdminTab(b.dataset.adminTab)));
  // Résultats : back depuis le détail
  $('#resultats-back-btn')?.addEventListener('click', renderResultats);
  $('#resultats-bordereau-btn')?.addEventListener('click', generateBordereauCommission);
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
  $('#mydata-export-btn')?.addEventListener('click', exportMyDataCSV);
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
  document.getElementById('contract-demander-resiliation-btn')?.addEventListener('click', () => {
    const contractId = document.getElementById('contract-demander-resiliation-btn').dataset.contractId;
    demanderResiliation(contractId);
  });

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

// → déplacé dans contacts/contacts-address.js : checkRgpdExpiry
// → déplacé dans contacts/contacts-interactions.js : renderInteractions, openInteractionModal, closeInteractionModal, saveInteraction, deleteInteraction


// ==========================================================================
// RÉSILIATION ABONNEMENT STRIPE
// ==========================================================================

// → déplacé dans contracts/contracts-stripe.js : openResilierModal, closeResilierModal, confirmResilierAbonnement, openCustomerPortal


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
    if (block) block.classList.add('is-hidden');
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
    if (!users.length) { block.classList.add('is-hidden'); return; }

    block.classList.remove('is-hidden');
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
      block.classList.remove('is-hidden');
      const list = document.getElementById('help-requests-list');
      list.innerHTML = adminRequests.map(r => {
        const profile = state.profilesById?.[r.user_id];
        const nom = profile?.prenom || r.user_id.slice(0,8);
        return `<div class="mini-item">
          <div>
            <div class="t">${escapeHtml(nom)} — ${escapeHtml(r.sujet)}</div>
            <div class="s">${escapeHtml(r.message.slice(0,120))}${r.message.length > 120 ? '…' : ''}</div>
            <div class="s mut">${formatDate(r.created_at.slice(0,10))}</div>
          </div>
          <button class="btn btn-ok btn-sm btn-action-inline" onclick="traiterHelpRequest('${r.id}')">
            ✅ Traité
          </button>
        </div>`;
      }).join('');
    } else {
      block.classList.add('is-hidden');
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
      myBlock.classList.remove('is-hidden');
      const myList = document.getElementById('my-help-requests-list');
      myList.innerHTML = toShow.map(r => `
        <div class="mini-item">
          <div>
            <div class="t">${escapeHtml(r.sujet)}</div>
            <div class="s">${escapeHtml(r.message.slice(0,100))}${r.message.length > 100 ? '…' : ''}</div>
            <div class="s mut">Envoyée le ${formatDate(r.created_at.slice(0,10))} — En attente de traitement</div>
          </div>
          <button class="btn btn-out btn-sm btn-action-inline" onclick="vuHelpRequest('${r.id}')">
            👁 Vu
          </button>
          <button class="btn btn-danger btn-sm btn-action-inline" onclick="terminerHelpRequest('${r.id}')">
            ✕ Terminé
          </button>
        </div>`).join('');
    } else {
      myBlock.classList.add('is-hidden');
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
// ==========================================================================
// JOURNAL D'ACTIVITÉ
// ==========================================================================

const _JOURNAL_ACTION_LABELS = {
  contact_cree:         'Contact créé',
  contact_modifie:      'Contact modifié',
  contact_supprime:     'Contact supprimé',
  contrat_cree:         'Contrat créé',
  contrat_modifie:      'Contrat modifié',
  contrat_supprime:     'Contrat supprimé',
  interaction_creee:    'Interaction créée',
  tache_creee:          'Tâche créée',
  tache_completee:      'Tâche terminée',
  profil_modifie:       'Profil modifié',
  utilisateur_cree:     'Utilisateur créé',
  utilisateur_supprime: 'Utilisateur supprimé',
  utilisateur_bloque:   'Utilisateur bloqué',
  utilisateur_debloque: 'Utilisateur débloqué',
  paiement_confirme:    'Paiement confirmé',
  export_effectue:      'Export effectué',
  purge_effectuee:      'Purge RGPD',
};

const _JOURNAL_MODULE_COLORS = {
  Contacts:       '#3b82f6',
  Contrats:       '#8b5cf6',
  Profil:         '#f59e0b',
  Administration: '#ef4444',
  Tâches:         '#22c55e',
  RGPD:           '#06b6d4',
};

async function loadJournalView() {
  const container = document.getElementById('journal-view-container');
  const subtitle  = document.getElementById('journal-view-subtitle');
  const filterSel = document.getElementById('journal-filter-user');
  if (!container) return;

  container.innerHTML = '<p class="empty" style="padding:40px;text-align:center">Chargement…</p>';

  // Filtre utilisateur (admin uniquement)
  const admin = isAdmin();
  if (filterSel) {
    filterSel.classList.toggle('is-hidden', !admin);
    if (admin && filterSel.options.length <= 1) {
      // Peupler le filtre une seule fois
      (state.adminUsers || []).forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = (u.prenom ? u.prenom + ' ' : '') + (u.nom || u.email || u.id);
        filterSel.appendChild(opt);
      });
      filterSel.onchange = loadJournalView;
    }
  }

  const selectedUserId = admin && filterSel?.value ? filterSel.value : null;

  let query = sb.from('audit_logs')
    .select('action, module, details, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!admin) {
    // Utilisateur standard : ses entrées uniquement
    query = query.eq('user_id', state.user.id);
  } else if (selectedUserId) {
    // Admin avec filtre actif
    query = query.eq('user_id', selectedUserId);
  }

  const { data, error } = await query;

  if (error) {
    container.innerHTML = `<p class="empty" style="padding:40px;text-align:center">Erreur : ${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data?.length) {
    container.innerHTML = '<p class="empty" style="padding:40px;text-align:center">Aucune action enregistrée.</p>';
    return;
  }

  if (subtitle) subtitle.textContent = `${data.length} action${data.length > 1 ? 's' : ''} · 100 dernières entrées`;

  // Construire un index prenom/nom par user_id pour la colonne "Utilisateur" (admin)
  const userIndex = {};
  if (admin) {
    (state.adminUsers || []).forEach(u => {
      userIndex[u.id] = (u.prenom ? u.prenom + ' ' : '') + (u.nom || u.email || u.id);
    });
  }

  const adminCol = admin ? '<th style="text-align:left;padding:8px 10px;font-size:.72rem;color:#64748b;font-weight:600;white-space:nowrap">Utilisateur</th>' : '';

  const rows = data.map(e => {
    const d      = e.details || {};
    const detail = d.entreprise || d.nom || d.type || d.objet || d.email || '—';
    const date   = new Date(e.created_at).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    const label  = _JOURNAL_ACTION_LABELS[e.action] || e.action || '—';
    const module = e.module || '—';
    const color  = _JOURNAL_MODULE_COLORS[module] || '#64748b';
    const userCell = admin
      ? `<td style="font-size:.78rem;color:#cbd5e1;white-space:nowrap;padding:8px 10px">${escapeHtml(userIndex[e.user_id] || e.user_id?.slice(0,8) || '—')}</td>`
      : '';
    return `<tr style="border-bottom:1px solid rgba(255,255,255,.04)">
      <td style="font-size:.76rem;color:#64748b;white-space:nowrap;padding:8px 10px">${date}</td>
      <td style="font-size:.82rem;color:#e2e8f0;padding:8px 10px">${escapeHtml(label)}</td>
      <td style="padding:8px 10px"><span style="font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:20px;background:${color}22;color:${color}">${escapeHtml(module)}</span></td>
      <td style="font-size:.78rem;color:#94a3b8;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:8px 10px" title="${escapeHtml(String(detail))}">${escapeHtml(String(detail))}</td>
      ${userCell}
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="panel-block" style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,.1)">
            <th style="text-align:left;padding:8px 10px;font-size:.72rem;color:#64748b;font-weight:600;white-space:nowrap">Date / heure</th>
            <th style="text-align:left;padding:8px 10px;font-size:.72rem;color:#64748b;font-weight:600">Action</th>
            <th style="text-align:left;padding:8px 10px;font-size:.72rem;color:#64748b;font-weight:600">Module</th>
            <th style="text-align:left;padding:8px 10px;font-size:.72rem;color:#64748b;font-weight:600">Détail</th>
            ${adminCol}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ==========================================================================
// MUR DE SIGNATURE — Clause de confidentialité + Charte d'usage du SI
// ==========================================================================

async function _checkAndShowSignatureWall() {
  const userId = state.user.id;

  const { data: clause } = await sb.from('clauses_confidentialite')
    .select('id').eq('user_id', userId).maybeSingle();

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const { data: charte } = await sb.from('chartes_usage_si')
    .select('id').eq('user_id', userId)
    .gte('signed_at', oneYearAgo.toISOString())
    .maybeSingle();

  if (clause && charte) return false;

  // Pré-remplir le nom du signataire
  const nomAffiche = [state.profile?.prenom, state.profile?.nom].filter(Boolean).join(' ')
    || state.user.email;
  const el1 = document.getElementById('wall-clause-signataire');
  const el2 = document.getElementById('wall-charte-signataire');
  if (el1) el1.textContent = nomAffiche;
  if (el2) el2.textContent = nomAffiche;

  const wall = document.getElementById('onboarding-wall');
  wall.classList.remove('is-hidden');

  if (!clause) {
    wallSwitchTab('clause');
    _wallInitScroll('wall-clause-doc', 'wall-check-row-clause', 'accept-clause-check', 'wall-sign-clause-btn', 'wall-hint-clause');
  } else {
    _wallMarkDone('clause');
    wallSwitchTab('charte');
    _wallInitScroll('wall-charte-doc', 'wall-check-row-charte', 'accept-charte-check', 'wall-sign-charte-btn', 'wall-hint-charte');
  }
  if (!charte) {
    // init charte scroll uniquement si pas déjà affiché
  }
  return true;
}

function wallSwitchTab(tab) {
  document.getElementById('wall-panel-clause').classList.toggle('active', tab === 'clause');
  document.getElementById('wall-panel-charte').classList.toggle('active', tab === 'charte');
  document.getElementById('wall-step-clause').classList.toggle('active',
    tab === 'clause' && !document.getElementById('wall-step-clause').classList.contains('done'));
  document.getElementById('wall-step-charte').classList.toggle('active',
    tab === 'charte' && !document.getElementById('wall-step-charte').classList.contains('done'));
}

function _wallMarkDone(tab) {
  const step = document.getElementById('wall-step-' + tab);
  if (!step) return;
  step.classList.remove('active');
  step.classList.add('done');
  const num = document.getElementById('wall-step-num-' + tab);
  if (num) num.textContent = '✓';
  const lbl = document.getElementById('wall-step-label-' + tab);
  if (lbl) lbl.textContent = (tab === 'clause' ? 'Clause de confidentialité' : 'Charte d\'usage du SI');
}

function _wallInitScroll(docId, rowId, checkId, btnId, hintId) {
  const doc = document.getElementById(docId);
  const row = document.getElementById(rowId);
  const cb  = document.getElementById(checkId);
  const btn = document.getElementById(btnId);
  if (!doc || !cb || !btn) return;

  cb.disabled = true;
  btn.disabled = true;
  if (row) row.classList.remove('enabled');

  const unlock = () => {
    cb.disabled = false;
    btn.disabled = false;
    if (row) row.classList.add('enabled');
    const hint = document.getElementById(hintId);
    if (hint) hint.classList.add('is-hidden');
    doc.removeEventListener('scroll', onScroll);
  };

  const onScroll = () => {
    if (doc.scrollTop + doc.clientHeight >= doc.scrollHeight - 20) unlock();
  };

  // Déjà tout visible (doc court) → déverrouiller immédiatement
  if (doc.scrollHeight <= doc.clientHeight + 20) { unlock(); return; }
  doc.addEventListener('scroll', onScroll);

  cb.addEventListener('change', () => { btn.disabled = !cb.checked; });
}

async function wallSignClause() {
  const cb  = document.getElementById('accept-clause-check');
  const btn = document.getElementById('wall-sign-clause-btn');
  if (!cb?.checked) return;
  btn.disabled = true;
  btn.textContent = 'Enregistrement…';

  const { error } = await sb.from('clauses_confidentialite').insert({
    user_id:         state.user.id,
    nom_signataire:  [state.profile?.prenom, state.profile?.nom].filter(Boolean).join(' ') || '',
    email_signataire: state.user.email || '',
    user_agent:      navigator.userAgent,
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = '✅ Signer la clause de confidentialité';
    alert('Erreur lors de la signature : ' + error.message);
    return;
  }

  _wallMarkDone('clause');
  wallSwitchTab('charte');
  _wallInitScroll('wall-charte-doc', 'wall-check-row-charte', 'accept-charte-check', 'wall-sign-charte-btn', 'wall-hint-charte');
}

async function wallSignCharteSI() {
  const cb  = document.getElementById('accept-charte-check');
  const btn = document.getElementById('wall-sign-charte-btn');
  if (!cb?.checked) return;
  btn.disabled = true;
  btn.textContent = 'Enregistrement…';

  const { error } = await sb.from('chartes_usage_si').insert({
    user_id: state.user.id,
    version: '1.0',
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = '✅ Signer la charte d\'usage du SI';
    alert('Erreur lors de la signature : ' + error.message);
    return;
  }

  _wallMarkDone('charte');

  // Les deux signatures sont en place → fermer le mur et charger le CRM
  document.getElementById('onboarding-wall').classList.add('is-hidden');
  await _afterSignatures();
}

async function checkMandatSigne() {
  if (isAdmin()) return;
  try {
    const { data, error } = await sb.from('mandats')
      .select('id,statut')
      .eq('user_id', state.user.id)
      .eq('statut', 'signe')
      .maybeSingle();
    if (error) { console.warn('checkMandatSigne:', error); return; }
    if (!data) window.location.href = '/mandat.html';
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
  document.getElementById('cp-strength').classList.add('is-hidden');
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
    if (matchErr) matchErr.classList.toggle('is-hidden', !(input2.value && !match));
    saveBtn.disabled = !(v.valid && match);
  };

  input.addEventListener('input', () => {
    const pwd = input.value;
    const v = validatePassword(pwd);
    document.getElementById('cp-strength').classList.toggle('is-hidden', !pwd.length);

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

    await sb.from('profiles').update({
      password_set:        true,
      password_changed_at: new Date().toISOString(),
    }).eq('id', state.user.id);

    _sendPasswordChangedConfirmation(state.user?.email || '');
    closeChangePasswordModal();
    document.getElementById('password-renewal-banner').classList.add('is-hidden');

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
      if (banner) banner.classList.remove('is-hidden');
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

  if (!isLastOuvre) { block.classList.add('is-hidden'); return; }

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
    block.classList.add('is-hidden');
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

  block.classList.remove('is-hidden');
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

// → déplacé dans contracts/contracts-notifications.js : loadNotifContracts, marquerNotifLue, marquerToutesLues


// ==========================================================================
// RÉINITIALISATION DONNÉES TEST — admin, one-shot
// ==========================================================================

async function checkResetFlag() {
  if (!isAdmin()) return;
  const { data } = await sb.from('app_settings')
    .select('value').eq('key', 'reset_done').maybeSingle();
  const wrap = document.getElementById('reset-test-btn-wrap');
  if (wrap) {
    wrap.classList.toggle('is-hidden', data?.value !== 'false');
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
    document.getElementById('reset-test-btn-wrap').classList.add('is-hidden');

    // Recharger toutes les données depuis Supabase (les tâches sont préservées)
    await loadAll();
    alert('✅ Réinitialisation effectuée. Contacts, contrats et interactions supprimés. Les tâches ont été conservées.');
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

  if (!top.length) { block.classList.add('is-hidden'); return; }

  // Accordéon : replié par défaut, animation fluide
  if (block.classList.contains('is-hidden') || !block.dataset.initialized) {
    block.classList.remove('is-hidden');
    block.dataset.initialized = '1';
    if (!block.querySelector('.upsell-toggle')) {
      const h3 = block.querySelector('h3');
      if (h3) {
        h3.className = (h3.className + ' collapsible-head').trim();
        const arrow = document.createElement('span');
        arrow.className = 'upsell-toggle';
        arrow.textContent = '▼';
        h3.appendChild(arrow);
        const body = block.querySelector('.mini-list');
        if (body) body.classList.add('collapsible-body');
        h3.onclick = () => {
          const isOpen = arrow.classList.contains('is-open');
          arrow.classList.toggle('is-open', !isOpen);
          if (body) body.style.maxHeight = isOpen ? '0' : body.scrollHeight + 'px';
        };
      }
    }
  }
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

  if (!clientsAvecContrat.length) { block.classList.add('is-hidden'); return; }

  // Chercher la dernière interaction pour chaque client
  let interactions = [];
  try {
    const { data, error } = await sb
      .from('interactions')
      .select('contact_id, date')
      .in('contact_id', clientsAvecContrat.map(c => c.id))
      .order('date', { ascending: false });
    if (error) throw error;
    interactions = data || [];
  } catch (e) {
    console.error('loadChurnRisk:', e);
    block.classList.add('is-hidden');
    return;
  }

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

  if (!top.length) { block.classList.add('is-hidden'); return; }

  block.classList.remove('is-hidden');
  list.innerHTML = top.map(r => {
    const nom  = escapeHtml((r.contact.entreprise || r.contact.nom || '—').slice(0, 30));
    const j    = r.joursEcoules;
    const cls  = j >= 120 ? 'overdue' : j >= 90 ? 's' : 'mut';
    return `<div class="mini-item">
      <div>
        <div class="t churn-link" onclick="switchView('contacts');openContactModal('${r.contact.id}')">${nom}</div>
        <div class="s ${cls}">Dernier contact il y a <strong>${j} jours</strong></div>
      </div>
      <button class="btn btn-pri btn-sm btn-action-inline"
        onclick="switchView('contacts');openContactModal('${r.contact.id}')">
        📞 Relancer
      </button>
    </div>`;
  }).join('');
}


// ==========================================================================
// SYSTÈME DE RÔLES — 4 niveaux
// ==========================================================================
// role: 'user' | 'dci' | 'admin_candy' | 'super_admin'

function getRole() {
  return state.profile?.role || 'user';
}
function isRole(r) { return getRole() === r; }
function isAtLeast(r) {
  const order = ['user','dci','admin_candy','super_admin'];
  return order.indexOf(getRole()) >= order.indexOf(r);
}

// Compatibilité avec l'ancien isAdmin()
function isAdmin() {
  return isAtLeast('admin_candy');
}
function isSuperAdmin() { return isRole('super_admin'); }
function isDCI()        { return isRole('dci'); }
function isUser()       { return isRole('user'); }

// Appliquer la visibilité selon les rôles
function applyRoleVisibility() {
  const role = getRole();
  const order = ['user','dci','admin_candy','super_admin'];
  const level = order.indexOf(role);

  // Masquer/afficher selon data-min-role
  document.querySelectorAll('[data-min-role]').forEach(el => {
    const minRole = el.getAttribute('data-min-role');
    const minLevel = order.indexOf(minRole);
    el.classList.toggle('is-hidden', level < minLevel);
  });

  // Classes spécifiques
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('is-hidden', !isAdmin()));
  document.querySelectorAll('.super-admin-only').forEach(el => el.classList.toggle('is-hidden', !isSuperAdmin()));
  document.querySelectorAll('.dci-only').forEach(el => el.classList.toggle('is-hidden', !isAtLeast('dci')));
}

// Vérifier le profil complet + alerte révocation
// → déplacé dans contacts/contacts-address.js : checkProfilComplet

// MFA toutes les 4h
const MFA_CHECK_KEY = 'safe_mfa_last_check';
async function checkMFAExpiry() {
  if (!state.profile?.totp_proposed) return; // pas de MFA activée
  const lastCheck = parseInt(localStorage.getItem(MFA_CHECK_KEY) || '0');
  const elapsed   = Date.now() - lastCheck;
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  if (elapsed < FOUR_HOURS) return;

  // Vérifier si MFA est réellement activée sur le compte
  const { data: factors } = await sb.auth.mfa.listFactors();
  const hasTOTP = factors?.totp?.some(f => f.status === 'verified');
  if (!hasTOTP) return;

  // Ouvrir modale bloquante
  openMFACheckModal();
}

function openMFACheckModal() {
  let modal = document.getElementById('mfa-recheck-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mfa-recheck-modal';
    modal.className = 'mfa-modal';
    modal.innerHTML = `
      <div class="mfa-modal__box">
        <div class="mfa-modal__icon">🔐</div>
        <h3 class="mfa-modal__title">Vérification de sécurité</h3>
        <p class="mfa-modal__body">
          Votre session dure depuis 4 heures. Saisissez le code de votre application d'authentification pour continuer.
        </p>
        <input id="mfa-recheck-code" type="text" maxlength="6" placeholder="Code TOTP à 6 chiffres"
          class="mfa-modal__input">
        <div class="mfa-modal__error is-hidden" id="mfa-recheck-err">Code incorrect. Réessayez.</div>
        <button onclick="submitMFARecheck()" class="btn btn-pri btn--full">Vérifier</button>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.classList.remove('is-hidden');
}

async function submitMFARecheck() {
  const code = document.getElementById('mfa-recheck-code').value.trim();
  if (code.length !== 6) return;
  const errEl = document.getElementById('mfa-recheck-err');
  try {
    const { data: factors } = await sb.auth.mfa.listFactors();
    const factor = factors?.totp?.find(f => f.status === 'verified');
    if (!factor) return;
    const { data: challenge } = await sb.auth.mfa.challenge({ factorId: factor.id });
    const { error } = await sb.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
    if (error) {
      errEl.classList.remove('is-hidden');
      return;
    }
    localStorage.setItem(MFA_CHECK_KEY, String(Date.now()));
    document.getElementById('mfa-recheck-modal').classList.add('is-hidden');
  } catch(e) {
    errEl.classList.remove('is-hidden');
  }
}

// Upsell à la première connexion du jour
const UPSELL_DAY_KEY = 'safe_upsell_day';
function checkUpsellFirstLogin() {
  const today   = new Date().toISOString().slice(0,10);
  const lastDay = localStorage.getItem(UPSELL_DAY_KEY);
  if (lastDay === today) return;
  localStorage.setItem(UPSELL_DAY_KEY, today);
  // Afficher replié après 2 secondes
  setTimeout(() => {
    const block = document.getElementById('upsell-alert');
    if (block && block.innerHTML.trim() !== '') {
      block.classList.remove('is-hidden');
      const list  = block.querySelector('.mini-list');
      const arrow = block.querySelector('.upsell-toggle');
      if (list)  list.style.maxHeight = '0';
      if (arrow) arrow.classList.remove('is-open');
    }
  }, 2000);
}


// → déplacé dans contacts/contacts-interactions.js : openAddInteraction

// ==========================================================================
// BLOC 5 — GESTION ÉQUIPE DCI
// ==========================================================================

async function openEquipeModal() {
  document.getElementById('equipe-modal')?.classList.add('show');
  await loadEquipe();
}

async function loadEquipe() {
  const myId = state.user?.id;

  // Charger les membres de l'équipe (niveau 1 rattachés à ce DCI)
  const { data: membres, error } = await sb
    .from('profiles')
    .select('id, prenom, nom, profil_completed, profil_revocation_flag')
    .eq('dci_parent_id', myId)
    .eq('role', 'user');

  if (error) { console.error('loadEquipe:', error); return; }
  const equipe = membres || [];

  // Stats : CA et contrats de chaque membre
  const memberIds = equipe.map(m => m.id);
  let caTotal = 0;
  let allContracts = [];

  if (memberIds.length) {
    const { data: cts } = await sb
      .from('contracts')
      .select('created_by, montant, statut, recurrence')
      .in('created_by', memberIds)
      .not('statut', 'eq', 'Terminé');
    allContracts = cts || [];
    caTotal = allContracts.reduce((s, c) => s + (Number(c.montant) || 0), 0);
  }

  const primeCooptation = Math.round(caTotal * 0.03);

  // Mettre à jour les stats
  document.getElementById('eq-nb-membres').textContent  = equipe.length;
  document.getElementById('eq-ca-total').textContent    = caTotal.toLocaleString('fr-FR') + ' €';
  document.getElementById('eq-cooptation').textContent  = primeCooptation.toLocaleString('fr-FR') + ' €';

  // Rendu des membres
  const list = document.getElementById('equipe-membres-list');
  if (!equipe.length) {
    list.innerHTML = '<div class="mut" style="font-size:.85rem;padding:12px 0;text-align:center">Aucun membre dans votre équipe pour le moment.</div>';
    return;
  }

  list.innerHTML = equipe.map(m => {
    const mCts    = allContracts.filter(c => c.created_by === m.id);
    const mCA     = mCts.reduce((s, c) => s + (Number(c.montant) || 0), 0);
    const mPrime  = Math.round(mCA * 0.03);
    const profil  = m.profil_completed ? '🟢' : '🔴';
    const revoc   = m.profil_revocation_flag ? ' <span style="font-size:.65rem;color:var(--alert)">⚠ Révocation</span>' : '';
    return `
      <div class="panel-block" style="padding:12px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-weight:600;font-size:.88rem;color:var(--mut-2)">${profil} ${escapeHtml(m.prenom||'')} ${escapeHtml(m.nom||'')}${revoc}</div>
            <div class="mut" style="font-size:.76rem;margin-top:3px">
              ${mCts.length} contrat${mCts.length>1?'s':''} actif${mCts.length>1?'s':''} ·
              CA : <strong style="color:var(--accent)">${mCA.toLocaleString('fr-FR')} €</strong> ·
              Votre prime : <strong style="color:var(--gold)">${mPrime.toLocaleString('fr-FR')} €</strong>
            </div>
          </div>
          <button class="btn btn-out btn-sm" style="font-size:.72rem;padding:5px 10px"
            onclick="envoyerMessageMembre('${m.id}', '${escapeHtml(m.prenom||'')}')">
            💬 Message
          </button>
        </div>
      </div>`;
  }).join('');
}

async function envoyerMessageEquipe() {
  const texte = document.getElementById('equipe-message-text').value.trim();
  if (!texte) { alert('Rédigez un message avant d’envoyer.'); return; }

  const myId = state.user?.id;
  const { data: membres } = await sb.from('profiles')
    .select('id').eq('dci_parent_id', myId).eq('role', 'user');

  if (!membres?.length) { alert('Aucun membre dans votre équipe.'); return; }

  const inserts = membres.map(m => ({
    user_id: m.id,
    type:    'message_dci',
    titre:   '💬 Message de votre DCI',
    message: texte,
    data:    { from_id: myId, from_name: state.profile?.prenom || 'Votre DCI' }
  }));

  const { error } = await sb.from('notifications').insert(inserts);
  if (error) { alert('Erreur : ' + error.message); return; }

  document.getElementById('equipe-message-text').value = '';
  alert('✅ Message envoyé à toute votre équipe (' + membres.length + ' membre' + (membres.length>1?'s':'') + ').');
}

async function envoyerMessageMembre(memberId, prenom) {
  const texte = prompt(`Message pour ${prenom} :`);
  if (!texte?.trim()) return;

  const { error } = await sb.from('notifications').insert({
    user_id: memberId,
    type:    'message_dci',
    titre:   '💬 Message de votre DCI',
    message: texte.trim(),
    data:    { from_id: state.user?.id, from_name: state.profile?.prenom || 'Votre DCI' }
  });
  if (error) { alert('Erreur : ' + error.message); return; }
  alert('✅ Message envoyé à ' + prenom + '.');
}

// Notification messages DCI pour les membres niveau 1
async function loadMessagesDCI() {
  const block = document.getElementById('messages-dci-alert');
  if (!block || !state.profile?.dci_parent_id) return; // Uniquement si un DCI parent est assigné

  const { data, error } = await sb.from('notifications')
    .select('*')
    .eq('user_id', state.user?.id)
    .eq('type', 'message_dci')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !data?.length) { block.classList.add('is-hidden'); return; }

  block.classList.remove('is-hidden');
  const list = document.getElementById('messages-dci-list');
  list.innerHTML = data.map(n => {
    const from = n.data?.from_name || 'Votre DCI';
    return `
      <div class="mini-item">
        <div>
          <div class="t">💬 ${escapeHtml(from)}</div>
          <div class="s">${escapeHtml(n.message || '')}</div>
          <div class="s mut" style="font-size:.72rem">${formatDate(n.created_at.slice(0,10))}</div>
        </div>
        <button class="btn btn-ok btn-sm" style="font-size:.7rem;margin-left:8px;flex-shrink:0;background:var(--ok);color:#fff;border:none"
          onclick="marquerNotifLue('${n.id}')">✅ Lu</button>
      </div>`;
  }).join('');
}

// Ajouter prime de cooptation dans loadBordereauDCI
async function loadCooptationDCI() {
  if (!isAtLeast('dci') || !isRole('dci')) return;
  const myId = state.user?.id;

  // CA de l'équipe ce mois
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const { data: membres } = await sb.from('profiles')
    .select('id').eq('dci_parent_id', myId).eq('role', 'user');
  if (!membres?.length) return;

  const { data: cts } = await sb.from('contracts')
    .select('montant, date_debut, recurrence, statut')
    .in('created_by', membres.map(m => m.id))
    .not('statut', 'eq', 'Terminé');

  if (!cts?.length) return;

  const caEquipe = cts.reduce((s, c) => s + (Number(c.montant) || 0), 0);
  const prime    = Math.round(caEquipe * 0.03);

  if (prime <= 0) return;

  // Ajouter une ligne dans l'alerte bordereau DCI
  const list = document.getElementById('my-bordereau-list');
  if (!list) return;
  const existing = list.innerHTML;
  if (existing && prime > 0) {
    list.innerHTML += `
      <div class="mini-item" style="margin-top:8px;border-top:1px solid var(--line);padding-top:8px">
        <div>
          <div class="t">🤝 Prime de cooptation équipe</div>
          <div class="s">CA équipe ce mois : ${caEquipe.toLocaleString('fr-FR')} € · Prime 3% : <strong style="color:var(--gold)">${prime.toLocaleString('fr-FR')} €</strong></div>
          <div class="s mut" style="font-size:.72rem">À inclure dans votre facture mensuelle</div>
        </div>
      </div>`;
  }
}


// ==========================================================================
// ENVOI IDENTIFIANTS PAR EMAIL (mailto)
// ==========================================================================
function ouvrirMailIdentifiants(email, password, prenom) {
  var nom      = prenom || email.split('@')[0];
  var crmUrl   = 'https://crm.safe-digitalisation.fr';
  var guideUrl = 'https://crm.safe-digitalisation.fr/guide.html';
  var subject  = encodeURIComponent('[S@FE CRM] Vos identifiants de connexion');
  var bodyTxt  = 'Bonjour ' + nom + ',\n\n'
    + 'Bienvenue dans le CRM S@FE ! Voici vos identifiants de connexion :\n\n'
    + 'Adresse : ' + crmUrl + '\n'
    + 'Identifiant : ' + email + '\n'
    + 'Mot de passe temporaire : ' + password + '\n\n'
    + 'Merci de changer votre mot de passe des votre premiere connexion.\n\n'
    + 'Guide : ' + guideUrl + '\n\n'
    + 'Cordialement,\nL equipe S@FE Digitalisation\n01 84 16 26 89';
  var bodyEnc = encodeURIComponent(bodyTxt);

  var modal = document.getElementById('mail-identifiants-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mail-identifiants-modal';
    modal.className = 'modal show';
    document.body.appendChild(modal);
  }
  modal.className = 'modal show';

  var html = '';
  html += '<div class="box" style="max-width:520px">';
  html +=   '<h3>&#x2705; Compte créé — Envoyer les identifiants</h3>';
  html +=   '<p class="mut" style="font-size:.85rem;margin-bottom:16px">';
  html +=     'Le compte de <strong style="color:#fff">' + escapeHtml(nom) + '</strong>';
  html +=     ' (' + escapeHtml(email) + ') a été créé avec succès.<br>';
  html +=     'Cliquez sur le bouton ci-dessous pour ouvrir votre client email.';
  html +=   '</p>';
  html +=   '<div style="background:var(--navy-2);border:1px solid var(--line);border-radius:10px;padding:14px 16px;font-size:.82rem;line-height:1.8;margin-bottom:20px">';
  html +=     '<div><span class="mut">Destinataire :</span> <strong style="color:#fff">' + escapeHtml(email) + '</strong></div>';
  html +=     '<div><span class="mut">Identifiant :</span> <strong style="color:#fff">' + escapeHtml(email) + '</strong></div>';
  html +=     '<div><span class="mut">Mot de passe :</span>';
  html +=       '<strong style="color:var(--gold);font-family:var(--ff-mono)">' + escapeHtml(password) + '</strong>';
html +=       '<button class="btn-copy" data-password="' + escapeHtml(password) + '" style="font-size:.7rem;margin-left:8px;padding:2px 8px;border-radius:5px;border:1px solid var(--line);background:none;color:var(--mut);cursor:pointer">&#x1F4CB; Copier</button>';
  html +=     '</div>';
  html +=     '<div><span class="mut">CRM :</span> <a href="' + crmUrl + '" style="color:var(--accent)">' + crmUrl + '</a></div>';
  html +=   '</div>';
  html +=   '<div class="modal-actions">';
  html +=     '<button class="btn btn-out" onclick="document.getElementById(\'mail-identifiants-modal\').classList.remove(\'show\')">Fermer sans envoyer</button>';
  html +=     '<a class="btn btn-pri" href="mailto:' + encodeURIComponent(email) + '?subject=' + subject + '&body=' + bodyEnc + '"';
  html +=       ' onclick="setTimeout(function(){document.getElementById(\'mail-identifiants-modal\').classList.remove(\'show\')},500)"';
  html +=       ' style="text-decoration:none">&#x2709;&#xFE0F; Ouvrir mon client email</a>';
  html +=   '</div>';
  html +=   '<p class="mut" style="font-size:.74rem;margin-top:12px;text-align:center">';
  html +=     '&#x26A0;&#xFE0F; Notez ce mot de passe — il ne sera plus affiché apres la fermeture.';
  html +=   '</p>';
  html += '</div>';

  modal.innerHTML = html;
}



// ==========================================================================
// GÉNÉRER UN NOUVEAU MOT DE PASSE — Admin niveau 3/4
// ==========================================================================

function openGenererMDPModal() {
  // Remplir la liste déroulante avec les utilisateurs (hors super_admin)
  const select = document.getElementById('mdp-user-select');
  if (!select) return;

  const users = (state.adminUsers || []).filter(u =>
    u.id !== state.user?.id && u.role !== 'super_admin'
  );

  select.innerHTML = '<option value="">— Sélectionner un utilisateur —</option>' +
    users.map(u => {
      const roleLabel = {'user':'Utilisateur','dci':'DCI','admin_candy':'Admin C@NDY'}[u.role] || 'Utilisateur';
      return `<option value="${u.id}" data-email="${escapeHtml(u.email||'')}" data-prenom="${escapeHtml(u.prenom||'')}">
        ${escapeHtml(u.prenom||'')} ${escapeHtml(u.nom||'')} — ${escapeHtml(u.email||'')} (${roleLabel})
      </option>`;
    }).join('');

  // Reset
  document.getElementById('mdp-password').value = '';
  document.getElementById('mdp-error').textContent = '';
  document.getElementById('mdp-warn').classList.add('is-hidden');
  document.getElementById('mdp-send-btn').disabled = true;
  document.getElementById('generer-mdp-modal').classList.add('show');
}

function genererNouveauMDP() {
  const pwd = genererMotDePasseFort();
  document.getElementById('mdp-password').value = pwd;
  document.getElementById('mdp-warn').classList.remove('is-hidden');
  document.getElementById('mdp-error').textContent = '';
  // Activer le bouton seulement si un utilisateur est sélectionné
  const userId = document.getElementById('mdp-user-select').value;
  document.getElementById('mdp-send-btn').disabled = !userId || !pwd;
}

function genererMotDePasseFort() {
  const lower   = 'abcdefghijkmnpqrstuvwxyz';
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits  = '23456789';
  const special = '!@#$%&*-_+?';
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];
  const all = lower + upper + digits + special;
  while (pwd.length < 12) pwd += all[Math.floor(Math.random() * all.length)];
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

function copierMDP() {
  const pwd = document.getElementById('mdp-password').value;
  if (!pwd) return;
  navigator.clipboard.writeText(pwd).then(() => {
    const btn = document.querySelector('#generer-mdp-modal button[onclick="copierMDP()"]');
    if (btn) { const old = btn.textContent; btn.textContent = '✅'; setTimeout(() => btn.textContent = old, 1500); }
  }).catch(() => {});
}

// Activer le bouton quand un user est sélectionné ET un MDP généré
document.addEventListener('change', e => {
  if (e.target.id === 'mdp-user-select') {
    const pwd = document.getElementById('mdp-password')?.value;
    const btn = document.getElementById('mdp-send-btn');
    if (btn) btn.disabled = !e.target.value || !pwd;
  }
});

async function appliquerNouveauMDP() {
  const select  = document.getElementById('mdp-user-select');
  const userId  = select?.value;
  const pwd     = document.getElementById('mdp-password').value;
  const errEl   = document.getElementById('mdp-error');
  const btn     = document.getElementById('mdp-send-btn');

  if (!userId) { errEl.textContent = 'Sélectionnez un utilisateur.'; return; }
  if (!pwd)    { errEl.textContent = "Générez un mot de passe d'abord."; return; }

  btn.disabled = true;
  btn.textContent = 'Application en cours…';

  try {
    // Appeler l'Edge Function admin-create-user en mode reset
    const { data: sessionData } = await sb.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error('Session expirée.');

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ user_id: userId, new_password: pwd, action: 'reset_password' }),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.details || errBody.error || `Erreur Edge Function (${resp.status})`);
    }

    // Débloquer le compte si suspendu (ban temporaire suite à 5 tentatives)
    try { await sb.rpc('admin_set_banned', { target_user_id: userId, banned: false }); } catch (_) {}
    // Réinitialiser le compteur d'échecs
    const opt2 = select.options[select.selectedIndex];
    if (opt2?.dataset?.email) {
      try { await sb.rpc('reset_login_attempts', { user_email: opt2.dataset.email }); } catch (_) {}
    }

    // Marquer password_set = false pour forcer le changement à la prochaine connexion
    await sb.from('profiles').update({
      password_set: false,
      password_changed_at: null,
    }).eq('id', userId);

    // Récupérer email et prénom
    const opt = select.options[select.selectedIndex];
    const email  = opt.dataset.email  || '';
    const prenom = opt.dataset.prenom || '';

    // Fermer la modale
    document.getElementById('generer-mdp-modal').classList.remove('show');

    // Ouvrir le mailto avec les nouveaux identifiants
    ouvrirMailIdentifiants(email, pwd, prenom);

  } catch(e) {
    errEl.textContent = 'Erreur : ' + e.message;
    btn.disabled = false;
    btn.textContent = '✅ Appliquer & envoyer par email';
  }
}



// ── MENU HAMBURGER MOBILE ──
function toggleMobMenu() {
  const drawer = document.getElementById('mob-drawer');
  if (!drawer) return;
  drawer.classList.contains('open') ? closeMobMenu() : openMobMenu();
}
function openMobMenu() {
  document.getElementById('mob-menu-btn')?.classList.add('open');
  document.getElementById('mob-overlay')?.classList.add('show');
  document.getElementById('mob-drawer')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMobMenu() {
  document.getElementById('mob-menu-btn')?.classList.remove('open');
  document.getElementById('mob-overlay')?.classList.remove('show');
  document.getElementById('mob-drawer')?.classList.remove('open');
  document.body.style.overflow = '';
}
function mobNav(view) {
  closeMobMenu();
  document.querySelectorAll('#mob-drawer .mob-lk').forEach(l => l.classList.remove('mob-active'));
  const el = document.getElementById('mob-lk-' + view);
  if (el) el.classList.add('mob-active');
  if (typeof switchView === 'function') switchView(view);
}
function updateMobMenuRole() {
  const admin = typeof isAdmin === 'function' && isAdmin();
  const dci   = typeof isAtLeast === 'function' && isAtLeast('dci');
  const sup   = typeof isSuperAdmin === 'function' && isSuperAdmin();
  document.querySelectorAll('#mob-drawer .admin-only').forEach(el => el.classList.toggle('is-hidden', !admin));
  document.querySelectorAll('#mob-drawer .dci-only').forEach(el => el.classList.toggle('is-hidden', !dci));
  const dciSec = document.getElementById('mob-sec-dci');
  if (dciSec) dciSec.classList.toggle('is-hidden', !dci);
  const outilsSec = document.getElementById('mob-sec-outils');
  if (outilsSec) outilsSec.classList.toggle('is-hidden', !admin);
  const dangerSec = document.getElementById('mob-sec-danger');
  if (dangerSec) dangerSec.classList.toggle('is-hidden', !sup);
}
// Swipe gauche pour fermer
(function() {
  let sx = 0;
  document.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, {passive:true});
  document.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientX - sx < -50) {
      const drawer = document.getElementById('mob-drawer');
      if (drawer?.classList.contains('open')) closeMobMenu();
    }
  }, {passive:true});
})();


// ── Afficher/masquer le mot de passe (écran de connexion) ──
function toggleLoginPasswordVisibility() {
  const input = document.getElementById('login-password');
  const btn   = document.getElementById('toggle-login-password');
  if (!input || !btn) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? '🙈' : '👁';
  btn.title = isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe';
}
window.toggleLoginPasswordVisibility = toggleLoginPasswordVisibility;

// ─────────────────────────────────────────────
// AGENDA
// ─────────────────────────────────────────────
const agendaState = { year: 0, month: 0, selectedDay: null };

function renderAgenda() {
  const now = new Date();
  if (!agendaState.year) { agendaState.year = now.getFullYear(); agendaState.month = now.getMonth(); }
  _drawAgendaCalendar();
}

function agendaPrevMonth() {
  if (--agendaState.month < 0) { agendaState.month = 11; agendaState.year--; }
  _drawAgendaCalendar();
}

function agendaNextMonth() {
  if (++agendaState.month > 11) { agendaState.month = 0; agendaState.year++; }
  _drawAgendaCalendar();
}

function _drawAgendaCalendar() {
  const { year, month } = agendaState;
  const todayStr = todayISO();
  const label = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  $('#agenda-month-label').textContent = capitalize(label);

  // Premier lundi avant le 1er du mois
  const firstDay = new Date(year, month, 1);
  const startDay = new Date(firstDay);
  const dow = (firstDay.getDay() + 6) % 7; // 0=lundi
  startDay.setDate(firstDay.getDate() - dow);

  // Index des tâches par date
  const byDate = {};
  (state.tasks || []).forEach(t => {
    const dates = [];
    if (t.rdv_date) dates.push(t.rdv_date);
    else if (t.echeance) dates.push(t.echeance);
    dates.forEach(d => { if (d) { byDate[d] = byDate[d] || []; byDate[d].push(t); } });
  });

  // Index des tournées par date
  const byDateTournee = {};
  (state.tournees || []).forEach(t => {
    if (t.date_tournee) { byDateTournee[t.date_tournee] = byDateTournee[t.date_tournee] || []; byDateTournee[t.date_tournee].push(t); }
  });

  const cells = $('#agenda-cells');
  cells.innerHTML = '';

  for (let i = 0; i < 42; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const isCurrentMonth = d.getMonth() === month;
    const isToday = iso === todayStr;
    const isSelected = iso === agendaState.selectedDay;
    const events = byDate[iso] || [];
    const tourneesDuJour = byDateTournee[iso] || [];

    const cell = document.createElement('div');
    cell.className = ['agenda-cell', isToday ? 'today' : '', !isCurrentMonth ? 'other-month' : '', isSelected ? 'selected' : ''].filter(Boolean).join(' ');
    cell.onclick = () => _selectAgendaDay(iso, events, tourneesDuJour);

    let html = `<div class="agenda-cell-num">${d.getDate()}</div>`;
    const isMobile = window.innerWidth <= 600;
    if (isMobile) {
      // Vue mobile : points colorés uniquement
      const dots = [];
      tourneesDuJour.forEach(() => dots.push('tournee'));
      events.forEach(t => {
        const isRdv = t.type_tache === 'RDV visio' || t.type_tache === 'RDV terrain';
        const late = isOverdue(t.echeance || t.rdv_date, t.statut);
        dots.push(late ? 'overdue' : isRdv ? 'rdv' : 'task');
      });
      if (dots.length) {
        html += `<div class="agenda-dots">${dots.slice(0, 4).map(c => `<span class="agenda-dot ${c}"></span>`).join('')}${dots.length > 4 ? `<span class="agenda-dot" style="background:var(--mut);opacity:.6"></span>` : ''}</div>`;
      }
    } else {
      // Vue desktop : étiquettes texte
      tourneesDuJour.forEach(tr => {
        html += `<div class="agenda-event" style="background:rgba(245,158,11,.18);color:#f59e0b;border-left:2px solid #f59e0b">🗺️ Tournée terrain</div>`;
      });
      const remaining = 3 - tourneesDuJour.length;
      events.slice(0, Math.max(0, remaining)).forEach(t => {
        const isRdv = t.type_tache === 'RDV visio' || t.type_tache === 'RDV terrain';
        const late = isOverdue(t.echeance || t.rdv_date, t.statut);
        const cls = late ? 'overdue' : isRdv ? 'rdv' : 'task';
        html += `<div class="agenda-event ${cls}">${escapeHtml(t.titre)}</div>`;
      });
      const total = tourneesDuJour.length + events.length;
      if (total > 3) html += `<div style="font-size:.6rem;color:var(--mut)">+${total - 3}</div>`;
    }
    cell.innerHTML = html;
    cells.appendChild(cell);
  }

  // Rouvrir le panneau jour si un jour était sélectionné
  if (agendaState.selectedDay) {
    _renderDayPanel(agendaState.selectedDay, byDate[agendaState.selectedDay] || [], byDateTournee[agendaState.selectedDay] || []);
  }
}

function _renderDayPanel(iso, events, tourneesDuJour = []) {
  const panel = $('#agenda-day-panel');
  const title = $('#agenda-day-title');
  const list  = $('#agenda-day-list');

  const label = new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  title.textContent = capitalize(label);

  let html = '';

  // ── Blocs tournée ────────────────────────────────────────────────────────────
  tourneesDuJour.forEach(tr => {
    const etapes = (tr.etapes || []);
    const conflits = events.filter(t => t.type_tache === 'RDV visio' || t.type_tache === 'RDV terrain');
    const alerte = conflits.length
      ? `<div style="margin:8px 0;padding:8px 12px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.35);border-radius:8px;font-size:.78rem;color:#f59e0b">
           ⚠️ <strong>${conflits.length} RDV déjà programmé${conflits.length > 1 ? 's' : ''} ce jour.</strong>
           Vérifiez les horaires avant de partir.
           ${conflits.map(c => {
             const contact = c.contact_id ? state.contacts.find(x => x.id === c.contact_id) : null;
             const lieu = c.rdv_lieu || (contact ? [contact.adresse, contact.code_postal, contact.ville].filter(Boolean).join(', ') : '');
             return `<div style="margin-top:4px;padding-left:10px;border-left:2px solid #f59e0b">
               ${escapeHtml(c.titre)}${c.rdv_heure ? ' · ' + c.rdv_heure.slice(0,5) : ''}${lieu ? ' · 📍 ' + escapeHtml(lieu) : ''}
             </div>`;
           }).join('')}
         </div>` : '';

    const etapesHtml = etapes.map((e, i) => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="font-family:monospace;font-size:.72rem;color:#f59e0b;min-width:28px;padding-top:1px">${e.heure_estimee ? e.heure_estimee.slice(0,5) : ('0'+(i+1)).slice(-2)+'h'}</span>
        <div style="flex:1">
          <div style="font-size:.83rem;color:#fff;font-weight:600">${escapeHtml(e.label)}</div>
          ${e.adresse ? `<div style="font-size:.72rem;color:var(--mut)">📍 ${escapeHtml(e.adresse)}</div>` : ''}
          <div style="font-size:.65rem;color:var(--mut-2);font-family:monospace">${e.source === 'google_places' ? '🌍 Google Places' : e.source === 'sirene' ? '⚡ SIRENE' : '👤 CRM'}</div>
        </div>
      </div>`).join('');

    html += `<div style="margin-bottom:14px;padding:14px 16px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.25);border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:.82rem;font-weight:700;color:#f59e0b">🗺️ Tournée terrain</span>
        <span style="font-size:.72rem;color:var(--mut)">${tr.heure_depart ? tr.heure_depart.slice(0,5) : ''} · ${tr.nb_etapes || etapes.length} étape${(tr.nb_etapes || etapes.length) > 1 ? 's' : ''} · ${tr.distance_totale_km ? tr.distance_totale_km + ' km' : ''}</span>
      </div>
      ${tr.adresse_depart ? `<div style="font-size:.75rem;color:var(--mut);margin-bottom:8px">📍 Départ : ${escapeHtml(tr.adresse_depart)}</div>` : ''}
      ${alerte}
      ${etapesHtml || '<div style="font-size:.78rem;color:var(--mut)">Aucune étape enregistrée.</div>'}
      ${tr.score_co2_kg ? `<div style="margin-top:8px;font-size:.7rem;color:var(--mut);font-family:monospace">🌱 ${parseFloat(tr.score_co2_kg).toFixed(2)} kg CO₂ estimés (ADEME 2024)</div>` : ''}
    </div>`;
  });

  if (!events.length && !tourneesDuJour.length) {
    list.innerHTML = `<p style="color:var(--mut);font-size:.85rem">Aucun événement ce jour.</p>
      <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="openTaskModal(null,{type_tache:'RDV terrain',rdv_date:'${iso}'})">📅 Programmer un RDV</button>`;
  } else {
    html += events.map(t => {
      const isRdv   = t.type_tache === 'RDV visio' || t.type_tache === 'RDV terrain';
      const late    = isOverdue(t.echeance || t.rdv_date, t.statut);
      const cls     = late ? 'overdue' : isRdv ? 'rdv' : 'task';
      const meta    = [t.type_tache, t.rdv_heure ? t.rdv_heure.slice(0,5) : null, t.rdv_lieu].filter(Boolean).join(' · ');

      const contact = t.contact_id ? state.contacts.find(c => c.id === t.contact_id) : null;
      const lieu    = t.rdv_lieu || (contact ? [contact.adresse, contact.code_postal, contact.ville].filter(Boolean).join(', ') : '');
      const mapsUrl = t.type_tache === 'RDV terrain' && lieu
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lieu)}&travelmode=driving`
        : null;

      const contactCard = contact ? `
        <div style="margin:6px 0 4px;padding:8px 10px;background:rgba(255,255,255,.05);border-radius:6px;font-size:.78rem;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center">
          <span>👤 <strong>${escapeHtml(contact.nom)}${contact.entreprise ? ' — ' + escapeHtml(contact.entreprise) : ''}</strong></span>
          ${contact.telephone ? `<a href="tel:${escapeHtml(contact.telephone)}" onclick="event.stopPropagation()" style="color:var(--accent)">📞 ${escapeHtml(contact.telephone)}</a>` : ''}
          ${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}" onclick="event.stopPropagation()" style="color:var(--accent)">✉️ ${escapeHtml(contact.email)}</a>` : ''}
          ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:#f59e0b;font-weight:600">🗺️ Itinéraire</a>` : ''}
        </div>` : '';

      return `<div class="agenda-ev-item" onclick="openTaskModal('${t.id}')">
        <div class="agenda-ev-dot ${cls}"></div>
        <div style="flex:1">
          <div class="agenda-ev-title">${escapeHtml(t.titre)}</div>
          ${meta ? `<div class="agenda-ev-meta">${escapeHtml(meta)}</div>` : ''}
          ${contactCard}
        </div>
        ${!contact && mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="btn btn-out btn-sm" style="padding:3px 9px;font-size:.75rem;align-self:center;white-space:nowrap">🗺️ Itinéraire</a>` : ''}
      </div>`;
    }).join('');
    html += `<button class="btn btn-out btn-sm" style="margin-top:12px;width:100%" onclick="openTaskModal(null,{type_tache:'RDV terrain',rdv_date:'${iso}'})">+ Programmer un RDV ce jour</button>`;
    list.innerHTML = html;
  }
  panel.style.display = 'block';
  if (window.innerWidth <= 600) {
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}

function _selectAgendaDay(iso, events, tourneesDuJour = []) {
  agendaState.selectedDay = iso;
  _drawAgendaCalendar();
}

async function copyIcalUrl() {
  const uid = state.user?.id;
  if (!uid) return;
  // Récupérer le token ICS personnel depuis le profil (colonne ics_token)
  const { data: profile } = await sb.from('profiles').select('ics_token').eq('id', uid).single();
  if (!profile?.ics_token) { alert('Impossible de récupérer le token agenda.'); return; }
  const url = `${SUPABASE_URL}/functions/v1/agenda-ics?uid=${uid}&tok=${profile.ics_token}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = $('#btn-ical-subscribe');
    const orig = btn.textContent;
    btn.textContent = '✅ URL copiée !';
    setTimeout(() => btn.textContent = orig, 2500);
  });
}

// ==========================================================================
// AGENDA — PARAMÉTRAGE DISPONIBILITÉS & BOOKING TOKEN
// ==========================================================================

const AVAIL_JOURS = [
  { key: 'lun', label: 'Lundi' },
  { key: 'mar', label: 'Mardi' },
  { key: 'mer', label: 'Mercredi' },
  { key: 'jeu', label: 'Jeudi' },
  { key: 'ven', label: 'Vendredi' },
];

const AVAIL_DEFAULTS = { enabled: true, start: '09:00', end: '18:00', pause_start: '12:00', pause_end: '14:00' };

let _availData = {};

async function openAgendaSettings() {
  const modal = $('#modal-agenda-settings');
  modal.classList.remove('is-hidden');

  const uid = state.user?.id;
  if (!uid) return;

  const { data: profile } = await sb.from('profiles').select('availability, booking_token').eq('id', uid).single();
  _availData = profile?.availability || {};

  // Générer ou afficher le booking_token
  let token = profile?.booking_token;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    await sb.from('profiles').update({ booking_token: token }).eq('id', uid);
  }
  const bookingUrl = `${window.location.origin}/booking.html?token=${token}`;
  $('#booking-url-display').value = bookingUrl;

  // Rendre la grille des jours
  const grid = $('#avail-grid');
  grid.innerHTML = AVAIL_JOURS.map(({ key, label }) => {
    const d = _availData[key] || AVAIL_DEFAULTS;
    return `
    <div style="background:#162035;border-radius:10px;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:${d.enabled ? '12px' : '0'}">
        <label style="position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0">
          <input type="checkbox" id="avail-${key}-on" ${d.enabled ? 'checked' : ''} onchange="toggleAvailDay('${key}')" style="opacity:0;width:0;height:0">
          <span style="position:absolute;inset:0;background:${d.enabled ? '#f59e0b' : '#374151'};border-radius:99px;cursor:pointer;transition:.2s"></span>
          <span style="position:absolute;left:${d.enabled ? '20px' : '2px'};top:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:.2s"></span>
        </label>
        <span style="font-size:14px;font-weight:600;color:${d.enabled ? '#fff' : '#6b7280'}">${label}</span>
        ${!d.enabled ? '<span style="font-size:11px;color:#4b5563;margin-left:auto">Fermé</span>' : ''}
      </div>
      <div id="avail-${key}-detail" style="display:${d.enabled ? 'grid' : 'none'};grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;align-items:center">
        <div>
          <label style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:3px">Début</label>
          <input type="time" id="avail-${key}-start" value="${d.start}" style="width:100%;background:#1e3a5f;border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:6px;padding:6px 8px;font-size:13px">
        </div>
        <div>
          <label style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:3px">Fin</label>
          <input type="time" id="avail-${key}-end" value="${d.end}" style="width:100%;background:#1e3a5f;border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:6px;padding:6px 8px;font-size:13px">
        </div>
        <div>
          <label style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:3px">Pause début</label>
          <input type="time" id="avail-${key}-ps" value="${d.pause_start || '12:00'}" style="width:100%;background:#1e3a5f;border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:6px;padding:6px 8px;font-size:13px">
        </div>
        <div>
          <label style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:3px">Pause fin</label>
          <input type="time" id="avail-${key}-pe" value="${d.pause_end || '14:00'}" style="width:100%;background:#1e3a5f;border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:6px;padding:6px 8px;font-size:13px">
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleAvailDay(key) {
  const on = $(`#avail-${key}-on`).checked;
  const detail = $(`#avail-${key}-detail`);
  detail.classList.toggle('is-hidden', !on);
}

function closeAgendaSettings() {
  $('#modal-agenda-settings').classList.add('is-hidden');
}

async function saveAvailability() {
  const uid = state.user?.id;
  if (!uid) return;

  const avail = {};
  AVAIL_JOURS.forEach(({ key }) => {
    const enabled = $(`#avail-${key}-on`)?.checked ?? false;
    avail[key] = {
      enabled,
      start:       $(`#avail-${key}-start`)?.value || '09:00',
      end:         $(`#avail-${key}-end`)?.value   || '18:00',
      pause_start: $(`#avail-${key}-ps`)?.value    || '12:00',
      pause_end:   $(`#avail-${key}-pe`)?.value    || '14:00',
    };
  });

  const { error } = await sb.from('profiles').update({ availability: avail }).eq('id', uid);
  if (error) { alert('Erreur lors de la sauvegarde.'); return; }

  closeAgendaSettings();
  showNotif('Disponibilités enregistrées ✓', 'success');
}

function copyBookingUrl() {
  const url = $('#booking-url-display').value;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector('#modal-agenda-settings .btn-out');
    const orig = btn.textContent; btn.textContent = '✅ Copié !';
    setTimeout(() => btn.textContent = orig, 2000);
  });
}

// ==========================================================================
// RÉGLAGES — REGISTRE FOURNISSEURS TIERS (RGPD art. 28 / NIS2 supply chain)
// ==========================================================================

async function loadFournisseurs() {
  const tbody = $('#fournisseurs-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--mut)">Chargement…</td></tr>';
  const { data, error } = await sb.from('fournisseurs').select('*').order('niveau_risque', { ascending: false }).order('nom');
  if (error || !data) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Erreur de chargement.</td></tr>'; return; }
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Aucun fournisseur enregistré.</td></tr>'; return; }
  const risqueBadge = { faible: 'badge-green', moyen: 'badge-orange', eleve: 'badge-red' };
  const risqueLabel = { faible: '🟢 Faible', moyen: '🟡 Moyen', eleve: '🔴 Élevé' };
  const catLabel = { hebergeur:'Hébergeur', paiement:'Paiement', communication:'Communication', 'sous-traitant':'Sous-traitant', securite:'Sécurité', editeur:'Éditeur', autre:'Autre' };
  tbody.innerHTML = data.map(f => `
    <tr>
      <td><strong>${escapeHtml(f.nom)}</strong>${f.contact_technique ? `<br><span class="mut" style="font-size:.75rem">${escapeHtml(f.contact_technique)}</span>` : ''}</td>
      <td>${escapeHtml(f.pays)}</td>
      <td>${escapeHtml(catLabel[f.categorie] || f.categorie)}</td>
      <td><span class="badge ${risqueBadge[f.niveau_risque] || 'badge-orange'}">${risqueLabel[f.niveau_risque] || f.niveau_risque}</span></td>
      <td style="text-align:center">${f.dpa_signe
        ? (f.dpa_url ? `<a href="${escapeHtml(f.dpa_url)}" target="_blank" rel="noopener" style="color:var(--ok);font-size:.8rem">✅ DPA ↗</a>` : '<span style="color:var(--ok)">✅</span>')
        : '<span style="color:var(--alert)">❌</span>'}</td>
      <td style="font-size:.78rem;color:var(--mut)">${escapeHtml(f.certifications || '—')}</td>
      <td>
        <button class="btn btn-out btn-sm" onclick="openFournisseurModal('${f.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteFournisseur('${f.id}','${escapeHtml(f.nom)}')">🗑</button>
      </td>
    </tr>`).join('');
}

function openFournisseurModal(id) {
  const modal = $('#fournisseur-modal');
  $('#fournisseur-modal-error').classList.add('is-hidden');
  if (id) {
    const f = (window._fournisseursCache || []).find(x => x.id === id);
    if (!f) { loadFournisseurs(); return; }
    $('#fournisseur-modal-title').textContent = 'Modifier le fournisseur';
    $('#f-id').value        = f.id;
    $('#f-nom').value       = f.nom || '';
    $('#f-pays').value      = f.pays || '';
    $('#f-categorie').value = f.categorie || 'autre';
    $('#f-risque').value    = f.niveau_risque || 'moyen';
    $('#f-certif').value    = f.certifications || '';
    $('#f-dpa-url').value   = f.dpa_url || '';
    $('#f-contact').value   = f.contact_technique || '';
    $('#f-notes').value     = f.notes || '';
    $('#f-dpa-signe').checked = !!f.dpa_signe;
  } else {
    $('#fournisseur-modal-title').textContent = 'Nouveau fournisseur';
    ['f-id','f-nom','f-pays','f-certif','f-dpa-url','f-contact','f-notes'].forEach(id => { const el = $('#' + id); if (el) el.value = ''; });
    $('#f-categorie').value  = 'hebergeur';
    $('#f-risque').value     = 'moyen';
    $('#f-dpa-signe').checked = false;
  }
  modal.classList.add('show');
}

async function saveFournisseur() {
  const id  = $('#f-id').value;
  const nom = $('#f-nom').value.trim();
  if (!nom) { $('#fournisseur-modal-error').textContent = 'Le nom est obligatoire.'; $('#fournisseur-modal-error').classList.remove('is-hidden'); return; }
  const payload = {
    nom, pays: $('#f-pays').value.trim() || 'FR',
    categorie:         $('#f-categorie').value,
    niveau_risque:     $('#f-risque').value,
    certifications:    $('#f-certif').value.trim()   || null,
    dpa_signe:         $('#f-dpa-signe').checked,
    dpa_url:           $('#f-dpa-url').value.trim()  || null,
    contact_technique: $('#f-contact').value.trim()  || null,
    notes:             $('#f-notes').value.trim()     || null,
    updated_at:        new Date().toISOString(),
  };
  const { error } = id
    ? await sb.from('fournisseurs').update(payload).eq('id', id)
    : await sb.from('fournisseurs').insert(payload);
  if (error) { $('#fournisseur-modal-error').textContent = 'Erreur : ' + error.message; $('#fournisseur-modal-error').classList.remove('is-hidden'); return; }
  if (typeof logRgpd === 'function') logRgpd('fournisseur_modifie', 'Réglages', {
    criticite: 'Attention', donnees: 'registre fournisseurs tiers',
    details: { nom, action: id ? 'modification' : 'ajout', niveau_risque: payload.niveau_risque },
  });
  $('#fournisseur-modal').classList.remove('show');
  await loadFournisseurs();
}

async function deleteFournisseur(id, nom) {
  if (!confirm(`Supprimer le fournisseur "${nom}" du registre ?`)) return;
  await sb.from('fournisseurs').delete().eq('id', id);
  if (typeof logRgpd === 'function') logRgpd('fournisseur_modifie', 'Réglages', {
    criticite: 'Attention', donnees: 'registre fournisseurs tiers',
    details: { nom, action: 'suppression' },
  });
  await loadFournisseurs();
}

// =========================================================
// PURGE AUTOMATIQUE — RGPD art. 5(1)(e) durées de conservation
// =========================================================

async function loadPurgeInfo() {
  const wrap = $('#purge-section');
  if (!wrap) return;
  const statEl    = $('#purge-stat');
  const listEl    = $('#purge-list');
  const lastEl    = $('#purge-last');

  statEl.textContent = '…';
  listEl.innerHTML   = '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--mut)">Chargement…</td></tr>';

  const { data: rows, error } = await sb.rpc('fn_preview_purge_eligibles');
  if (error) { statEl.textContent = 'Erreur'; console.error('[purge]', error); return; }

  statEl.textContent = rows.length;
  $('#purge-trigger-btn').disabled = rows.length === 0;

  listEl.innerHTML = rows.length === 0
    ? '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--ok)">✅ Aucun contact éligible à la purge.</td></tr>'
    : rows.map(r => `
        <tr>
          <td>${escapeHtml(r.nom || '—')}</td>
          <td>${escapeHtml(r.entreprise || '—')}</td>
          <td style="font-size:.78rem;color:var(--mut)">${r.eligible_depuis ? new Date(r.eligible_depuis).toLocaleDateString('fr-FR') : '—'}</td>
          <td style="font-size:.75rem;color:var(--mut-2)">${escapeHtml(r.raison)}</td>
        </tr>`).join('');

  // Dernière purge automatique
  const { data: lastLog } = await sb.from('audit_logs')
    .select('created_at,details')
    .eq('action', 'purge_donnees_perimees')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastLog) {
    const d = new Date(lastLog.created_at);
    const nb = lastLog.details?.nb_contacts_purges ?? lastLog.details?.contact_nom_original ? 1 : '?';
    lastEl.textContent = `Dernière purge : ${d.toLocaleDateString('fr-FR')} — ${nb} contact(s) anonymisé(s) · source : ${lastLog.details?.source || '—'}`;
  } else {
    lastEl.textContent = 'Aucune purge effectuée pour l\'instant.';
  }
}

async function triggerPurge() {
  const n = parseInt($('#purge-stat').textContent, 10) || 0;
  if (n === 0) return;
  if (!confirm(`Confirmer la purge de ${n} contact(s) ?\n\nCette action est IRRÉVERSIBLE. Les données personnelles seront anonymisées conformément au RGPD art. 5(1)(e).`)) return;

  $('#purge-trigger-btn').disabled = true;
  $('#purge-trigger-btn').textContent = 'Purge en cours…';

  const { data, error } = await sb.rpc('fn_purge_donnees_perimees', { p_source: 'admin_manuel' });

  if (error) {
    alert('Erreur lors de la purge : ' + error.message);
    console.error('[purge]', error);
  } else {
    alert(`✅ Purge effectuée : ${data} contact(s) anonymisé(s).\nAction tracée dans le journal RGPD.`);
    await loadPurgeInfo();
  }
  $('#purge-trigger-btn').textContent = 'Déclencher la purge maintenant';
}

// Cache fournisseurs pour l'édition
(async () => {
  const orig = loadFournisseurs;
  window.loadFournisseurs = async function() {
    await orig();
    const { data } = await sb.from('fournisseurs').select('*');
    window._fournisseursCache = data || [];
  };
})();

// ── Tests unitaires — helpers Réglages ─────────────────────────────────────

function _copyCmd(id, btn) {
  const text = document.getElementById(id)?.textContent?.trim();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copié';
    btn.style.color = '#4ade80';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1800);
  });
}

function _runTestsModal() {
  document.getElementById('tests-modal')?.classList.add('show');
}

init()
