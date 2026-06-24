/* ============================================================
   SEO Clients — Dashboard global
   ============================================================ */

async function loadDashboard() {
  const el = document.getElementById('dashboard-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  const [{ data: profiles }, { data: motsCles }] = await Promise.all([
    supa.from('seo_client_profiles').select('contact_id,score_global,domaine'),
    supa.from('seo_client_mots_cles').select('contact_id,position_actuelle,type_mc'),
  ]);

  const scores    = (profiles || []).map(p => p.score_global).filter(s => s != null);
  const scoreMoyen = scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
  const top3      = (motsCles || []).filter(m => m.position_actuelle && m.position_actuelle <= 3).length;
  const top10     = (motsCles || []).filter(m => m.position_actuelle && m.position_actuelle <= 10).length;
  const totalMC   = (motsCles || []).length;

  const scoreMap = {};
  (profiles || []).forEach(p => { scoreMap[p.contact_id] = { score: p.score_global, domaine: p.domaine }; });

  el.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-val" style="color:var(--seo)">${scores.length}</div>
        <div class="stat-lbl">Clients suivis</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:${scoreColor(scoreMoyen)}">${scoreMoyen}%</div>
        <div class="stat-lbl">Score SEO moyen</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:#fbbf24">${top3}</div>
        <div class="stat-lbl">Mots-clés Top 3</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--ok)">${top10}</div>
        <div class="stat-lbl">Mots-clés Top 10</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${totalMC}</div>
        <div class="stat-lbl">Mots-clés suivis</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <!-- Connecteurs SEO -->
      <div class="card" style="border-color:rgba(245,158,11,.15)">
        <div class="card-header"><span class="card-title">— Connecteurs SEO</span></div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${[
            ['google_gsc', '🔍 Google Search Console', 'Positions automatiques'],
            ['google_gmb', '📍 Google My Business',    'Avis et statistiques'],
            ['seranking',  '📈 SE Ranking',            'Audit et backlinks'],
          ].map(([key, lbl, desc]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;
              background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:var(--r-sm)">
              <div style="flex:1">
                <div style="font-size:.82rem;color:#fff">${lbl}</div>
                <div style="font-size:.72rem;color:var(--mut);font-family:var(--ff-mono)">${desc}</div>
              </div>
              <span id="conn-status-${key}" class="badge badge-gray">Chargement…</span>
            </div>`).join('')}
          <a href="/modules/connecteurs.html" class="btn btn-ghost btn-sm" style="margin-top:4px">
            🔌 Gérer les connecteurs →
          </a>
        </div>
      </div>

      <!-- Top clients -->
      <div class="card">
        <div class="card-header"><span class="card-title">— Top clients SEO</span></div>
        ${scores.length ? `
          <div style="display:flex;flex-direction:column;gap:6px">
            ${(profiles || [])
              .filter(p => p.score_global != null)
              .sort((a,b) => b.score_global - a.score_global)
              .slice(0, 5)
              .map(p => {
                const c = allContacts.find(x => x.id === p.contact_id);
                const nom = c ? ([c.nom, c.prenom].filter(Boolean).join(' ') || c.entreprise || '—') : '—';
                return `
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:.8rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(nom)}</span>
                    <div class="score-bar-wrap" style="width:80px">
                      <div class="score-bar" style="width:${p.score_global}%;background:${scoreColor(p.score_global)}"></div>
                    </div>
                    <span style="font-family:var(--ff-mono);font-size:.74rem;font-weight:700;
                      color:${scoreColor(p.score_global)};min-width:32px;text-align:right">${p.score_global}%</span>
                  </div>`;
              }).join('')}
          </div>` : '<p style="font-size:.82rem;color:var(--mut)">Aucun client audité.</p>'}
      </div>
    </div>

    <!-- Liste complète -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">— Tous les clients (${allContacts.length})</span>
        <input class="form-input" style="max-width:200px;padding:5px 10px;font-size:.78rem"
          placeholder="🔍 Filtrer…" oninput="filterDashList(this.value)">
      </div>
      <div id="dash-client-list">
        ${renderDashClientList(scoreMap)}
      </div>
    </div>`;

  // Charger les statuts des connecteurs
  loadConnectorStatuses(['google_gsc','google_gmb','seranking']);
}

async function loadConnectorStatuses(keys) {
  const { data } = await supa.from('safe_connectors')
    .select('service_key,statut').in('service_key', keys);
  (data || []).forEach(row => {
    const el = document.getElementById('conn-status-' + row.service_key);
    if (!el) return;
    const cfg = {
      actif:         ['badge-ok',   '🟢 Actif'],
      configure:     ['badge-warn', '🟡 Configuré'],
      non_configure: ['badge-gray', '⚫ Non configuré'],
      desactive:     ['badge-alert','🔴 Désactivé'],
    }[row.statut] || ['badge-gray', row.statut];
    el.className = 'badge ' + cfg[0];
    el.textContent = cfg[1];
  });
}

function renderDashClientList(scoreMap) {
  return '<div style="display:flex;flex-direction:column;gap:6px">' + allContacts.map(c => {
    const info = scoreMap[c.id];
    const nom  = [c.nom, c.prenom].filter(Boolean).join(' ') || c.entreprise || '—';
    const score = info?.score ?? null;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;
        background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:var(--r-sm);
        cursor:pointer;transition:.12s" data-search="${nom.toLowerCase()}"
        onmouseenter="this.style.background='rgba(255,255,255,.04)'"
        onmouseleave="this.style.background='rgba(255,255,255,.02)'"
        onclick="selectContact(allContacts.find(x=>x.id==='${c.id}'))">
        <div style="flex:1;min-width:0">
          <div style="font-size:.84rem;font-weight:600;color:#fff">${escHtml(nom)}</div>
          ${info?.domaine ? `<div style="font-size:.72rem;color:var(--seo);font-family:var(--ff-mono)">${escHtml(info.domaine)}</div>` : ''}
        </div>
        ${score !== null ? `
          <div style="display:flex;align-items:center;gap:8px;min-width:120px">
            <div class="score-bar-wrap" style="flex:1">
              <div class="score-bar" style="width:${score}%;background:${scoreColor(score)}"></div>
            </div>
            <span style="font-family:var(--ff-mono);font-size:.76rem;font-weight:700;color:${scoreColor(score)}">${score}%</span>
          </div>` : '<span class="badge badge-gray">Non audité</span>'}
        <button class="btn btn-pri btn-sm" onclick="event.stopPropagation();selectContact(allContacts.find(x=>x.id==='${c.id}'))">
          Suivre
        </button>
      </div>`;
  }).join('') + '</div>';
}

function filterDashList(q) {
  const lq = q.toLowerCase();
  document.querySelectorAll('#dash-client-list [data-search]').forEach(el => {
    el.style.display = el.dataset.search.includes(lq) ? '' : 'none';
  });
}
