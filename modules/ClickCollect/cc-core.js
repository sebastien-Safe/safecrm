/* Click & Collect — Core · navigation, utils, init */
const SUPA_URL = 'https://qdjmzietysukediqkebg.supabase.co';
const SUPA_KEY = 'sb_publishable_8uD3m60n9GfMt2h_GkmB7w_MpdFN5_s';
const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

let currentContact = null;
let allContacts    = [];

const CC_STATUTS = {
  en_attente: { label:'En attente', cls:'st-attente',  next:'confirme' },
  confirme:   { label:'Confirmé',   cls:'st-confirme', next:'pret'     },
  pret:       { label:'Prêt ✓',     cls:'st-pret',     next:'retire'   },
  retire:     { label:'Retiré',     cls:'st-retire',   next:null       },
  annule:     { label:'Annulé',     cls:'st-annule',   next:null       },
};

/* --- Navigation --- */
function showView(id) {
  document.querySelectorAll('.cc-view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + id);
  if (el) el.classList.add('active');
}

function selectContact(contact) {
  currentContact = contact;
  document.querySelectorAll('.sidebar-contact-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === String(contact.id)));
  document.getElementById('cc-subnav').style.display = '';
  const n = [contact.nom, contact.prenom].filter(Boolean).join(' ') || contact.entreprise || '—';
  document.getElementById('subnav-client-name').textContent = n;
  document.getElementById('topbar-contact-name').textContent = n;
  switchSubView('catalogue', document.querySelector('.subnav-item[data-view="catalogue"]'));
}

function clearContact() {
  currentContact = null;
  document.querySelectorAll('.sidebar-contact-item').forEach(el => el.classList.remove('active'));
  document.getElementById('cc-subnav').style.display = 'none';
  document.getElementById('topbar-contact-name').textContent = '';
  showView('dashboard');
  if (typeof loadDashboard === 'function') loadDashboard();
}

/* --- Toast --- */
let _toastT = null;
function toast(msg, err = false) {
  const el = document.getElementById('cc-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'show' + (err ? ' err' : '');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => { el.className = ''; }, 3000);
}

/* --- Modal --- */
function openModal(title, bodyHtml, foot = '') {
  document.getElementById('cc-modal-title').textContent = title;
  document.getElementById('cc-modal-body').innerHTML = bodyHtml;
  document.getElementById('cc-modal-foot').innerHTML = foot;
  document.getElementById('cc-modal-overlay').classList.add('open');
}
function closeModal() { document.getElementById('cc-modal-overlay').classList.remove('open'); }

/* --- Utils --- */
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtEur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { style:'currency', currency:'EUR' });
}
function genRef() {
  const now = new Date();
  return `CC-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*9000)+1000)}`;
}

/* --- Init --- */
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) { window.location.href = '/'; return; }

  const [{ data: contacts }, { data: profiles }] = await Promise.all([
    supa.from('contacts').select('id,nom,prenom,entreprise,email,statut').order('nom'),
    supa.from('cc_client_profiles').select('contact_id,actif,nom_boutique'),
  ]);

  allContacts = contacts || [];
  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.contact_id] = p; });

  const listEl = document.getElementById('sidebar-contacts');
  if (listEl) {
    listEl.innerHTML = allContacts.map((c, i) => {
      const p = profileMap[c.id];
      const nom = [c.nom, c.prenom].filter(Boolean).join(' ') || c.entreprise || '—';
      return `
        <div class="sidebar-contact-item" data-id="${c.id}" data-search="${nom.toLowerCase()}" data-idx="${i}">
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(nom)}</span>
          ${p?.actif
            ? '<span class="badge badge-ok" style="font-size:.55rem;flex-shrink:0">Actif</span>'
            : '<span style="font-size:.62rem;color:var(--mut);flex-shrink:0">—</span>'}
        </div>`;
    }).join('') || '<p style="padding:12px;font-size:.78rem;color:var(--mut)">Aucun contact.</p>';

    listEl.querySelectorAll('.sidebar-contact-item').forEach(el => {
      el.onclick = () => selectContact(allContacts[parseInt(el.dataset.idx)]);
    });
  }

  showView('dashboard');
  if (typeof loadDashboard === 'function') loadDashboard();
});
