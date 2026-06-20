/* ============================================================
   DPO Clients — Core : Supabase, auth, navigation, utilitaires
   Chargé en premier par module-dpo-clients.html
   ============================================================ */

const SUPA_URL = 'https://qdjmzietysukediqkebg.supabase.co';
const SUPA_KEY = 'sb_publishable_8uD3m60n9GfMt2h_GkmB7w_MpdFN5_s';
const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

/* ── État global ── */
let currentContact = null;   // contact sélectionné {id, nom, entreprise, ...}
let allContacts    = [];     // liste complète des contacts

/* ── Navigation ── */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  const view = document.getElementById('view-' + id);
  const btn  = document.getElementById('nav-' + id);
  if (view) view.classList.add('active');
  if (btn)  btn.classList.add('active');
}

function selectContact(contact) {
  currentContact = contact;
  document.getElementById('sidebar-client-section').style.display = '';
  document.getElementById('sidebar-client-name').textContent = contact.nom + (contact.entreprise ? ' — ' + contact.entreprise : '');
  showView('traitements');
  loadTraitements();
}

function clearContact() {
  currentContact = null;
  document.getElementById('sidebar-client-section').style.display = 'none';
  showView('clients');
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
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-actions').innerHTML = actions;
  document.getElementById('main-modal').classList.add('open');
}
function closeModal() {
  document.getElementById('main-modal').classList.remove('open');
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

  // Pondération selon spec
  const s_traits   = Math.min(100, Math.round((nbTraits / 3) * 100));   // 25%
  const s_consent  = Math.min(100, Math.round((nbConsent / 4) * 100));  // 20%
  const s_docs     = Math.min(100, Math.round((typesDoc.size / 5) * 100)); // 20%
  const s_st       = allST ? 100 : (nbTraits === 0 ? 0 : 30);           // 15%
  const s_proc     = hasProc ? 100 : 0;                                  // 10%
  const s_audit    = auditOk ? 100 : 0;                                  // 10%

  const score = Math.round(
    s_traits  * 0.25 +
    s_consent * 0.20 +
    s_docs    * 0.20 +
    s_st      * 0.15 +
    s_proc    * 0.10 +
    s_audit   * 0.10
  );

  // Sauvegarder en base
  const upsertData = {
    contact_id: contactId,
    score_global: score,
    score_traitements: s_traits,
    score_consentements: s_consent,
    score_documents: s_docs,
    score_sous_traitants: s_st,
    score_procedures: s_proc,
    score_audit: s_audit,
    updated_at: new Date().toISOString(),
  };
  if (profile) {
    await supa.from('dpo_client_profiles').update(upsertData).eq('contact_id', contactId);
  } else {
    await supa.from('dpo_client_profiles').insert({ ...upsertData, created_by: (await supa.auth.getUser()).data.user?.id });
  }

  return { score, s_traits, s_consent, s_docs, s_st, s_proc, s_audit };
}

/* ── Initialisation ── */
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) { window.location.href = '/'; return; }

  document.getElementById('topbar-user').textContent = session.user.email;

  // Chargement contacts
  const { data: contacts, error } = await supa.from('contacts')
    .select('id,nom,prenom,entreprise,email,statut')
    .order('nom');
  if (error) { toast('Erreur chargement contacts : ' + error.message, 'err'); return; }
  allContacts = contacts || [];

  showView('dashboard');
  if (typeof loadDashboard === 'function') loadDashboard();
});
