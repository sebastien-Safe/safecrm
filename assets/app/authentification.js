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
// PROFIL UTILISATEUR (prénom, photo, jours travaillés)
// ---------------------------------------------------------
function renderUserBadge() {
  const name = state.profile?.prenom || (state.user?.email ? state.user.email.split('@')[0] : 'Utilisateur');
  $('#user-name').textContent = name;
  setAvatar($('#user-avatar'), state.profile?.photo_url, name);
  // Onglet Administration visible uniquement pour les super-admins
  $all('.admin-only').forEach(el => { el.style.display = isAdmin() ? '' : 'none'; });
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
  if (document.getElementById('profile-rcpro'))     document.getElementById('profile-rcpro').value     = state.profile?.rcpro_numero || '';

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
      signedBlock.style.display   = 'flex';
      unsignedBlock.style.display = 'none';
      // Construire un lien vers une page de visualisation
      const dateStr = new Date(data.signed_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'});
      signedBlock.querySelector('span').textContent = '✅ Clause signée le ' + dateStr;
      document.getElementById('clause-signed-link').href = '/clause-confidentialite.html?view=' + data.id;
    } else {
      signedBlock.style.display   = 'none';
      unsignedBlock.style.display = 'block';
    }
  })();
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
  const prenom    = $('#profile-prenom').value.trim() || null;
  const nom       = (document.getElementById('profile-nom')?.value||'').trim() || null;
  const telephone = (document.getElementById('profile-telephone')?.value||'').trim() || null;
  const adresse   = (document.getElementById('profile-adresse')?.value||'').trim() || null;
  const rcpro     = (document.getElementById('profile-rcpro')?.value||'').trim() || null;
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

