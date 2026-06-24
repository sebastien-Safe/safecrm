/* Click & Collect — Catalogue produits */

let _produits = [];
let _filterCateg = 'all';
let _filterActif = 'all';

async function loadCatalogue() {
  if (!currentContact) return;
  const el = document.getElementById('catalogue-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const { data } = await supa.from('cc_produits')
    .select('*')
    .eq('contact_id', currentContact.id)
    .order('nom');

  _produits = data || [];
  renderCatalogue();
}

function renderCatalogue() {
  const el = document.getElementById('catalogue-content');
  if (!el) return;

  const categories = [...new Set(_produits.map(p => p.categorie).filter(Boolean))];

  let filtered = _produits;
  if (_filterCateg !== 'all') filtered = filtered.filter(p => p.categorie === _filterCateg);
  if (_filterActif === 'actif')   filtered = filtered.filter(p => p.actif);
  if (_filterActif === 'inactif') filtered = filtered.filter(p => !p.actif);

  el.innerHTML = `
    <div class="list-header">
      <div>
        <div class="filter-row">
          <button class="filter-btn${_filterActif==='all'?' active':''}" onclick="setFilterActif('all',this)">Tous (${_produits.length})</button>
          <button class="filter-btn${_filterActif==='actif'?' active':''}" onclick="setFilterActif('actif',this)">Actifs (${_produits.filter(p=>p.actif).length})</button>
          <button class="filter-btn${_filterActif==='inactif'?' active':''}" onclick="setFilterActif('inactif',this)">Inactifs (${_produits.filter(p=>!p.actif).length})</button>
          ${categories.map(c => `<button class="filter-btn${_filterCateg===c?' active':''}" onclick="setFilterCateg('${escHtml(c)}',this)">${escHtml(c)}</button>`).join('')}
          ${_filterCateg !== 'all' ? `<button class="filter-btn" onclick="setFilterCateg('all',this)">✕ Catégories</button>` : ''}
        </div>
      </div>
      <button class="btn btn-pri btn-sm" onclick="openProduitModal()">+ Nouveau produit</button>
    </div>

    ${filtered.length === 0
      ? `<div class="empty-state">
           <div class="ico">🛍</div>
           <p>${_produits.length ? 'Aucun produit pour ce filtre.' : 'Aucun produit dans le catalogue.'}</p>
           <button class="btn btn-pri btn-sm" onclick="openProduitModal()" style="margin-top:10px">Ajouter le premier produit</button>
         </div>`
      : `<div class="produits-grid">${filtered.map(_renderProduitCard).join('')}</div>`}`;
}

function _renderProduitCard(p) {
  const stockCls = p.stock_illimite ? 'stock-ok' : p.stock > 5 ? 'stock-ok' : p.stock > 0 ? 'stock-low' : 'stock-zero';
  const stockLbl = p.stock_illimite ? '∞ Illimité' : p.stock > 0 ? `${p.stock} en stock` : 'Rupture';
  return `
    <div class="produit-card${p.actif ? '' : ' inactif'}">
      <div class="produit-actions">
        <button class="btn btn-ghost btn-sm" style="padding:4px 8px" onclick="openProduitModal('${p.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" style="padding:4px 8px" onclick="toggleActif('${p.id}',${!p.actif})">${p.actif ? '⏸' : '▶'}</button>
        <button class="btn btn-ghost btn-sm" style="padding:4px 8px" onclick="deleteProduit('${p.id}')">🗑</button>
      </div>
      <div class="produit-img">
        ${p.image_url
          ? `<img src="${escHtml(p.image_url)}" alt="${escHtml(p.nom)}" onerror="this.parentElement.innerHTML='🛍'">`
          : '🛍'}
      </div>
      <div class="produit-body">
        <div class="produit-nom" title="${escHtml(p.nom)}">${escHtml(p.nom)}</div>
        ${p.categorie ? `<div class="produit-categ">${escHtml(p.categorie)}</div>` : ''}
        <div class="produit-footer">
          <span class="price-tag">${fmtEur(p.prix)}</span>
          <span class="stock-badge ${stockCls}">${stockLbl}</span>
        </div>
        ${!p.actif ? `<div style="font-size:.62rem;color:var(--alert);margin-top:4px">Désactivé</div>` : ''}
      </div>
    </div>`;
}

function setFilterActif(val, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _filterActif = val;
  renderCatalogue();
}
function setFilterCateg(val, btn) {
  _filterCateg = val;
  renderCatalogue();
}

function openProduitModal(id = null) {
  const p = _produits.find(x => x.id === id) || null;
  openModal(p ? 'Modifier le produit' : 'Nouveau produit', `
    <div class="field"><label>Nom du produit *</label>
      <input id="pp-nom" type="text" placeholder="Ex: Bouquet de saison" value="${escHtml(p?.nom||'')}"></div>
    <div class="field"><label>Description</label>
      <textarea id="pp-desc" rows="3" placeholder="Description courte…">${escHtml(p?.description||'')}</textarea></div>
    <div class="grid-2">
      <div class="field"><label>Prix (€)</label>
        <input id="pp-prix" type="number" min="0" step="0.01" value="${p?.prix ?? ''}"></div>
      <div class="field"><label>Catégorie</label>
        <input id="pp-categ" type="text" placeholder="Ex: Fleurs, Épicerie…" value="${escHtml(p?.categorie||'')}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Stock</label>
        <input id="pp-stock" type="number" min="0" value="${p?.stock ?? 0}" ${p?.stock_illimite ? 'disabled' : ''}></div>
      <div class="field" style="justify-content:flex-end;padding-top:20px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex-direction:row">
          <input id="pp-illimite" type="checkbox" ${p?.stock_illimite ? 'checked' : ''}
            onchange="document.getElementById('pp-stock').disabled=this.checked">
          Stock illimité
        </label>
      </div>
    </div>
    <div class="field"><label>Image (URL)</label>
      <input id="pp-image" type="url" placeholder="https://…" value="${escHtml(p?.image_url||'')}"></div>
    <div class="field" style="flex-direction:row;align-items:center;gap:8px">
      <input id="pp-actif" type="checkbox" ${p?.actif !== false ? 'checked' : ''}>
      <label for="pp-actif" style="cursor:pointer;font-size:.8rem;color:var(--mut-2)">Produit actif (visible aux commandes)</label>
    </div>`,
  `<button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
   <button class="btn btn-pri" onclick="saveProduit('${id||''}')">Enregistrer</button>`);
}

async function saveProduit(id) {
  const nom = document.getElementById('pp-nom')?.value.trim();
  if (!nom) { toast('Le nom est obligatoire', true); return; }

  const payload = {
    contact_id:     currentContact.id,
    nom,
    description:    document.getElementById('pp-desc')?.value.trim() || null,
    prix:           parseFloat(document.getElementById('pp-prix')?.value || '0') || 0,
    categorie:      document.getElementById('pp-categ')?.value.trim() || null,
    stock:          parseInt(document.getElementById('pp-stock')?.value || '0') || 0,
    stock_illimite: document.getElementById('pp-illimite')?.checked || false,
    image_url:      document.getElementById('pp-image')?.value.trim() || null,
    actif:          document.getElementById('pp-actif')?.checked ?? true,
    updated_at:     new Date().toISOString(),
  };

  let err;
  if (!id) {
    ({ error: err } = await supa.from('cc_produits').insert({ ...payload, created_at: new Date().toISOString() }));
  } else {
    ({ error: err } = await supa.from('cc_produits').update(payload).eq('id', id));
  }
  if (err) { toast('Erreur : ' + err.message, true); return; }
  toast(id ? 'Produit mis à jour ✓' : 'Produit ajouté ✓');
  closeModal();
  await loadCatalogue();
}

async function toggleActif(id, actif) {
  const { error } = await supa.from('cc_produits').update({ actif, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { toast('Erreur', true); return; }
  toast(actif ? 'Produit activé' : 'Produit désactivé');
  await loadCatalogue();
}

async function deleteProduit(id) {
  if (!confirm('Supprimer ce produit définitivement ?')) return;
  const { error } = await supa.from('cc_produits').delete().eq('id', id);
  if (error) { toast('Erreur', true); return; }
  toast('Produit supprimé');
  await loadCatalogue();
}
