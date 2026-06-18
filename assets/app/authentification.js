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

