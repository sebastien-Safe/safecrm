// ==========================================================================
// S@FE CRM — Moteur du Centre d'Aide
// ==========================================================================

// ============================================================
// État interne
// ============================================================
let _helpCurrentTab = 'contextual';
let _tutoSteps      = [];
let _tutoIndex      = 0;
let _tutoHighlight  = null;

// ============================================================
// Ouverture / Fermeture
// ============================================================
function openHelp(tab) {
  tab = tab || _helpCurrentTab || 'contextual';
  const panel    = document.getElementById('help-panel');
  const backdrop = document.getElementById('help-backdrop');
  if (!panel) return;
  backdrop.style.display = 'block';
  panel.style.transform  = 'translateX(0)';
  switchHelpTab(tab);
}

function closeHelp() {
  const panel    = document.getElementById('help-panel');
  const backdrop = document.getElementById('help-backdrop');
  if (!panel) return;
  panel.style.transform  = 'translateX(100%)';
  backdrop.style.display = 'none';
}

// ============================================================
// Navigation entre onglets
// ============================================================
function switchHelpTab(tab) {
  _helpCurrentTab = tab;
  document.querySelectorAll('[data-help-tab]').forEach(b =>
    b.classList.toggle('help-tab-active', b.dataset.helpTab === tab));
  const body = document.getElementById('help-body');
  if (!body) return;
  if (tab === 'contextual') renderHelpContextual(body);
  if (tab === 'docs')       renderHelpDocs(body);
  if (tab === 'faq')        renderHelpFaq(body);
  if (tab === 'rgpd')       renderHelpRgpd(body);
  if (tab === 'search')     renderHelpSearch(body);
}

// ============================================================
// Aide contextuelle — vue active
// ============================================================
function renderHelpContextual(body) {
  const view = (typeof state !== 'undefined' && state.view) || 'dashboard';
  const data = (typeof HELP_VIEWS_DATA !== 'undefined' && HELP_VIEWS_DATA[view]);

  if (!data) {
    body.innerHTML = `
      <div style="padding:24px">
        <p class="empty">Aucune aide disponible pour la vue <b>${view}</b>.</p>
        <button class="btn btn-out btn-sm" style="margin-top:12px" onclick="switchHelpTab('docs')">📚 Voir toute la documentation</button>
      </div>`;
    return;
  }

  const roleOk = data.roles === 'all'
    || (typeof state !== 'undefined' && (
      data.roles === 'admin' ? state.profile?.is_admin :
      data.roles === 'dci'   ? (state.profile?.role === 'resp-equipe' || state.profile?.is_admin) : true
    ));

  if (!roleOk) {
    body.innerHTML = `<div style="padding:24px"><p class="empty">Cette section n'est pas accessible avec votre rôle.</p></div>`;
    return;
  }

  const tutoAvailable = typeof HELP_TUTORIALS_DATA !== 'undefined' && HELP_TUTORIALS_DATA[view];

  body.innerHTML = `
    <div style="padding:20px 22px">

      <!-- En-tête fiche -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px">
        <div>
          <div style="font-size:2rem;margin-bottom:4px">${data.icon}</div>
          <h3 style="margin:0;font-family:Sora,sans-serif;font-size:1.05rem">${data.title}</h3>
        </div>
        ${tutoAvailable ? `
          <button class="btn btn-out btn-sm" onclick="startTutorial('${view}')" style="white-space:nowrap;flex-shrink:0">
            🎯 Tutoriel guidé
          </button>` : ''}
      </div>

      <p style="font-size:.87rem;color:#475569;line-height:1.6;margin-bottom:18px">${data.description}</p>

      <!-- Sections info -->
      ${(data.sections || []).map(s => `
        <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;margin-bottom:14px">
          <div style="font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:8px">${s.title}</div>
          <ul style="margin:0;padding-left:16px">
            ${s.items.map(i => `<li style="font-size:.84rem;color:#334155;margin-bottom:4px">${i}</li>`).join('')}
          </ul>
        </div>`).join('')}

      <!-- Procédures pas à pas -->
      ${data.steps?.length ? `
        <div style="margin-bottom:18px">
          <div style="font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:10px">Procédures</div>
          ${data.steps.map((s, i) => `
            <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">
              <div style="width:24px;height:24px;border-radius:50%;background:var(--accent,#3b82f6);color:#fff;font-size:.75rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${i + 1}</div>
              <div>
                <div style="font-size:.85rem;font-weight:600;color:#0a1628;margin-bottom:2px">${s.title}</div>
                <div style="font-size:.82rem;color:#475569">${s.content}</div>
              </div>
            </div>`).join('')}
        </div>` : ''}

      <!-- Erreurs fréquentes -->
      ${data.errors?.length ? `
        <div style="margin-bottom:18px">
          <div style="font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:10px">Erreurs fréquentes</div>
          ${data.errors.map(e => `
            <details style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;overflow:hidden">
              <summary style="padding:10px 14px;font-size:.84rem;font-weight:500;cursor:pointer;color:#334155">⚠️ ${e.q}</summary>
              <div style="padding:10px 14px 12px;font-size:.83rem;color:#475569;background:#fafafa;border-top:1px solid #e2e8f0">${e.a}</div>
            </details>`).join('')}
        </div>` : ''}

      <!-- Liens associés -->
      ${data.related?.length ? `
        <div>
          <div style="font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:8px">Voir aussi</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${data.related.map(r => {
              const rd = typeof HELP_VIEWS_DATA !== 'undefined' && HELP_VIEWS_DATA[r];
              return rd ? `<button class="btn btn-out btn-sm" onclick="closeHelp();switchView('${r}')" style="font-size:.78rem">${rd.icon} ${rd.title}</button>` : '';
            }).join('')}
          </div>
        </div>` : ''}

    </div>`;
}

