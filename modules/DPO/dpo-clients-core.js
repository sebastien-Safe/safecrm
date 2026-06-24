/* ============================================================
   DPO Clients — Core : Supabase, auth, navigation, utilitaires
   ============================================================ */

const SUPA_URL = 'https://qdjmzietysukediqkebg.supabase.co';
const SUPA_KEY = 'sb_publishable_8uD3m60n9GfMt2h_GkmB7w_MpdFN5_s';
const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

let currentContact = null;
let allContacts    = [];
let _scoreMap      = {};

/* ── Navigation ── */
function showView(id) {
  document.querySelectorAll('.dpo-view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + id);
  if (view) view.classList.add('active');
}

function selectContact(contact) {
  currentContact = contact;
  // Masquer la liste clients, afficher la nav client
  const sidebarEl = document.querySelector('.dpo-sidebar');
  if (sidebarEl) sidebarEl.style.display = 'none';
  // Highlight sidebar
  document.querySelectorAll('.sidebar-contact-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === String(contact.id));
  });
  // Subnav
  const subnav = document.getElementById('dpo-subnav');
  if (subnav) subnav.style.display = '';
  const nameEl = document.getElementById('subnav-client-name');
  if (nameEl) nameEl.textContent = [contact.nom, contact.prenom].filter(Boolean).join(' ') || contact.entreprise || '—';
  const topEl = document.getElementById('topbar-contact-name');
  if (topEl) topEl.textContent = contact.nom || '';
  // Score sidebar
  const scoreEl = document.getElementById('sidebar-score');
  if (scoreEl) {
    const s = _scoreMap[contact.id] ?? null;
    if (s !== null) { scoreEl.textContent = s + '%'; scoreEl.style.color = scoreColor(s); }
    else            { scoreEl.textContent = '—%';    scoreEl.style.color = ''; }
  }
  // Charger la première sous-vue
  const firstItem = document.querySelector('.subnav-item[data-view="traitements"]');
  switchSubView('traitements', firstItem);
}

function clearContact() {
  currentContact = null;
  document.querySelectorAll('.sidebar-contact-item').forEach(el => el.classList.remove('active'));
  // Réafficher la liste clients, masquer la nav client
  const sidebarEl = document.querySelector('.dpo-sidebar');
  if (sidebarEl) sidebarEl.style.display = '';
  const subnav = document.getElementById('dpo-subnav');
  if (subnav) subnav.style.display = 'none';
  const topEl = document.getElementById('topbar-contact-name');
  if (topEl) topEl.textContent = '';
  showView('dashboard');
  loadDashboard();
}

