/* Social Clients — Core · navigation, utils, init */
const SUPA_URL = 'https://qdjmzietysukediqkebg.supabase.co';
const SUPA_KEY = 'sb_publishable_8uD3m60n9GfMt2h_GkmB7w_MpdFN5_s';
const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

let currentContact = null;
let allContacts    = [];

/* --- Réseaux sociaux avec vrais logos Font Awesome --- */
const RESEAUX = {
  facebook:  { label:'Facebook',          ico:'<i class="fa-brands fa-facebook"></i>',   color:'#1877f2', bg:'rgba(24,119,242,.13)' },
  instagram: { label:'Instagram',         ico:'<i class="fa-brands fa-instagram"></i>',  color:'#e1306c', bg:'rgba(225,48,108,.13)' },
  linkedin:  { label:'LinkedIn',          ico:'<i class="fa-brands fa-linkedin"></i>',   color:'#0a66c2', bg:'rgba(10,102,194,.13)'  },
  x:         { label:'X / Twitter',       ico:'<i class="fa-brands fa-x-twitter"></i>',  color:'#e7e7e7', bg:'rgba(231,231,231,.08)' },
  gmb:       { label:'Google My Business',ico:'<i class="fa-brands fa-google"></i>',    color:'#34a853', bg:'rgba(52,168,83,.13)'   },
};

const STATUTS_SOCIAL = {
  brouillon: { label:'Brouillon', cls:'st-brouillon' },
  planifie:  { label:'Planifié',  cls:'st-planifie'  },
  publie:    { label:'Publié',    cls:'st-publie'    },
  annule:    { label:'Annulé',    cls:'st-annule'    },
};

/* --- Navigation --- */
function showView(id) {
  document.querySelectorAll('.seo-view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + id);
  if (el) el.classList.add('active');
}

function selectContact(contact) {
  currentContact = contact;
  document.querySelectorAll('.sidebar-contact-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === String(contact.id)));
  const subnav = document.getElementById('social-subnav');
  if (subnav) subnav.style.display = '';
  const nameEl = document.getElementById('subnav-client-name');
  if (nameEl) nameEl.textContent = [contact.nom, contact.prenom].filter(Boolean).join(' ') || contact.entreprise || '—';
  const topEl = document.getElementById('topbar-contact-name');
  if (topEl) topEl.textContent = [contact.nom, contact.prenom].filter(Boolean).join(' ') || contact.entreprise || '';
  switchSubView('posts', document.querySelector('.subnav-item[data-view="posts"]'));
}

function clearContact() {
  currentContact = null;
  document.querySelectorAll('.sidebar-contact-item').forEach(el => el.classList.remove('active'));
  const subnav = document.getElementById('social-subnav');
  if (subnav) subnav.style.display = 'none';
  const topEl = document.getElementById('topbar-contact-name');
  if (topEl) topEl.textContent = '';
  showView('dashboard');
  if (typeof loadDashboard === 'function') loadDashboard();
}

/* --- Toast --- */
let _toastT = null;
function toast(msg, err = false) {
  const el = document.getElementById('social-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'show' + (err ? ' err' : '');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => { el.className = ''; }, 3000);
}

/* --- Modal --- */
function openModal(title, bodyHtml, foot = '') {
  document.getElementById('social-modal-title').textContent = title;
  document.getElementById('social-modal-body').innerHTML = bodyHtml;
  document.getElementById('social-modal-foot').innerHTML = foot;
  document.getElementById('social-modal-overlay').classList.add('open');
}
function closeModal() { document.getElementById('social-modal-overlay').classList.remove('open'); }

/* --- Utils --- */
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
}

/* --- Init --- */
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) { window.location.href = '/'; return; }

  const [{ data: contacts }, { data: profiles }] = await Promise.all([
    supa.from('contacts').select('id,nom,prenom,entreprise,email,statut').order('nom'),
    supa.from('social_client_profiles').select('contact_id,reseaux'),
  ]);

  allContacts = contacts || [];
  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.contact_id] = p; });

  const listEl = document.getElementById('sidebar-contacts');
  if (listEl) {
    listEl.innerHTML = allContacts.map((c, i) => {
      const p = profileMap[c.id];
      const nom = [c.nom, c.prenom].filter(Boolean).join(' ') || c.entreprise || '—';
      const reseaux = p?.reseaux || [];
      const icosHtml = reseaux.slice(0, 3).map(r => {
        const net = RESEAUX[r];
        return net ? `<span style="color:${net.color};font-size:.8rem">${net.ico}</span>` : '';
      }).join('');
      return `<div class="sidebar-contact-item" data-id="${c.id}" data-search="${nom.toLowerCase()}" data-idx="${i}">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(nom)}</span>
        <span style="display:flex;gap:2px;align-items:center;flex-shrink:0">
          ${icosHtml || '<span style="font-size:.62rem;color:var(--mut)">—</span>'}
        </span>
      </div>`;
    }).join('') || '<p style="padding:12px;font-size:.78rem;color:var(--mut)">Aucun contact.</p>';

    listEl.querySelectorAll('.sidebar-contact-item').forEach(el => {
      el.onclick = () => selectContact(allContacts[parseInt(el.dataset.idx)]);
    });
  }

  showView('dashboard');
  if (typeof loadDashboard === 'function') loadDashboard();
});