// ============================================================
// Documentation complète
// ============================================================
function renderHelpDocs(body) {
  if (typeof HELP_VIEWS_DATA === 'undefined') { body.innerHTML = '<p class="empty" style="padding:20px">Contenu non disponible.</p>'; return; }

  const isAdmin = typeof state !== 'undefined' && state.profile?.is_admin;

  const cards = Object.entries(HELP_VIEWS_DATA)
    .filter(([, d]) => d.roles === 'all' || (isAdmin && d.roles === 'admin') || (typeof state !== 'undefined' && state.profile?.role === d.roles))
    .map(([key, d]) => `
      <div onclick="switchHelpTab('contextual');if(typeof state!=='undefined')state.view='${key}';renderHelpContextual(document.getElementById('help-body'))"
           style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;cursor:pointer;transition:border-color .15s;margin-bottom:8px"
           onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='#e2e8f0'">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1.3rem">${d.icon}</span>
          <div>
            <div style="font-weight:600;font-size:.9rem;color:#0a1628">${d.title}</div>
            <div style="font-size:.78rem;color:#64748b;margin-top:2px">${d.description.slice(0, 80)}…</div>
          </div>
          <span style="margin-left:auto;color:#94a3b8;font-size:1rem">›</span>
        </div>
      </div>`).join('');

  const docsLink = (typeof HELP_DOCS_LINK !== 'undefined')
    ? `<a href="${HELP_DOCS_LINK.url}" target="_blank" rel="noopener"
         style="display:flex;align-items:center;gap:12px;border:1.5px solid rgba(245,158,11,.4);border-radius:10px;padding:14px 16px;text-decoration:none;background:rgba(245,158,11,.06);margin-bottom:20px;transition:border-color .15s"
         onmouseover="this.style.borderColor='rgba(245,158,11,.8)'" onmouseout="this.style.borderColor='rgba(245,158,11,.4)'">
        <span style="font-size:1.4rem">📄</span>
        <div>
          <div style="font-weight:700;font-size:.9rem;color:#0a1628">${HELP_DOCS_LINK.label}</div>
          <div style="font-size:.77rem;color:#64748b;margin-top:2px">${HELP_DOCS_LINK.description}</div>
        </div>
        <span style="margin-left:auto;color:#f59e0b;font-size:1rem">↗</span>
      </a>`
    : '';

  body.innerHTML = `
    <div style="padding:20px 22px">
      ${docsLink}
      <h3 style="margin:0 0 16px;font-family:Sora,sans-serif;font-size:1rem">📚 Documentation des modules</h3>
      ${cards}
    </div>`;
}

