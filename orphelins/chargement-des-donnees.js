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
  loadMessagesDCI();    // Messages du DCI (niveau 1)
  loadCooptationDCI();  // Prime cooptation DCI
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
