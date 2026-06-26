// ── Toggle sections accordion ─────────────────────────────────────────────
function toggleSection(id){
  const body  = document.getElementById('section-'+id);
  const arrow = document.getElementById('arrow-'+id);
  if(!body) return;
  const open = body.classList.toggle('open');
  if(arrow) arrow.textContent = open ? '▴' : '▾';
}

// ── PWA Service Worker ────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[PWA] Service Worker enregistré:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });
      })
      .catch(err => console.warn('[PWA] SW non enregistré:', err));
  });
}

// ── Bannière mise à jour disponible ──────────────────────────────────────
function showUpdateBanner() {
  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.className = 'pwa-update-banner';
  banner.innerHTML = '<span>🔄 Mise à jour S@FE CRM disponible</span><button class="pwa-btn-apply" onclick="appliquerMiseAJour()">Mettre à jour</button><button class="pwa-btn-close" onclick="this.closest(\'.pwa-update-banner\').remove()">✕</button>';
  document.body.appendChild(banner);
}

function appliquerMiseAJour() {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage('SKIP_WAITING');
  }
  window.location.reload();
}

// ── Bannière installation PWA ─────────────────────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(() => {
    if (deferredPrompt) showInstallBanner();
  }, 10000);
});

function showInstallBanner() {
  if (document.getElementById('pwa-install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="pwa-install-head">
      <img src="/icons/icon-72.png" class="pwa-install-icon" alt="S@FE CRM">
      <div>
        <div class="pwa-install-name">S@FE CRM</div>
        <div class="pwa-install-sub">Installer sur cet appareil</div>
      </div>
      <button class="pwa-btn-close" onclick="document.getElementById('pwa-install-banner').remove();deferredPrompt=null">✕</button>
    </div>
    <button class="pwa-btn-install" onclick="installerPWA()">📲 Installer l'application</button>`;
  document.body.appendChild(banner);
}

async function installerPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('[PWA] Installation:', outcome);
  deferredPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
}

window.addEventListener('appinstalled', () => {
  console.log('[PWA] Application installée avec succès !');
  deferredPrompt = null;
});

// ── Sections nav repliables ───────────────────────────────────────────────
(function () {
  document.querySelectorAll('.nav-toggle').forEach(function (btn) {
    var grpId = btn.dataset.grp;
    var grp   = document.getElementById('grp-' + grpId);
    if (!grp) return;
    var key = 'nav_col_' + grpId;

    if (localStorage.getItem(key) === '1') {
      btn.classList.add('collapsed');
      grp.classList.add('collapsed');
    }

    btn.addEventListener('click', function () {
      var closing = !grp.classList.contains('collapsed');
      grp.classList.toggle('collapsed', closing);
      btn.classList.toggle('collapsed', closing);
      localStorage.setItem(key, closing ? '1' : '0');
    });
  });
})();