// ============================================================
// FAQ
// ============================================================
function renderHelpFaq(body) {
  if (typeof HELP_FAQ_DATA === 'undefined') { body.innerHTML = '<p class="empty" style="padding:20px">FAQ non disponible.</p>'; return; }

  const isAdmin = typeof state !== 'undefined' && state.profile?.is_admin;
  const themes  = isAdmin
    ? HELP_FAQ_DATA
    : HELP_FAQ_DATA.filter(t => t.theme !== 'Administration' && t.theme !== 'RGPD');

  body.innerHTML = `
    <div style="padding:20px 22px">
      <h3 style="margin:0 0 16px;font-family:Sora,sans-serif;font-size:1rem">💬 Questions fréquentes</h3>
      ${themes.map(t => `
        <div style="margin-bottom:20px">
          <div style="font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:8px">${t.icon} ${t.theme}</div>
          ${t.items.map(item => `
            <details style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;overflow:hidden">
              <summary style="padding:10px 14px;font-size:.84rem;font-weight:500;cursor:pointer;color:#334155;list-style:none;display:flex;align-items:center;justify-content:space-between">
                <span>${item.q}</span>
                <span style="color:#94a3b8;font-size:.8rem;flex-shrink:0;margin-left:8px">▼</span>
              </summary>
              <div style="padding:10px 14px 12px;font-size:.83rem;color:#475569;background:#fafafa;border-top:1px solid #e2e8f0;line-height:1.5">${item.a}</div>
            </details>`).join('')}
        </div>`).join('')}
    </div>`;
}

// ============================================================
// Documentation RGPD
// ============================================================
function renderHelpRgpd(body) {
  const isAdmin = typeof state !== 'undefined' && state.profile?.is_admin;

  if (!isAdmin) {
    body.innerHTML = `
      <div style="padding:24px;text-align:center">
        <div style="font-size:2.5rem;margin-bottom:12px">🔐</div>
        <p style="font-size:.9rem;color:#475569">La documentation RGPD est réservée aux administrateurs.</p>
      </div>`;
    return;
  }

  if (typeof HELP_RGPD_DATA === 'undefined') { body.innerHTML = '<p class="empty" style="padding:20px">Non disponible.</p>'; return; }

  body.innerHTML = `
    <div style="padding:20px 22px">
      <h3 style="margin:0 0 6px;font-family:Sora,sans-serif;font-size:1rem">🔐 Documentation RGPD</h3>
      <p style="font-size:.8rem;color:#64748b;margin-bottom:16px">Règlement UE 2016/679 — Responsable de traitement : S@FE SAS</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px">
        <button class="btn btn-out btn-sm" onclick="closeHelp();switchView('admin');setTimeout(()=>switchAdminTab('registre'),200)">
          Ouvrir le Registre RGPD →
        </button>
      </div>
      ${HELP_RGPD_DATA.map(r => `
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px">
          <div style="font-size:1.1rem;margin-bottom:6px">${r.icon}</div>
          <div style="font-weight:700;font-size:.9rem;color:#0a1628;margin-bottom:6px">${r.title}</div>
          <p style="font-size:.83rem;color:#475569;line-height:1.5;margin-bottom:10px">${r.content}</p>
          <ul style="margin:0;padding-left:16px">
            ${r.points.map(p => `<li style="font-size:.8rem;color:#64748b;margin-bottom:3px">${p}</li>`).join('')}
          </ul>
        </div>`).join('')}
    </div>`;
}

