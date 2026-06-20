/* ============================================================
   SEO Clients — Core : auth, navigation, référentiel, score
   ============================================================ */

const SUPA_URL = window.SUPABASE_URL  || 'https://qdjmzietysukediqkebg.supabase.co';
const SUPA_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_8uD3m60n9GfMt2h_GkmB7w_MpdFN5_s';
const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

let currentContact = null;
let allContacts    = [];

/* ============================================================
   RÉFÉRENTIEL — 25 points de contrôle SEO, 5 catégories
   ============================================================ */
const SEO_CATS = {
  technique: {
    label: 'Technique', icon: '⚙️', weight: 0.30,
    items: [
      { key: 'https',       label: 'HTTPS actif, certificat SSL valide' },
      { key: 'sitemap',     label: 'Sitemap.xml présent et soumis à Google' },
      { key: 'robots',      label: 'Robots.txt configuré correctement' },
      { key: 'no_404',      label: 'Pas d\'erreurs 404 sur les pages principales' },
      { key: 'vitesse',     label: 'Vitesse de chargement < 3s (mobile)' },
      { key: 'cwv',         label: 'Core Web Vitals conformes (LCP, FID, CLS)' },
      { key: 'mobile',      label: 'Site responsive / mobile-friendly (Google Mobile Test)' },
      { key: 'schema',      label: 'Balisage Schema.org présent (LocalBusiness, FAQ…)' },
    ],
  },
  onpage: {
    label: 'On-Page', icon: '📝', weight: 0.25,
    items: [
      { key: 'title',       label: 'Balises title optimisées (50-60 car., mot-clé principal)' },
      { key: 'meta_desc',   label: 'Meta descriptions présentes et uniques (150-160 car.)' },
      { key: 'h1',          label: 'Balises H1 uniques par page avec mot-clé cible' },
      { key: 'maillage',    label: 'Maillage interne cohérent et fonctionnel' },
      { key: 'alt_img',     label: 'Attributs ALT présents sur les images importantes' },
      { key: 'canonical',   label: 'Balises canoniques configurées' },
    ],
  },
  contenu: {
    label: 'Contenu', icon: '✍️', weight: 0.20,
    items: [
      { key: 'contenu_unique', label: 'Contenu original, sans duplication (pas de contenu mince)' },
      { key: 'blog_actif',     label: 'Blog / actualités actif (≥ 1 publication/mois)' },
      { key: 'pages_service',  label: 'Pages de service optimisées par mot-clé cible' },
      { key: 'cocon_sem',      label: 'Structure en cocon sémantique (pillar pages + clusters)' },
    ],
  },
  local: {
    label: 'SEO Local (GMB)', icon: '📍', weight: 0.15,
    items: [
      { key: 'gmb_cree',    label: 'Fiche Google My Business créée et vérifiée' },
      { key: 'nap_coherent',label: 'NAP cohérent (Nom, Adresse, Tél.) sur tous les supports' },
      { key: 'avis',        label: 'Avis clients gérés, réponses publiées' },
      { key: 'gmb_photos',  label: 'Photos à jour sur la fiche GMB (≥ 10 photos)' },
    ],
  },
  backlinks: {
    label: 'Backlinks & Autorité', icon: '🔗', weight: 0.10,
    items: [
      { key: 'bl_qualite',  label: 'Profil de backlinks sain (pas de liens toxiques)' },
      { key: 'bl_entrants', label: 'Liens entrants de qualité (domaines pertinents et variés)' },
      { key: 'ancres',      label: 'Ancres diversifiées (marque + générique + mots-clés)' },
    ],
  },
};

/* ============================================================
   NAVIGATION
   ============================================================ */
function showView(id) {
  document.querySelectorAll('.seo-view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + id);
  if (el) el.classList.add('active');
}

function selectContact(contact) {
  currentContact = contact;
  document.querySelectorAll('.sidebar-contact-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === contact.id);
  });
  const subnav = document.getElementById('seo-subnav');
  if (subnav) subnav.style.display = '';
  const nameEl = document.getElementById('subnav-client-name');
  if (nameEl) nameEl.textContent = contact.nom || contact.prenom || '—';
  const topEl = document.getElementById('topbar-contact-name');
  if (topEl) topEl.textContent = contact.nom || '';
  // Charger le domaine depuis le profil
  supa.from('seo_client_profiles').select('domaine,score_global').eq('contact_id', contact.id).maybeSingle().then(({ data: p }) => {
    const domEl = document.getElementById('subnav-domain');
    if (domEl) domEl.textContent = p?.domaine || 'Domaine non renseigné';
    const scoreEl = document.getElementById('sidebar-score');
    if (scoreEl) { scoreEl.textContent = (p?.score_global ?? '—') + '%'; scoreEl.style.color = scoreColor(p?.score_global ?? 0); }
  });
  switchSubView('mots-cles', document.querySelector('.subnav-item[data-view="mots-cles"]'));
}

