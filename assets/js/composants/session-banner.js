// =========================================================
// S@FE CRM — Bannière d'expiration de session
// CSS : assets/css/composants/session-banner.css
// Dépend de : state (app.js), sb (app.js)
// =========================================================

const SESSION_MAX_MS  = 4 * 3600 * 1000;
const SESSION_WARN_MS = SESSION_MAX_MS - 15 * 60 * 1000;
let _sessionWarnShown = false;

function _showSessionWarningBanner() {
  if (document.getElementById('session-warn-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'session-warn-banner';
  banner.className = 'session-warn-banner';
  banner.innerHTML = `
    <span class="session-warn-icon">⚠️</span>
    <div>
      <div class="session-warn-title">Session expire dans 15 min</div>
      <div class="session-warn-body">
        Par sécurité (Art.42 RGPD), votre session est limitée à 4h.<br>
        Enregistrez votre travail et reconnectez-vous si besoin.
      </div>
      <button class="session-warn-dismiss" onclick="document.getElementById('session-warn-banner').remove()">
        Compris
      </button>
    </div>`;
  document.body.appendChild(banner);
}

function checkSessionExpiry() {
  if (!state.user) return;
  const signinAt = parseInt(localStorage.getItem('safe_signin_at') || '0', 10);
  if (!signinAt) return;
  const elapsed = Date.now() - signinAt;
  if (elapsed > SESSION_MAX_MS) {
    console.warn('[S@FE CRM] Session expirée après 4h — déconnexion automatique.');
    localStorage.removeItem('safe_signin_at');
    sb.auth.signOut();
    return;
  }
  if (!_sessionWarnShown && elapsed > SESSION_WARN_MS) {
    _sessionWarnShown = true;
    _showSessionWarningBanner();
  }
}

setInterval(checkSessionExpiry, 5 * 60 * 1000);