// ============================================================
// Recherche globale
// ============================================================
function renderHelpSearch(body) {
  body.innerHTML = `
    <div style="padding:20px 22px">
      <h3 style="margin:0 0 12px;font-family:Sora,sans-serif;font-size:1rem">🔍 Recherche</h3>
      <div style="position:relative;margin-bottom:16px">
        <input id="help-search-input" type="text" class="form-control"
               placeholder="Rechercher une procédure, une fonctionnalité, une FAQ…"
               oninput="executeHelpSearch(this.value)"
               style="padding-right:36px">
        <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none">🔍</span>
      </div>
      <div id="help-search-results">
        <p style="font-size:.84rem;color:#94a3b8;text-align:center;padding:20px 0">Saisissez au moins 2 caractères pour lancer la recherche.</p>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('help-search-input')?.focus(), 100);
}

function executeHelpSearch(query) {
  const results = document.getElementById('help-search-results');
  if (!results) return;

  const q = query.trim().toLowerCase();
  if (q.length < 2) {
    results.innerHTML = '<p style="font-size:.84rem;color:#94a3b8;text-align:center;padding:20px 0">Saisissez au moins 2 caractères.</p>';
    return;
  }

  const matches = [];

  // Recherche dans les fiches de vue
  if (typeof HELP_VIEWS_DATA !== 'undefined') {
    Object.entries(HELP_VIEWS_DATA).forEach(([key, d]) => {
      const text = [d.title, d.description,
        ...(d.steps || []).map(s => s.title + ' ' + s.content),
        ...(d.sections || []).flatMap(s => s.items),
        ...(d.errors || []).map(e => e.q + ' ' + e.a),
      ].join(' ').toLowerCase();
      if (text.includes(q)) {
        matches.push({ type: 'doc', icon: d.icon, title: d.title, excerpt: _helpExcerpt(d.description, q), action: `switchHelpTab('contextual');if(typeof state!=='undefined')state.view='${key}';renderHelpContextual(document.getElementById('help-body'))` });
      }
    });
  }

  // Recherche dans la FAQ
  if (typeof HELP_FAQ_DATA !== 'undefined') {
    HELP_FAQ_DATA.forEach(theme => {
      theme.items.forEach(item => {
        if ((item.q + ' ' + item.a).toLowerCase().includes(q)) {
          matches.push({ type: 'faq', icon: theme.icon, title: item.q, excerpt: _helpExcerpt(item.a, q), action: `switchHelpTab('faq')` });
        }
      });
    });
  }

  // Recherche dans la documentation RGPD
  if (typeof HELP_RGPD_DATA !== 'undefined') {
    HELP_RGPD_DATA.forEach(r => {
      if ((r.title + ' ' + r.content + ' ' + r.points.join(' ')).toLowerCase().includes(q)) {
        matches.push({ type: 'rgpd', icon: r.icon, title: r.title, excerpt: _helpExcerpt(r.content, q), action: `switchHelpTab('rgpd')` });
      }
    });
  }

  if (!matches.length) {
    results.innerHTML = `<p style="font-size:.84rem;color:#94a3b8;text-align:center;padding:20px 0">Aucun résultat pour "<b>${_esc(query)}</b>".</p>`;
    return;
  }

  const typeLabel = { doc: '📄 Documentation', faq: '💬 FAQ', rgpd: '🔐 RGPD' };
  results.innerHTML = `
    <div style="font-size:.78rem;color:#64748b;margin-bottom:10px">${matches.length} résultat${matches.length > 1 ? 's' : ''}</div>
    ${matches.map(m => `
      <div onclick="${m.action}" style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;cursor:pointer;margin-bottom:6px;transition:border-color .15s"
           onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='#e2e8f0'">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:.7rem;background:#f1f5f9;color:#64748b;padding:2px 7px;border-radius:99px">${typeLabel[m.type] || ''}</span>
        </div>
        <div style="font-size:.86rem;font-weight:600;color:#0a1628;margin-bottom:3px">${_esc(m.title)}</div>
        <div style="font-size:.78rem;color:#64748b">${m.excerpt}</div>
      </div>`).join('')}`;
}

function _helpExcerpt(text, query) {
  const clean = text.replace(/<[^>]+>/g, '');
  const idx   = clean.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return _esc(clean.slice(0, 90)) + '…';
  const start = Math.max(0, idx - 30);
  const end   = Math.min(clean.length, idx + query.length + 60);
  const slice = (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
  const highlighted = slice.replace(new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark style="background:#fef9c3;border-radius:2px">$1</mark>');
  return highlighted;
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ============================================================
// Système de tutoriel guidé
// ============================================================
function startTutorial(viewId) {
  const steps = (typeof HELP_TUTORIALS_DATA !== 'undefined' && HELP_TUTORIALS_DATA[viewId]) || [];
  if (!steps.length) { alert('Aucun tutoriel disponible pour cette vue.'); return; }

  closeHelp();
  _tutoSteps = steps;
  _tutoIndex = 0;

  const overlay = document.getElementById('tuto-overlay');
  const bubble  = document.getElementById('tuto-bubble');
  if (overlay) overlay.style.display = 'block';
  if (bubble)  bubble.style.display  = 'block';

  renderTutoStep();
}

function renderTutoStep() {
  const step    = _tutoSteps[_tutoIndex];
  const bubble  = document.getElementById('tuto-bubble');
  const overlay = document.getElementById('tuto-overlay');
  if (!step || !bubble) return;

  // Nettoyage du highlight précédent
  if (_tutoHighlight) {
    _tutoHighlight.style.outline     = '';
    _tutoHighlight.style.outlineOffset = '';
    _tutoHighlight.style.zIndex      = '';
    _tutoHighlight.style.position    = '';
    _tutoHighlight = null;
  }

  document.getElementById('tuto-step-label').textContent = `Étape ${_tutoIndex + 1} sur ${_tutoSteps.length}`;
  document.getElementById('tuto-title').textContent   = step.title;
  document.getElementById('tuto-content').textContent = step.content;
  document.getElementById('tuto-prev').style.display  = _tutoIndex === 0 ? 'none' : 'inline-flex';
  document.getElementById('tuto-next').textContent    = _tutoIndex === _tutoSteps.length - 1 ? 'Terminer ✓' : 'Suivant →';

  // Points de progression
  document.getElementById('tuto-dots').innerHTML = _tutoSteps.map((_, i) =>
    `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;margin:0 2px;background:${i === _tutoIndex ? '#3b82f6' : '#e2e8f0'}"></span>`
  ).join('');

  // Overlay semi-transparent
  if (overlay) {
    overlay.style.background = step.target ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.5)';
  }

  // Mise en avant de l'élément cible
  if (step.target) {
    const el = document.querySelector(step.target);
    if (el) {
      _tutoHighlight             = el;
      el.style.outline           = '3px solid #3b82f6';
      el.style.outlineOffset     = '4px';
      el.style.position          = el.style.position || 'relative';
      el.style.zIndex            = '1202';

      // Positionner la bulle relative à l'élément
      const rect   = el.getBoundingClientRect();
      const pos    = step.position || 'bottom';
      const bW     = 320;
      const bMargin = 14;

      if (pos === 'right') {
        bubble.style.left = Math.min(rect.right + bMargin, window.innerWidth - bW - 10) + 'px';
        bubble.style.top  = Math.max(rect.top, 10) + 'px';
      } else if (pos === 'bottom') {
        bubble.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - bW - 10)) + 'px';
        bubble.style.top  = (rect.bottom + bMargin) + 'px';
      } else if (pos === 'top') {
        bubble.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - bW - 10)) + 'px';
        bubble.style.top  = (rect.top - 180 - bMargin) + 'px';
      } else {
        _centerBubble(bubble);
      }
      return;
    }
  }
  _centerBubble(bubble);
}

