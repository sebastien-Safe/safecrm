/* Click & Collect — Gestion des commandes */

let _commandes  = [];
let _filterStat = 'all';

async function loadCommandes() {
  if (!currentContact) return;
  const el = document.getElementById('commandes-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const { data } = await supa.from('cc_commandes')
    .select('*')
    .eq('contact_id', currentContact.id)
    .order('created_at', { ascending: false });

  _commandes = data || [];
  renderCommandes();
}

function renderCommandes() {
  const el = document.getElementById('commandes-content');
  if (!el) return;

  const counts = {};
  Object.keys(CC_STATUTS).forEach(k => { counts[k] = _commandes.filter(c => c.statut === k).length; });
  const filtered = _filterStat === 'all' ? _commandes : _commandes.filter(c => c.statut === _filterStat);

  el.innerHTML = `
    <div class="list-header">
      <div class="filter-row">
        <button class="filter-btn${_filterStat==='all'?' active':''}" onclick="setFilterStat('all',this)">Toutes (${_commandes.length})</button>
        ${Object.entries(CC_STATUTS).map(([k,s]) =>
          `<button class="filter-btn${_filterStat===k?' active':''}" onclick="setFilterStat('${k}',this)">
            <span class="badge ${s.cls}" style="font-size:.58rem">${s.label}</span> (${counts[k]||0})
          </button>`).join('')}
      </div>
      <button class="btn btn-pri btn-sm" onclick="openCommandeModal()">+ Nouvelle commande</button>
    </div>

    ${filtered.length === 0
      ? `<div class="empty-state">
           <div class="ico">📦</div>
           <p>${_commandes.length ? 'Aucune commande pour ce filtre.' : 'Aucune commande enregistrée.'}</p>
           <button class="btn btn-pri btn-sm" onclick="openCommandeModal()" style="margin-top:10px">Créer la première commande</button>
         </div>`
      : `<div class="cmd-list">${filtered.map(_renderCmdRow).join('')}</div>`}`;
}

function _renderCmdRow(c) {
  const st = CC_STATUTS[c.statut] || { label:c.statut, cls:'st-attente', next:null };
  const items = Array.isArray(c.produits) ? c.produits : (typeof c.produits === 'string' ? JSON.parse(c.produits) : []);
  const resume = items.slice(0,2).map(i => escHtml(i.nom || '?')).join(', ') + (items.length > 2 ? `…` : '');
  return `
    <div class="cmd-row" onclick="openCommandeDetail('${c.id}')">
      <div>
        <div class="cmd-ref">${escHtml(c.reference || c.id.slice(0,8).toUpperCase())}</div>
        <div style="font-size:.65rem;color:var(--mut);margin-top:2px">${fmtDate(c.created_at?.slice(0,10))}</div>
      </div>
      <div class="cmd-body">
        <div class="cmd-client">${escHtml(c.client_nom || '—')}</div>
        <div class="cmd-meta">
          ${c.client_email ? `<span>${escHtml(c.client_email)}</span>` : ''}
          ${c.date_souhaitee ? `<span>📅 ${fmtDate(c.date_souhaitee)}</span>` : ''}
          ${resume ? `<span style="color:var(--mut-2)">${resume}</span>` : ''}
        </div>
      </div>
      <div class="cmd-total">${fmtEur(c.total)}</div>
      <div class="cmd-actions" onclick="event.stopPropagation()">
        <span class="badge ${st.cls}">${st.label}</span>
        ${st.next ? `<button class="btn btn-ok btn-sm" onclick="avancerStatut('${c.id}','${st.next}')">→ ${CC_STATUTS[st.next]?.label}</button>` : ''}
        ${c.statut !== 'annule' && c.statut !== 'retire'
          ? `<button class="btn btn-danger btn-sm" onclick="annulerCommande('${c.id}')">Annuler</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="openCommandeModal('${c.id}')">✏️</button>
      </div>
    </div>`;
}

function setFilterStat(val, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _filterStat = val;
  renderCommandes();
}

function openCommandeDetail(id) {
  const c = _commandes.find(x => x.id === id);
  if (!c) return;
  const st  = CC_STATUTS[c.statut] || { label:c.statut, cls:'st-attente' };
  const items = Array.isArray(c.produits) ? c.produits : (typeof c.produits === 'string' ? JSON.parse(c.produits) : []);

  openModal(`Commande ${c.reference || c.id.slice(0,8).toUpperCase()}`, `
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <span class="badge ${st.cls}" style="font-size:.75rem">${st.label}</span>
      <span style="font-family:var(--ff-mono);font-size:.72rem;color:var(--mut)">Créée le ${fmtDate(c.created_at?.slice(0,10))}</span>
    </div>
    <div class="grid-2" style="margin-bottom:12px">
      <div><div style="font-size:.7rem;color:var(--mut);font-family:var(--ff-mono)">CLIENT</div>
        <div style="font-size:.85rem;color:#fff;font-weight:600">${escHtml(c.client_nom||'—')}</div>
        <div style="font-size:.75rem;color:var(--mut)">${escHtml(c.client_email||'')}</div>
        <div style="font-size:.75rem;color:var(--mut)">${escHtml(c.client_tel||'')}</div>
      </div>
      <div><div style="font-size:.7rem;color:var(--mut);font-family:var(--ff-mono)">RETRAIT SOUHAITÉ</div>
        <div style="font-size:.85rem;color:#fff">${fmtDate(c.date_souhaitee)}</div>
      </div>
    </div>
    <div style="background:rgba(0,0,0,.2);border-radius:8px;padding:10px 12px;margin-bottom:12px">
      <div style="font-size:.7rem;color:var(--mut);font-family:var(--ff-mono);margin-bottom:8px">PRODUITS</div>
      ${items.map(i => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line2);font-size:.82rem">
          <span style="color:var(--mut-2)">${escHtml(i.nom||'?')} × ${i.qte||1}</span>
          <span style="color:#fff;font-family:var(--ff-mono)">${fmtEur((i.prix||0)*(i.qte||1))}</span>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding-top:8px;font-weight:700;color:#fff">
        <span>Total</span>
        <span style="color:var(--cc);font-family:var(--ff-disp);font-size:1rem">${fmtEur(c.total)}</span>
      </div>
    </div>
    ${c.notes ? `<div style="font-size:.78rem;color:var(--mut);padding:8px 10px;background:rgba(255,255,255,.03);border-radius:6px">${escHtml(c.notes)}</div>` : ''}`,
  `<button class="btn btn-ghost" onclick="closeModal()">Fermer</button>
   <button class="btn btn-pri" onclick="closeModal();openCommandeModal('${c.id}')">✏️ Modifier</button>`);
}

async function openCommandeModal(id = null) {
  const c = _commandes.find(x => x.id === id) || null;
  const { data: prods } = await supa.from('cc_produits')
    .select('id,nom,prix').eq('contact_id', currentContact.id).eq('actif', true).order('nom');
  const actifProds = prods || [];

  let orderItems = [];
  if (c?.produits) {
    const raw = Array.isArray(c.produits) ? c.produits : JSON.parse(c.produits);
    orderItems = raw.map(i => ({ id: i.produit_id || '', nom: i.nom, prix: i.prix||0, qte: i.qte||1 }));
  }

  const prodOpts = actifProds.map(p => `<option value="${p.id}" data-prix="${p.prix}" data-nom="${escHtml(p.nom)}">${escHtml(p.nom)} — ${fmtEur(p.prix)}</option>`).join('');

  openModal(c ? 'Modifier la commande' : 'Nouvelle commande', `
    <div class="grid-2">
      <div class="field"><label>Nom client *</label><input id="cm-nom" value="${escHtml(c?.client_nom||'')}"></div>
      <div class="field"><label>Téléphone</label><input id="cm-tel" value="${escHtml(c?.client_tel||'')}"></div>
    </div>
    <div class="field"><label>Email client</label><input id="cm-email" type="email" value="${escHtml(c?.client_email||'')}"></div>
    <div class="field"><label>Date de retrait souhaitée</label><input id="cm-date" type="date" value="${c?.date_souhaitee||today()}"></div>

    <div style="font-family:var(--ff-mono);font-size:.7rem;color:var(--mut);text-transform:uppercase;margin-bottom:6px">Produits</div>
    <div id="cm-items">${orderItems.map((item, i) => _renderOrderItemRow(item, i, prodOpts)).join('')}</div>
    <button class="btn btn-ghost btn-sm" onclick="addOrderItem(${JSON.stringify(actifProds).replace(/"/g,'&quot;')})" style="margin-top:4px">+ Ajouter un produit</button>

    <div style="display:flex;justify-content:flex-end;margin-top:12px;font-family:var(--ff-disp);font-size:1.1rem;font-weight:800;color:var(--cc)" id="cm-total">
      Total : ${fmtEur(c?.total||0)}
    </div>
    <div class="field" style="margin-top:10px"><label>Statut</label>
      <select id="cm-statut">
        ${Object.entries(CC_STATUTS).map(([k,s]) => `<option value="${k}"${(c?.statut||'en_attente')===k?' selected':''}>${s.label}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Notes</label><textarea id="cm-notes" rows="2">${escHtml(c?.notes||'')}</textarea></div>`,
  `<button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
   <button class="btn btn-pri" onclick="saveCommande('${id||''}',${JSON.stringify(actifProds).replace(/"/g,'&quot;')})">Enregistrer</button>`);

  window._ccProds = actifProds;
  window._ccItems = [...orderItems];
  _updateCmTotal();
}

