/* ============================================================
   SEO Clients — Suivi des mots-clés et positions
   ============================================================ */

async function loadMotsCles() {
  if (!currentContact) return;
  const el = document.getElementById('mots-cles-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  let q = supa.from('seo_client_mots_cles').select('*').eq('contact_id', currentContact.id);
  if (currentDomaine) {
    q = q.or(`domaine_id.eq.${currentDomaine.id},domaine_id.is.null`);
  }
  const { data: mcs } = await q.order('position_actuelle', { ascending: true, nullsFirst: false });

  const list = mcs || [];
  const top3  = list.filter(m => m.position_actuelle && m.position_actuelle <= 3).length;
  const top10 = list.filter(m => m.position_actuelle && m.position_actuelle <= 10).length;
  const gains = list.filter(m => m.position_actuelle && m.position_precedente && m.position_precedente > m.position_actuelle).length;

  const domLabel = currentDomaine
    ? `<span style="color:var(--seo);font-family:var(--ff-mono);font-size:.9rem;font-weight:700">${escHtml(currentDomaine.domaine)}</span>`
    : '<span style="color:var(--mut);font-size:.82rem">Aucun domaine sélectionné</span>';

  el.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:.7rem;color:var(--mut);font-family:var(--ff-mono);margin-bottom:3px">Domaine suivi</div>
          ${domLabel}
        </div>
        <div style="display:flex;gap:16px;text-align:center">
          <div><div style="font-family:var(--ff-disp);font-size:1.4rem;font-weight:800;color:#fbbf24">${top3}</div><div style="font-size:.72rem;color:var(--mut)">Top 3</div></div>
          <div><div style="font-family:var(--ff-disp);font-size:1.4rem;font-weight:800;color:var(--ok)">${top10}</div><div style="font-size:.72rem;color:var(--mut)">Top 10</div></div>
          <div><div style="font-family:var(--ff-disp);font-size:1.4rem;font-weight:800;color:var(--seo)">${list.length}</div><div style="font-size:.72rem;color:var(--mut)">Suivis</div></div>
          <div><div style="font-family:var(--ff-disp);font-size:1.4rem;font-weight:800;color:var(--ok)">↑${gains}</div><div style="font-size:.72rem;color:var(--mut)">Gains</div></div>
        </div>
        <button class="btn btn-pri btn-sm" onclick="openMCModal()">+ Mot-clé</button>
      </div>
    </div>

    ${_renderGscBanner()}

    ${list.length ? `
      <div class="card">
        <div class="card-header">
          <span class="card-title">— Mots-clés (${list.length})</span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="filterMC('all',this)">Tous</button>
            <button class="btn btn-ghost btn-sm" onclick="filterMC('principal',this)">Principaux</button>
            <button class="btn btn-ghost btn-sm" onclick="filterMC('top10',this)">Top 10</button>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table class="mc-table" id="mc-table">
            <thead>
              <tr>
                <th>Mot-clé</th>
                <th>Type</th>
                <th style="text-align:center">Position</th>
                <th style="text-align:center">Évolution</th>
                <th>Volume</th>
                <th>URL cible</th>
                <th>Màj</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(m => renderMCRow(m)).join('')}
            </tbody>
          </table>
        </div>
      </div>` : `
      <div class="card">
        <div class="card-header"><span class="card-title">— Mots-clés</span><button class="btn btn-pri btn-sm" onclick="openMCModal()">+ Ajouter</button></div>
        <div class="empty-state"><div class="ico">🔍</div>
          <p>${currentDomaine ? 'Aucun mot-clé pour ce domaine.' : 'Ajoutez d\'abord un domaine via les pills ci-dessus.'}</p>
        </div>
      </div>`}`;
}

function renderMCRow(m) {
  const pos = m.position_actuelle;
  const posCls = !pos ? 'pos-low' : pos <= 3 ? 'pos-1-3' : pos <= 10 ? 'pos-4-10' : pos <= 20 ? 'pos-11-20' : 'pos-low';
  const typeCls = { principal:'type-principal', secondaire:'type-secondaire', longue_queue:'type-longue_queue' }[m.type_mc] || 'type-principal';
  const typeLabel = { principal:'Principal', secondaire:'Secondaire', longue_queue:'Longue queue' }[m.type_mc] || m.type_mc;
  return `
    <tr data-type="${m.type_mc}" data-pos="${pos || 999}" onclick="openMCModal('${m.id}')">
      <td style="font-weight:600;color:#fff;max-width:200px">${escHtml(m.mot_cle)}</td>
      <td><span class="type-badge ${typeCls}">${typeLabel}</span></td>
      <td style="text-align:center">
        <span class="pos-val ${posCls}">${pos || '—'}</span>
      </td>
      <td style="text-align:center">${positionEvolution(m.position_actuelle, m.position_precedente)}</td>
      <td style="font-family:var(--ff-mono);font-size:.78rem;color:var(--mut)">${m.volume_recherche ? m.volume_recherche.toLocaleString('fr-FR') + '/m' : '—'}</td>
      <td style="font-size:.76rem;color:var(--mut);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(m.url_cible || '—')}</td>
      <td style="font-family:var(--ff-mono);font-size:.72rem;color:var(--mut)">${fmtDate(m.date_maj)}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" style="padding:3px 8px" onclick="deleteMC('${m.id}')">🗑</button>
      </td>
    </tr>`;
}

function filterMC(type, btn) {
  document.querySelectorAll('#mc-table tbody tr').forEach(tr => {
    if (type === 'all') tr.style.display = '';
    else if (type === 'top10') tr.style.display = parseInt(tr.dataset.pos) <= 10 ? '' : 'none';
    else tr.style.display = tr.dataset.type === type ? '' : 'none';
  });
}

function openMCModal(id = null) {
  // Sélecteur de domaine dans le formulaire
  const domSel = _allDomaines.length > 1 ? `
    <div class="form-group">
      <label class="form-label">Domaine</label>
      <select class="form-select" id="mc-dom">
        ${_allDomaines.map(d => `<option value="${d.id}"${currentDomaine?.id===d.id?' selected':''}>${escHtml(d.label||d.domaine)}</option>`).join('')}
      </select>
    </div>` : '';

  const form = `
    ${domSel}
    <div class="form-group">
      <label class="form-label">Mot-clé *</label>
      <input class="form-input" id="mc-kw" placeholder="Ex : agence seo bordeaux">
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="mc-type">
          <option value="principal">Principal</option>
          <option value="secondaire">Secondaire</option>
          <option value="longue_queue">Longue queue</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Volume mensuel (est.)</label>
        <input class="form-input" id="mc-vol" type="number" min="0" placeholder="Ex : 320">
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Position actuelle</label>
        <input class="form-input" id="mc-pos" type="number" min="1" max="200" placeholder="Ex : 8">
      </div>
      <div class="form-group">
        <label class="form-label">Position précédente</label>
        <input class="form-input" id="mc-prev" type="number" min="1" max="200" placeholder="Ex : 14">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">URL cible</label>
      <input class="form-input" id="mc-url" placeholder="https://…/page-cible">
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <input class="form-input" id="mc-notes" placeholder="Observations, contexte…">
    </div>`;

  openModal(id ? 'Modifier le mot-clé' : 'Nouveau mot-clé', form, `
    ${id ? `<button class="btn btn-danger btn-sm" style="margin-right:auto" onclick="deleteMC('${id}')">Supprimer</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-pri" onclick="saveMC(${id ? `'${id}'` : 'null'})">Enregistrer</button>`);

  if (id) {
    supa.from('seo_client_mots_cles').select('*').eq('id', id).single().then(({ data: m }) => {
      if (!m) return;
      document.getElementById('mc-kw').value    = m.mot_cle             || '';
      document.getElementById('mc-type').value  = m.type_mc             || 'principal';
      document.getElementById('mc-vol').value   = m.volume_recherche    || '';
      document.getElementById('mc-pos').value   = m.position_actuelle   || '';
      document.getElementById('mc-prev').value  = m.position_precedente || '';
      document.getElementById('mc-url').value   = m.url_cible           || '';
      document.getElementById('mc-notes').value = m.notes               || '';
      const domSel = document.getElementById('mc-dom');
      if (domSel && m.domaine_id) domSel.value = m.domaine_id;
    });
  }
}

async function saveMC(id) {
  const kw = document.getElementById('mc-kw').value.trim();
  if (!kw) { toast('Mot-clé requis', 'err'); return; }
  const { data: { user } } = await supa.auth.getUser();
  const domSel = document.getElementById('mc-dom');
  const domaineId = domSel ? domSel.value : (currentDomaine?.id || null);
  const payload = {
    contact_id:          currentContact.id,
    domaine_id:          domaineId || null,
    mot_cle:             kw,
    type_mc:             document.getElementById('mc-type').value,
    volume_recherche:    parseInt(document.getElementById('mc-vol').value)  || null,
    position_actuelle:   parseInt(document.getElementById('mc-pos').value)  || null,
    position_precedente: parseInt(document.getElementById('mc-prev').value) || null,
    url_cible:           document.getElementById('mc-url').value.trim()    || null,
    notes:               document.getElementById('mc-notes').value.trim()   || null,
    date_maj:            today(),
    updated_at:          new Date().toISOString(),
  };
  let err;
  if (id) {
    ({ error: err } = await supa.from('seo_client_mots_cles').update(payload).eq('id', id));
  } else {
    ({ error: err } = await supa.from('seo_client_mots_cles').insert({ ...payload, created_by: user?.id }));
  }
  if (err) { toast('Erreur : ' + err.message, 'err'); return; }
  closeModal(); toast(id ? 'Mot-clé mis à jour' : 'Mot-clé ajouté', 'ok'); loadMotsCles();
}

async function deleteMC(id) {
  if (!confirm('Supprimer ce mot-clé ?')) return;
  const { error } = await supa.from('seo_client_mots_cles').delete().eq('id', id);
  if (error) { toast('Erreur', 'err'); return; }
  closeModal(); toast('Mot-clé supprimé'); loadMotsCles();
}

/* ============================================================
   GOOGLE SEARCH CONSOLE — connexion OAuth + synchronisation
   ============================================================ */
function _renderGscBanner() {
  if (!currentDomaine) return '';
  if (currentDomaine.gsc_connected) {
    return `
      <div style="background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.15);
        border-radius:var(--r-sm);padding:9px 14px;margin-bottom:14px;font-size:.77rem;color:var(--mut-2);
        display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;font-family:var(--ff-mono)">
        <span>✅ Search Console connecté pour ce domaine.</span>
        <button class="btn btn-ghost btn-sm" id="gsc-sync-btn" onclick="syncGscPositions()">🔄 Synchroniser les positions</button>
      </div>`;
  }
  return `
    <div style="background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.15);
      border-radius:var(--r-sm);padding:9px 14px;margin-bottom:14px;font-size:.77rem;color:var(--mut-2);
      display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;font-family:var(--ff-mono)">
      <span>🔍 Positions saisies manuellement.</span>
      <button class="btn btn-ghost btn-sm" id="gsc-connect-btn" onclick="connectGsc()">🔌 Connecter Search Console</button>
    </div>`;
}

async function connectGsc() {
  if (!currentDomaine) { toast('Sélectionnez un domaine', 'err'); return; }
  const btn = document.getElementById('gsc-connect-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirection…'; }

  const { data: { session } } = await supa.auth.getSession();
  if (!session) { toast('Session expirée', 'err'); return; }

  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/gsc-oauth-start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ domaine_id: currentDomaine.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    window.location.href = data.url;
  } catch (e) {
    toast('Erreur : ' + e.message, 'err');
    if (btn) { btn.disabled = false; btn.textContent = '🔌 Connecter Search Console'; }
  }
}

async function syncGscPositions() {
  if (!currentDomaine) return;
  const btn = document.getElementById('gsc-sync-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Synchronisation…'; }

  const { data: { session } } = await supa.auth.getSession();
  if (!session) { toast('Session expirée', 'err'); return; }

  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/gsc-positions-sync`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ domaine_id: currentDomaine.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    toast(`Synchronisé : ${data.updated} mot(s)-clé(s) mis à jour ✅`);
    loadMotsCles();
  } catch (e) {
    toast('Erreur : ' + e.message, 'err');
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Synchroniser les positions'; }
  }
}