function _centerBubble(bubble) {
  bubble.style.left = '50%';
  bubble.style.top  = '50%';
  bubble.style.transform = 'translate(-50%, -50%)';
}

function tutorialNext() {
  if (_tutoIndex >= _tutoSteps.length - 1) { closeTutorial(); return; }
  const bubble = document.getElementById('tuto-bubble');
  if (bubble) bubble.style.transform = '';
  _tutoIndex++;
  renderTutoStep();
}

function tutorialPrev() {
  if (_tutoIndex <= 0) return;
  const bubble = document.getElementById('tuto-bubble');
  if (bubble) bubble.style.transform = '';
  _tutoIndex--;
  renderTutoStep();
}

function closeTutorial() {
  if (_tutoHighlight) {
    _tutoHighlight.style.outline      = '';
    _tutoHighlight.style.outlineOffset = '';
    _tutoHighlight.style.zIndex       = '';
    _tutoHighlight = null;
  }
  const overlay = document.getElementById('tuto-overlay');
  const bubble  = document.getElementById('tuto-bubble');
  const bEl     = document.getElementById('tuto-bubble');
  if (overlay) overlay.style.display = 'none';
  if (bubble)  bubble.style.display  = 'none';
  if (bEl)     bEl.style.transform   = '';
  _tutoSteps = [];
  _tutoIndex = 0;

  // Marquer le tutoriel comme vu
  try { localStorage.setItem('safe_tuto_seen', '1'); } catch (_) {}
}

// ============================================================
// Tutoriel automatique à la 1ère connexion
// ============================================================
function maybeStartWelcomeTutorial() {
  try {
    if (!localStorage.getItem('safe_tuto_seen') && typeof state !== 'undefined' && state.user) {
      setTimeout(() => startTutorial('dashboard'), 1200);
    }
  } catch (_) {}
}