/* ── Toast ── */
let _toastTimer = null;
function toast(msg, type = '') {
  const el = document.getElementById('dpo-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

/* ── Modal générique ── */
function openModal(title, bodyHtml, actions = '') {
  document.getElementById('dpo-modal-title').textContent = title;
  document.getElementById('dpo-modal-body').innerHTML = bodyHtml;
  document.getElementById('dpo-modal-foot').innerHTML = actions;
  document.getElementById('dpo-modal-overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('dpo-modal-overlay').classList.remove('open');
}

/* ── Utilitaires ── */
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}
function today() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function scoreColor(s) {
  if (s >= 80) return 'var(--ok)';
  if (s >= 50) return 'var(--warn)';
  return 'var(--alert)';
}
function scoreBadge(s) {
  if (s >= 80) return `<span class="score-badge score-ok">🟢 Conforme — ${s}%</span>`;
  if (s >= 50) return `<span class="score-badge score-warn">🟡 À surveiller — ${s}%</span>`;
  return `<span class="score-badge score-alert">🔴 Action requise — ${s}%</span>`;
}

/* ── Calcul du score RGPD ── */
async function computeScore(contactId) {
  const [
    { data: traits }, { data: consent }, { data: docs },
    { data: profile }
  ] = await Promise.all([
    supa.from('dpo_client_traitements').select('id,sous_traitants,statut').eq('contact_id', contactId).eq('statut', 'Actif'),
    supa.from('dpo_client_consentements').select('id,statut').eq('contact_id', contactId),
    supa.from('dpo_client_documents').select('id,type_document').eq('contact_id', contactId),
    supa.from('dpo_client_profiles').select('*').eq('contact_id', contactId).maybeSingle(),
  ]);

  const nbTraits   = (traits || []).length;
  const nbConsent  = (consent || []).filter(c => c.statut === 'actif').length;
  const nbDocs     = (docs || []).length;
  const typesDoc   = new Set((docs || []).map(d => d.type_document));
  const hasProc    = typesDoc.has('procedure_interne');
  const allST      = nbTraits > 0 && (traits || []).every(t => (t.sous_traitants || []).length > 0);
  const lastAudit  = profile?.last_audit_at ? new Date(profile.last_audit_at) : null;
  const auditOk    = lastAudit && (Date.now() - lastAudit) < 365 * 86400000;

  const s_traits   = Math.min(100, Math.round((nbTraits / 3) * 100));
  const s_consent  = Math.min(100, Math.round((nbConsent / 4) * 100));
  const s_docs     = Math.min(100, Math.round((typesDoc.size / 5) * 100));
  const s_st       = allST ? 100 : (nbTraits === 0 ? 0 : 30);
  const s_proc     = hasProc ? 100 : 0;
  const s_audit    = auditOk ? 100 : 0;

  const score = Math.round(
    s_traits  * 0.25 +
    s_consent * 0.20 +
    s_docs    * 0.20 +
    s_st      * 0.15 +
    s_proc    * 0.10 +
    s_audit   * 0.10
  );

  const upsertData = {
    contact_id: contactId, score_global: score,
    score_traitements: s_traits, score_consentements: s_consent,
    score_documents: s_docs, score_sous_traitants: s_st,
    score_procedures: s_proc, score_audit: s_audit,
    updated_at: new Date().toISOString(),
  };
  if (profile) {
    await supa.from('dpo_client_profiles').update(upsertData).eq('contact_id', contactId);
  } else {
    const { data: { user } } = await supa.auth.getUser();
    await supa.from('dpo_client_profiles').insert({ ...upsertData, created_by: user?.id });
  }

  return { score, s_traits, s_consent, s_docs, s_st, s_proc, s_audit };
}

/* ── Initialisation ── */
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) { window.location.href = '/'; return; }

  const [{ data: contacts }, { data: profiles }] = await Promise.all([
    supa.from('contacts').select('id,nom,prenom,entreprise,email,statut,siret').order('nom'),
    supa.from('dpo_client_profiles').select('contact_id,score_global'),
  ]);

  allContacts = contacts || [];
  _scoreMap = {};
  (profiles || []).forEach(p => { _scoreMap[p.contact_id] = p.score_global; });

  // Peupler la sidebar
  const listEl = document.getElementById('sidebar-contacts');
  if (listEl) {
    listEl.innerHTML = allContacts.map(c => {
      const score = _scoreMap[c.id] ?? null;
      const nom = [c.nom, c.prenom].filter(Boolean).join(' ') || c.entreprise || '—';
      return `
        <div class="sidebar-contact-item" data-id="${c.id}" data-search="${nom.toLowerCase()}">
          <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(nom)}</span>
          ${score !== null
            ? `<span style="font-family:var(--ff-mono);font-size:.68rem;font-weight:700;color:${scoreColor(score)}">${score}%</span>`
            : '<span style="font-size:.68rem;color:var(--mut)">—</span>'}
        </div>`;
    }).join('') || '<p style="padding:12px;font-size:.8rem;color:var(--mut)">Aucun contact.</p>';

    listEl.querySelectorAll('.sidebar-contact-item').forEach((el, i) => {
      el.onclick = () => selectContact(allContacts[i]);
    });
  }

  showView('dashboard');
  if (typeof loadDashboard === 'function') loadDashboard();
});