function clearContact() {
  currentContact = null;
  document.querySelectorAll('.sidebar-contact-item').forEach(el => el.classList.remove('active'));
  document.getElementById('seo-subnav').style.display = 'none';
  showView('dashboard'); loadDashboard();
}

/* ============================================================
   TOAST + MODAL
   ============================================================ */
let _toastTimer;
function toast(msg, type = 'ok') {
  const el = document.getElementById('seo-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'show' + (type === 'err' ? ' err' : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3200);
}

function openModal(title, bodyHtml, footHtml = '') {
  document.getElementById('seo-modal-title').textContent = title;
  document.getElementById('seo-modal-body').innerHTML = bodyHtml;
  document.getElementById('seo-modal-foot').innerHTML = footHtml;
  document.getElementById('seo-modal-overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('seo-modal-overlay').classList.remove('open');
}

/* ============================================================
   HELPERS
   ============================================================ */
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR'); }
function today()    { return new Date().toISOString().slice(0,10); }
function scoreColor(s) { if (s >= 80) return 'var(--ok)'; if (s >= 50) return 'var(--warn)'; return 'var(--alert)'; }
function scoreBadge(s) {
  if (s >= 80) return '<span class="score-badge" style="background:rgba(34,197,94,.12);color:var(--ok)">🟢 Bon</span>';
  if (s >= 50) return '<span class="score-badge" style="background:rgba(245,158,11,.12);color:var(--warn)">🟡 À améliorer</span>';
  return '<span class="score-badge" style="background:rgba(255,77,94,.12);color:var(--alert)">🔴 Faible</span>';
}

function positionColor(pos) {
  if (!pos) return 'var(--mut)';
  if (pos <= 3)  return '#fbbf24';
  if (pos <= 10) return 'var(--ok)';
  if (pos <= 20) return 'var(--mut-2)';
  return 'var(--mut)';
}

function positionEvolution(actuelle, precedente) {
  if (!actuelle || !precedente) return '<span class="pos-stable">—</span>';
  const diff = precedente - actuelle;
  if (diff > 0) return `<span class="pos-up">↑ +${diff}</span>`;
  if (diff < 0) return `<span class="pos-down">↓ ${diff}</span>`;
  return '<span class="pos-stable">= stable</span>';
}

/* ============================================================
   CALCUL DU SCORE SEO
   ============================================================ */
async function computeScoreSEO(contactId) {
  const { data: rows } = await supa.from('seo_client_audits').select('item_key,statut').eq('contact_id', contactId);
  const byKey = {};
  (rows || []).forEach(r => { byKey[r.item_key] = r.statut; });

  const catScores = {};
  for (const [catKey, cat] of Object.entries(SEO_CATS)) {
    let sum = 0, total = 0;
    for (const item of cat.items) {
      const st = byKey[item.key] || 'non_verifie';
      if (st === 'na') continue;
      total++;
      if (st === 'conforme') sum += 1.0;
      else if (st === 'partiel') sum += 0.5;
    }
    catScores[catKey] = total > 0 ? Math.round((sum / total) * 100) : 0;
  }

  let weighted = 0;
  for (const [catKey, cat] of Object.entries(SEO_CATS)) {
    weighted += (catScores[catKey] || 0) * cat.weight;
  }
  const score = Math.round(weighted);

  const { data: { user } } = await supa.auth.getUser();
  await supa.from('seo_client_profiles').upsert({
    contact_id: contactId, score_global: score,
    updated_at: new Date().toISOString(), created_by: user?.id,
  }, { onConflict: 'contact_id' });

  return { score, catScores };
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) { window.location.href = '/'; return; }

  const [{ data: contacts }, { data: profiles }] = await Promise.all([
    supa.from('contacts').select('id,nom,prenom,entreprise').order('nom'),
    supa.from('seo_client_profiles').select('contact_id,score_global,domaine'),
  ]);

  allContacts = contacts || [];
  const scoreMap = {};
  (profiles || []).forEach(p => { scoreMap[p.contact_id] = p.score_global; });

  const listEl = document.getElementById('sidebar-contacts');
  if (listEl) {
    listEl.innerHTML = allContacts.map(c => {
      const score = scoreMap[c.id] ?? null;
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

  loadDashboard();
  showView('dashboard');
});