// ============================================================
// Détection des vues sans documentation
// ============================================================
function checkUndocumentedViews() {
  if (typeof state === 'undefined' || !state.profile?.is_admin) return;
  if (typeof HELP_VIEWS_DATA === 'undefined') return;

  const allViews       = ['dashboard', 'contacts', 'contracts', 'tasks', 'objectifs', 'admin'];
  const documented     = Object.keys(HELP_VIEWS_DATA);
  const undocumented   = allViews.filter(v => !documented.includes(v));
  if (undocumented.length) {
    console.warn('[Centre d\'Aide] Vues sans documentation :', undocumented);
  }
}

// ============================================================
// Init — appelé après connexion
// ============================================================
function initHelp() {
  checkUndocumentedViews();
}

// ============================================================
// Modale demande d'assistance
// ============================================================
function openAssistanceModal() {
  // Pré-sélectionner le module selon la vue active
  const view = typeof state !== 'undefined' ? state.view : '';
  const moduleMap = {
    contacts:  'Contacts',
    contracts: 'Contrats',
    tasks:     'Contrats',
    objectifs: 'Administration',
    admin:     'Administration',
  };
  const select = document.getElementById('assistance-module');
  if (select && moduleMap[view]) select.value = moduleMap[view];

  // Réinitialiser urgence et message
  selectUrgence('Normal');
  const msg = document.getElementById('assistance-message');
  if (msg) msg.value = '';

  document.getElementById('assistance-backdrop').style.display = 'block';
  document.getElementById('assistance-modal').style.display    = 'block';
  setTimeout(() => document.getElementById('assistance-message')?.focus(), 150);
}

function closeAssistanceModal() {
  document.getElementById('assistance-backdrop').style.display = 'none';
  document.getElementById('assistance-modal').style.display    = 'none';
}

function selectUrgence(level) {
  document.getElementById('assistance-urgence').value = level;
  ['Normal', 'Urgent', 'Bloquant'].forEach(l => {
    const el = document.getElementById('urg-' + l.toLowerCase());
    if (!el) return;
    const active = l === level;
    const colors = { Normal: '#3b82f6', Urgent: '#f59e0b', Bloquant: '#ef4444' };
    const bgs    = { Normal: '#eff6ff', Urgent: '#fffbeb', Bloquant: '#fef2f2' };
    el.style.borderColor = active ? colors[l]   : '#e5e7eb';
    el.style.color       = active ? colors[l]   : '#64748b';
    el.style.background  = active ? bgs[l]      : '#f8fafc';
  });
}

function sendAssistanceRequest() {
  const message = (document.getElementById('assistance-message')?.value || '').trim();
  if (!message) {
    document.getElementById('assistance-message')?.focus();
    document.getElementById('assistance-message')?.style && (document.getElementById('assistance-message').style.borderColor = '#ef4444');
    return;
  }
  if (document.getElementById('assistance-message')) {
    document.getElementById('assistance-message').style.borderColor = '';
  }

  const module   = document.getElementById('assistance-module')?.value  || 'Autre';
  const urgence  = document.getElementById('assistance-urgence')?.value  || 'Normal';
  const prenom   = typeof state !== 'undefined' ? (state.profile?.prenom || '') : '';
  const nom      = typeof state !== 'undefined' ? (state.profile?.nom    || '') : '';
  const email    = typeof state !== 'undefined' ? (state.user?.email     || '') : '';
  const fullName = [prenom, nom].filter(Boolean).join(' ') || 'Utilisateur';
  const view     = typeof state !== 'undefined' ? (state.view || '') : '';

  const subject = `[S@FE CRM] Demande d'assistance — ${module} — Urgence : ${urgence}`;
  const body = [
    `Bonjour,`,
    ``,
    `Je rencontre un problème avec le CRM S@FE et sollicite votre assistance.`,
    ``,
    `─── Informations ───────────────────────`,
    `Utilisateur : ${fullName}`,
    `Email       : ${email}`,
    `Module      : ${module}`,
    `Vue active  : ${view || 'N/A'}`,
    `Urgence     : ${urgence}`,
    `Date        : ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}`,
    `────────────────────────────────────────`,
    ``,
    `Description du problème :`,
    message,
    ``,
    `Cordialement,`,
    fullName,
  ].join('\n');

  const mailto = `mailto:contact@safe-digitalisation.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
  closeAssistanceModal();
}
