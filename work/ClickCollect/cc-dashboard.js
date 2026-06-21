/* Click & Collect — Dashboard global */

async function loadDashboard() {
  const el = document.getElementById('dashboard-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const now = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const fin   = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);

  const [
    { count: nbActifs },
    { count: nbProduits },
    { count: nbEnAttente },
    { data: monthCmds },
    { data: recentCmds },
  ] = await Promise.all([
    supa.from('cc_client_profiles').select('*', { count:'exact', head:true }).eq('actif', true),
    supa.from('cc_produits').select('*', { count:'exact', head:true }).eq('actif', true),
    supa.from('cc_commandes').select('*', { count:'exact', head:true }).in('statut', ['en_attente','confirme']),
    supa.from('cc_commandes').select('total,statut')
      .gte('created_at', debut).lte('created_at', fin+'T23:59:59Z')
      .in('statut', ['confirme','pret','retire']),
    supa.from('cc_commandes').select('*').order('created_at', { ascending:false }).limit(8),
  ]);

  const caMonth = (monthCmds || []).reduce((s, c) => s + Number(c.total || 0), 0);

  // Resolve contact names for recent orders
  const contactMap = {};
  allContacts.forEach(c => { contactMap[c.id] = [c.nom, c.prenom].filter(Boolean).join(' ') || c.entreprise || '—'; });

  el.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-val" style="color:var(--cc)">${nbActifs || 0}</div>
        <div class="stat-lbl">Clients C&C actifs</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${nbProduits || 0}</div>
        <div class="stat-lbl">Produits actifs</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--warn)">${nbEnAttente || 0}</div>
        <div class="stat-lbl">Commandes en cours</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--ok);font-size:1.4rem">${fmtEur(caMonth)}</div>
        <div class="stat-lbl">CA ce mois</div>
      </div>
    </div>

    <!-- Clients -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-header">
        <span class="card-title">— Clients</span>
        <input type="text" placeholder="Chercher…" oninput="filterDashList(this.value)"
          style="font-size:.74rem;padding:4px 8px;border-radius:6px;width:130px;
            background:rgba(0,0,0,.2);border:1px solid var(--line);color:#fff;outline:none">
      </div>
      <div id="dash-client-list">${_renderDashClients()}</div>
    </div>

    <!-- Commandes récentes -->
    ${(recentCmds || []).length ? `
    <div class="card">
      <div class="card-header"><span class="card-title">— Commandes récentes</span></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${(recentCmds || []).map(c => {
          const st = CC_STATUTS[c.statut] || { label:c.statut, cls:'st-attente' };
          const client = contactMap[c.contact_id] || '—';
          return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line2)">
            <span class="badge ${st.cls}" style="flex-shrink:0">${st.label}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:.8rem;color:#fff;font-weight:500">${escHtml(c.client_nom || '—')}</div>
              <div style="font-size:.68rem;color:var(--mut)">${escHtml(client)} · ${fmtDate(c.created_at?.slice(0,10))}</div>
            </div>
            <div style="font-family:var(--ff-mono);font-size:.8rem;color:var(--cc);font-weight:700;flex-shrink:0">${fmtEur(c.total)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}`;
}

function _renderDashClients() {
  if (!allContacts.length) return '<p style="color:var(--mut);font-size:.8rem">Aucun contact.</p>';
  return allContacts.map((c, i) => {
    const nom = [c.nom, c.prenom].filter(Boolean).join(' ') || c.entreprise || '—';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
        border-bottom:1px solid var(--line2);cursor:pointer"
        data-search="${nom.toLowerCase()}" onclick="selectContact(allContacts[${i}])">
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:600;color:#fff">${escHtml(nom)}</div>
          <div style="font-size:.7rem;color:var(--mut)">${escHtml(c.entreprise || '—')}</div>
        </div>
        <span style="color:var(--mut);font-size:.8rem">→</span>
      </div>`;
  }).join('');
}

function filterDashList(q) {
  const lq = q.toLowerCase();
  document.querySelectorAll('#dash-client-list > div[data-search]').forEach(el => {
    el.style.display = el.dataset.search.includes(lq) ? '' : 'none';
  });
}
