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
  banner.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;background:#142240;border:1px solid rgba(245,158,11,.4);border-radius:12px;padding:12px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);font-family:sans-serif;font-size:.85rem;color:#cbd5e1';
  banner.innerHTML = '<span>🔄 Mise à jour S@FE CRM disponible</span><button onclick="appliquerMiseAJour()" style="background:#f59e0b;color:#0a1628;border:none;border-radius:7px;padding:6px 14px;font-weight:700;cursor:pointer;font-size:.82rem">Mettre à jour</button><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1rem">✕</button>';
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
  banner.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:#142240;border:1px solid rgba(245,158,11,.3);border-radius:12px;padding:14px 18px;box-shadow:0 8px 32px rgba(0,0,0,.4);max-width:280px;font-family:sans-serif';
  banner.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><img src="/icons/icon-72.png" style="width:36px;height:36px;border-radius:8px"><div><div style="font-size:.88rem;font-weight:700;color:#fff">S@FE CRM</div><div style="font-size:.75rem;color:#94a3b8">Installer sur cet appareil</div></div><button onclick="document.getElementById(\'pwa-install-banner\').remove();deferredPrompt=null" style="background:none;border:none;color:#94a3b8;cursor:pointer;margin-left:auto;font-size:1rem">✕</button></div><button onclick="installerPWA()" style="width:100%;background:#f59e0b;color:#0a1628;border:none;border-radius:8px;padding:8px;font-weight:700;cursor:pointer;font-size:.85rem">📲 Installer l\'application</button>';
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
