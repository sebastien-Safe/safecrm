/* ============================================================
   DPO Clients — Dashboard : vue d'ensemble + liste clients
   ============================================================ */

async function loadDashboard() {
  const el = document.getElementById('dashboard-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const [
    { data: profiles },
    { data: demandes },
    { data: violations },
    { count: nbConsent },
  ] = await Promise.all([
    supa.from('dpo_client_profiles').select('*'),
    supa.from('dpo_client_demandes').select('id,statut').neq('statut', 'Traitée'),
    supa.from('dpo_client_violations').select('id,statut').eq('statut', 'ouvert'),
    supa.from('dpo_client_consentements').select('*', { count: 'exact', head: true }).eq('statut', 'actif'),
  ]);

  const scores  = (profiles || []).map(p => p.score_global || 0);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const nbOk    = scores.filter(s => s >= 80).length;
  const nbWarn  = scores.filter(s => s >= 50 && s < 80).length;
  const nbAlert = scores.filter(s => s < 50).length;

  el.innerHTML = `
    <div class="stats-row" style="grid-template-columns:repeat(5,1fr)">
      <div class="stat-card">
        <div class="stat-val">${allContacts.length}</div>
        <div class="stat-lbl">Clients suivis</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:${scoreColor(avgScore)}">${avgScore}%</div>
        <div class="stat-lbl">Score moyen RGPD</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--ok)">${nbConsent || 0}</div>
        <div class="stat-lbl">Consentements actifs</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--warn)">${(demandes || []).length}</div>
        <div class="stat-lbl">Demandes en cours</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:var(--alert)">${(violations || []).length}</div>
        <div class="stat-lbl">Violations ouvertes</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <span class="card-title">— Conformité globale</span>
        </div>
        <div style="display:flex;gap:20px;align-items:center;margin-bottom:14px">
          <div style="text-align:center">
            <div style="font-family:var(--ff-disp);font-size:2.4rem;font-weight:800;color:${scoreColor(avgScore)}">${avgScore}%</div>
            <div style="font-size:.73rem;color:var(--mut)">Score moyen</div>
          </div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:4px">
              <span style="color:var(--ok)">🟢 Conformes</span><span style="color:var(--ok);font-weight:700">${nbOk}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:4px">
              <span style="color:var(--warn)">🟡 À surveiller</span><span style="color:var(--warn);font-weight:700">${nbWarn}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.75rem">
              <span style="color:var(--alert)">🔴 Action requise</span><span style="color:var(--alert);font-weight:700">${nbAlert}</span>
            </div>
          </div>
        </div>
        <button class="btn btn-pri btn-sm" onclick="showView('clients');loadClientsList()">
          👥 Voir tous les clients →
        </button>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">— Accès rapide</span></div>
        <div style="display:flex;flex-direction:column;gap:7px">
          <button class="btn btn-ghost" style="justify-content:flex-start" onclick="showView('clients');loadClientsList()">
            👥 Sélectionner un client
          </button>
          <div style="border-top:1px solid var(--line);padding-top:8px;margin-top:2px;
            font-size:.72rem;color:var(--mut);font-family:var(--ff-mono)">
            RÈGLE DE SÉCURITÉ
          </div>
          <div style="background:var(--alert-bg);border:1px solid var(--alert-bd);border-radius:var(--r-sm);
            padding:10px 12px;font-size:.78rem;color:var(--alert)">
            🔒 Aucun service externe connecté.<br>
            Toute connexion requiert une validation explicite de l'administrateur.
          </div>
        </div>
      </div>
    </div>`;
}

/* ── Liste clients ── */
async function loadClientsList() {
  const el = document.getElementById('clients-content');
  if (!el) return;

  const { data: profiles } = await supa.from('dpo_client_profiles').select('contact_id,score_global');
  const scoreMap = {};
  (profiles || []).forEach(p => { scoreMap[p.contact_id] = p.score_global || 0; });

  const search = document.getElementById('clients-search')?.value?.toLowerCase() || '';
  const filtered = allContacts.filter(c => {
    if (!search) return true;
    return (c.nom + c.entreprise + c.email).toLowerCase().includes(search);
  });

  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><div class="ico">👥</div><p>Aucun contact trouvé.</p></div>';
    return;
  }

  el.innerHTML = '<div class="item-list">' + filtered.map(c => {
    const score = scoreMap[c.id] ?? null;
    const scorePart = score !== null
      ? `<div style="min-width:80px">
          <div class="score-bar-wrap" style="margin-bottom:3px">
            <div class="score-bar" style="width:${score}%;background:${scoreColor(score)}"></div>
          </div>
          <div style="font-size:.68rem;color:${scoreColor(score)};font-family:var(--ff-mono);text-align:right">${score}%</div>
        </div>`
      : `<span class="badge badge-gray" style="font-size:.65rem">non évalué</span>`;

    return `
      <div class="item-row" onclick="selectContact(${JSON.stringify(c).replace(/"/g,'&quot;')})">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(59,130,246,.15);
          border:1px solid rgba(59,130,246,.3);display:flex;align-items:center;justify-content:center;
          font-size:1rem;flex-shrink:0">👤</div>
        <div class="item-row-info">
          <div class="item-row-name">${escHtml(c.nom)}${c.prenom ? ' ' + escHtml(c.prenom) : ''}</div>
          <div class="item-row-meta">${escHtml(c.entreprise || '—')} · ${escHtml(c.email || '—')}</div>
        </div>
        ${scorePart}
        <span class="badge badge-gray">${escHtml(c.statut || '—')}</span>
        <span style="color:var(--mut);font-size:.8rem">→</span>
      </div>`;
  }).join('') + '</div>';
}
