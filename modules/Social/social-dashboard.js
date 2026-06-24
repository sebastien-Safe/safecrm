/* Social Clients — Dashboard global */

async function loadDashboard() {
  const el = document.getElementById('dashboard-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const [
    { data: profiles },
    { count: nbTotal },
    { count: nbPlanifie },
    { count: nbPublie },
    { data: pubPosts },
  ] = await Promise.all([
    supa.from('social_client_profiles').select('contact_id,reseaux'),
    supa.from('social_posts').select('*', { count:'exact', head:true }),
    supa.from('social_posts').select('*', { count:'exact', head:true }).eq('statut','planifie'),
    supa.from('social_posts').select('*', { count:'exact', head:true }).eq('statut','publie'),
    supa.from('social_posts').select('reseau,perf_likes,perf_reach').eq('statut','publie'),
  ]);

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.contact_id] = p; });

  /* Stats par réseau sur tous les posts publiés */
  const netStats = {};
  (pubPosts || []).forEach(p => {
    if (!netStats[p.reseau]) netStats[p.reseau] = { posts:0, likes:0, reach:0 };
    netStats[p.reseau].posts++;
    netStats[p.reseau].likes += p.perf_likes || 0;
    netStats[p.reseau].reach += p.perf_reach || 0;
  });

  el.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-val">${allContacts.length}</div>
        <div class="stat-lbl">Clients</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--social)">${nbTotal || 0}</div>
        <div class="stat-lbl">Posts total</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--warn)">${nbPlanifie || 0}</div>
        <div class="stat-lbl">Planifiés</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--ok)">${nbPublie || 0}</div>
        <div class="stat-lbl">Publiés</div>
      </div>
    </div>

    ${Object.keys(netStats).length ? `
    <div class="card" style="margin-bottom:14px">
      <div class="card-header"><span class="card-title">— Performance par réseau</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px">
        ${Object.entries(netStats).map(([k, v]) => {
          const net = RESEAUX[k] || { label:k, ico:'🌐', color:'var(--mut)', bg:'rgba(148,163,184,.1)' };
          return `<div class="net-card">
            <div class="net-card-ico" style="color:${net.color}">${net.ico}</div>
            <div>
              <div class="net-card-name">${net.label}</div>
              <div class="net-card-meta">${v.posts} post${v.posts > 1 ? 's' : ''} publiés</div>
              ${v.likes ? `<div class="net-card-meta">❤️ ${v.likes} · 👁 ${v.reach.toLocaleString('fr-FR')}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-header">
        <span class="card-title">— Clients</span>
        <input type="text" placeholder="Chercher…" oninput="filterDashList(this.value)"
          style="font-size:.74rem;padding:4px 8px;border-radius:6px;width:130px;background:rgba(0,0,0,.2);
            border:1px solid var(--line);color:#fff;outline:none">
      </div>
      <div id="dash-client-list">${_renderDashClientList(profileMap)}</div>
    </div>`;
}

function _renderDashClientList(profileMap) {
  if (!allContacts.length) return '<p style="color:var(--mut);font-size:.8rem">Aucun contact.</p>';
  return allContacts.map((c, i) => {
    const p = profileMap[c.id];
    const nom = [c.nom, c.prenom].filter(Boolean).join(' ') || c.entreprise || '—';
    const reseaux = p?.reseaux || [];
    const badges = reseaux.map(r => {
      const net = RESEAUX[r];
      return net
        ? `<span class="net-badge" style="background:${net.bg};color:${net.color}">${net.ico} <span style="font-size:.62rem">${net.label}</span></span>`
        : '';
    }).join('');
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
        border-bottom:1px solid var(--line2);cursor:pointer"
        data-search="${nom.toLowerCase()}" data-idx="${i}"
        onclick="selectContact(allContacts[${i}])">
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:600;color:#fff">${escHtml(nom)}</div>
          <div style="font-size:.7rem;color:var(--mut)">${escHtml(c.entreprise || '—')}</div>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${badges || '<span style="font-size:.7rem;color:var(--mut)">Non configuré</span>'}
        </div>
        <span style="color:var(--mut);font-size:.8rem;flex-shrink:0">→</span>
      </div>`;
  }).join('');
}

function filterDashList(q) {
  const lq = q.toLowerCase();
  document.querySelectorAll('#dash-client-list > div[data-search]').forEach(el => {
    el.style.display = el.dataset.search.includes(lq) ? '' : 'none';
  });
}
