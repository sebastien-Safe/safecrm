// ==========================================================================
// S@FE CRM — Adresse et RGPD du module Contacts
// Autocomplétion via API Adresse data.gouv.fr + vérification RGPD
// ==========================================================================

let _adresseDebounceTimer = null;

function autoCompleteAdresse(input) {
  clearTimeout(_adresseDebounceTimer);
  const q = input.value.trim();
  if (q.length < 4) { _hideAdresseSuggestions(); return; }
  _adresseDebounceTimer = setTimeout(async () => {
    try {
      const cp = $('#c-code-postal')?.value.trim() || '';
      const url = 'https://api-adresse.data.gouv.fr/search/?q='
        + encodeURIComponent(q)
        + '&limit=6&type=housenumber'
        + (cp ? '&postcode=' + encodeURIComponent(cp) : '');
      const resp = await fetch(url);
      const data = await resp.json();
      _showAdresseSuggestions(data.features || [], input);
    } catch(e) { _hideAdresseSuggestions(); }
  }, 300);
}

function _showAdresseSuggestions(features, input) {
  _hideAdresseSuggestions();
  if (!features.length) return;

  const box = document.createElement('div');
  box.id = 'adresse-suggestions';
  box.style.cssText = [
    'position:absolute',
    'top:100%',
    'left:0',
    'right:0',
    'z-index:9999',
    'background:var(--bg-2,#1e1e2e)',
    'border:1px solid var(--border,#333)',
    'border-radius:8px',
    'margin-top:2px',
    'max-height:220px',
    'overflow-y:auto',
    'box-shadow:0 4px 16px rgba(0,0,0,.4)',
  ].join(';');

  features.forEach(f => {
    const p = f.properties;
    const item = document.createElement('div');
    item.textContent = p.label;
    item.style.cssText = 'padding:9px 12px;cursor:pointer;font-size:.85rem;border-bottom:1px solid var(--border,#333)';
    item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-3,#2a2a3e)');
    item.addEventListener('mouseleave', () => item.style.background = '');
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      input.value = p.name || '';
      const cp    = p.postcode || '';
      const ville = p.city     || '';
      const cpEl  = $('#c-code-postal');
      const villeEl = $('#c-ville');
      const cpvEl   = $('#c-code-postal-ville');
      if (cpEl  && cp)    cpEl.value = cp;
      if (villeEl && ville) {
        villeEl.innerHTML = `<option value="${escapeHtml(ville)}">${escapeHtml(ville)}</option>`;
        villeEl.value = ville;
      }
      if (cpvEl && cp && ville) cpvEl.value = cp + ' ' + ville;
      _hideAdresseSuggestions();
    });
    box.appendChild(item);
  });

  const parent = input.parentElement;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  parent.appendChild(box);
  input.addEventListener('blur', _hideAdresseSuggestions, { once: true });
}

function _hideAdresseSuggestions() {
  document.getElementById('adresse-suggestions')?.remove();
}

// Initialise les listeners adresse (appelé depuis bindEvents dans app.js)
function initContactAddressListeners() {
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
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const communes = await resp.json();
      if (!Array.isArray(communes) || !communes.length) {
        sel.innerHTML = '<option value="">Aucune commune trouvée</option>';
        return;
      }
      sel.innerHTML = communes.map(c => `<option value="${c.nom}">${c.nom}</option>`).join('');
      $('#c-code-postal-ville').value = cp + ' ' + sel.value;
    } catch(e) {
      console.error('API communes erreur :', e);
      // Fallback : saisie manuelle
      sel.innerHTML = '<option value="">—</option>';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Saisir la ville manuellement';
      input.style.cssText = 'margin-top:6px;width:100%;padding:7px 10px;border-radius:7px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:#fff;font-size:.88rem';
      input.addEventListener('input', () => {
        $('#c-code-postal-ville').value = cp + ' ' + input.value.trim();
      });
      sel.parentElement.appendChild(input);
    }
  });
  $('#c-ville')?.addEventListener('change', function() {
    const cp = $('#c-code-postal').value.trim();
    $('#c-code-postal-ville').value = cp + ' ' + this.value;
  });
}

async function checkProfilComplet() {
  if (isAdmin()) return;
  const p = state.profile;
  const champs = ['nom','prenom','adresse','telephone','siret'];
  const manquants = champs.filter(c => !p?.[c] || String(p[c]).trim() === '');

  if (manquants.length > 0) {
    const alerte = p?.profil_alerte_at ? new Date(p.profil_alerte_at) : null;
    const joursEcoules = alerte ? Math.floor((Date.now() - alerte) / 86400000) : 0;
    const flagRevoc = p?.profil_revocation_flag;

    let msg = '⚠️ Votre profil est incomplet. Veuillez renseigner : ' + manquants.join(', ') + '.';
    if (flagRevoc) {
      msg += ' Votre compte est signalé pour révocation. Contactez un administrateur.';
    } else if (joursEcoules >= 1) {
      msg += ' Sans mise à jour, votre compte sera signalé sous ' + (2 - joursEcoules) + ' jour(s).';
    }

    let banner = document.getElementById('profil-incomplet-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'profil-incomplet-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:600;background:rgba(255,77,94,.15);border-bottom:2px solid var(--alert);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap';
      document.body.prepend(banner);
    }
    banner.innerHTML = `
      <span style="font-size:.84rem;color:var(--alert)">${msg}</span>
      <button class="btn btn-pri" style="padding:6px 14px;font-size:.78rem;background:var(--alert);border:none"
        onclick="openProfileModal()">Compléter mon profil</button>`;
  } else {
    document.getElementById('profil-incomplet-banner')?.remove();
  }
}

async function checkRgpdExpiry() {
  try {
    await sb.rpc('check_rgpd_expiry');
    await loadContacts();
  } catch(e) {
    console.warn('check_rgpd_expiry:', e.message);
  }
}