function _renderOrderItemRow(item, idx, prodOpts) {
  return `<div class="order-item-row" id="cm-item-${idx}">
    <select onchange="updateOrderItem(${idx},this)" style="flex:1">
      <option value="">— Choisir —</option>
      ${(window._ccProds||[]).map(p =>
        `<option value="${p.id}" data-prix="${p.prix}" data-nom="${escHtml(p.nom)}" ${item.id===p.id?'selected':''}>${escHtml(p.nom)} — ${fmtEur(p.prix)}</option>`).join('')}
    </select>
    <input type="number" min="1" value="${item.qte||1}" style="width:60px" onchange="updateOrderItemQte(${idx},this)">
    <button class="btn btn-ghost btn-sm" onclick="removeOrderItem(${idx})" style="padding:4px 7px;flex-shrink:0">✕</button>
  </div>`;
}

function addOrderItem(prods) {
  if (prods) window._ccProds = prods;
  if (!window._ccItems) window._ccItems = [];
  window._ccItems.push({ id:'', nom:'', prix:0, qte:1 });
  const idx = window._ccItems.length - 1;
  const container = document.getElementById('cm-items');
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = _renderOrderItemRow(window._ccItems[idx], idx, '');
  container.appendChild(div.firstElementChild);
}

function updateOrderItem(idx, sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!window._ccItems) return;
  window._ccItems[idx] = { id: opt.value, nom: opt.dataset.nom||'', prix: parseFloat(opt.dataset.prix||0), qte: window._ccItems[idx]?.qte||1 };
  _updateCmTotal();
}

function updateOrderItemQte(idx, input) {
  if (!window._ccItems || !window._ccItems[idx]) return;
  window._ccItems[idx].qte = parseInt(input.value) || 1;
  _updateCmTotal();
}

function removeOrderItem(idx) {
  if (!window._ccItems) return;
  window._ccItems.splice(idx, 1);
  // Re-render all items
  const container = document.getElementById('cm-items');
  if (!container) return;
  container.innerHTML = window._ccItems.map((item, i) => _renderOrderItemRow(item, i, '')).join('');
  _updateCmTotal();
}

function _updateCmTotal() {
  const items = window._ccItems || [];
  const total = items.reduce((s, i) => s + (i.prix * (i.qte || 1)), 0);
  const el = document.getElementById('cm-total');
  if (el) el.textContent = `Total : ${fmtEur(total)}`;
}

async function saveCommande(id, prods) {
  if (prods) window._ccProds = prods;
  const nom = document.getElementById('cm-nom')?.value.trim();
  if (!nom) { toast('Le nom client est obligatoire', true); return; }

  const items = (window._ccItems || []).filter(i => i.id || i.nom);
  const total  = items.reduce((s, i) => s + (i.prix * (i.qte || 1)), 0);

  const payload = {
    contact_id:    currentContact.id,
    client_nom:    nom,
    client_email:  document.getElementById('cm-email')?.value.trim() || null,
    client_tel:    document.getElementById('cm-tel')?.value.trim() || null,
    date_souhaitee:document.getElementById('cm-date')?.value || null,
    statut:        document.getElementById('cm-statut')?.value || 'en_attente',
    produits:      JSON.stringify(items.map(i => ({ produit_id:i.id, nom:i.nom, prix:i.prix, qte:i.qte||1 }))),
    total,
    notes:         document.getElementById('cm-notes')?.value.trim() || null,
    updated_at:    new Date().toISOString(),
  };

  let err;
  if (!id) {
    payload.reference  = genRef();
    payload.created_at = new Date().toISOString();
    ({ error: err } = await supa.from('cc_commandes').insert(payload));
  } else {
    ({ error: err } = await supa.from('cc_commandes').update(payload).eq('id', id));
  }
  if (err) { toast('Erreur : ' + err.message, true); return; }
  toast(id ? 'Commande mise à jour ✓' : 'Commande créée ✓');
  closeModal();
  await loadCommandes();
}

async function avancerStatut(id, statut) {
  const { error } = await supa.from('cc_commandes').update({ statut, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { toast('Erreur', true); return; }
  toast(`Statut → ${CC_STATUTS[statut]?.label} ✓`);
  await loadCommandes();
}

async function annulerCommande(id) {
  if (!confirm('Annuler cette commande ?')) return;
  await avancerStatut(id, 'annule');
}
