/* ═══════════════════════════════════════════
   PIPELINE KANBAN — S@FE CRM  (Itération 1)
   ═══════════════════════════════════════════ */

const PIPELINE_COLS = [
  { id:'prospect',     label:'Prospect',     color:'#475569', icon:'👁' },
  { id:'devis_envoye', label:'Devis envoyé', color:'#3b82f6', icon:'📋' },
  { id:'signe',        label:'Signé',         color:'#8b5cf6', icon:'✍️' },
  { id:'en_cours',     label:'En cours',      color:'#f59e0b', icon:'⚙️' },
  { id:'livre',        label:'Livré',         color:'#22c55e', icon:'✅' },
  { id:'resilie',      label:'Résilié',       color:'#ef4444', icon:'🚫' },
];

const PRIORITIES = {
  urgente: { label:'Urgente', color:'#ef4444', bg:'rgba(239,68,68,.15)',  icon:'🔴' },
  haute:   { label:'Haute',   color:'#f59e0b', bg:'rgba(245,158,11,.15)', icon:'🟠' },
  normale: { label:'Normale', color:'#3b82f6', bg:'rgba(59,130,246,.15)', icon:'🔵' },
  basse:   { label:'Basse',   color:'#6b7280', bg:'rgba(107,114,128,.15)',icon:'⚪' },
};

const TYPE_ICONS = {
  'SEO':'🚀', 'Cybersécurité':'💻', 'RGPD':'🛡️', 'DPO':'⚖️',
  'Social':'📱', 'Click & Collect':'🛒', 'Assurances':'🛡',
};

// ── State local du pipeline ──
let _plContacts  = [];   // contacts chargés
let _plContracts = {};   // { contact_id: [contracts] }
let _plFilter    = '';   // filtre commercial id
let _plDragging  = null; // id contact en cours de drag

// ── Init principale ──
async function initPipeline() {
  const board = document.getElementById('pl-board');
  if (!board) return;
  board.innerHTML = '<div class="pipeline-loading"><div class="pipeline-spinner"></div> Chargement…</div>';
  try {
    await _plLoadData();
    _plRenderBoard();
  } catch(e) {
    board.innerHTML = `<div class="pipeline-loading" style="color:#ef4444">Erreur chargement : ${escapeHtml(e.message)}</div>`;
    console.error('[pipeline]', e);
  }
}

// ── Chargement données ──
async function _plLoadData() {
  const myId   = state.user.id;
  const role   = getRole();
  const isAdm  = state.profile?.is_admin;

  // Construire filtre selon rôle
  let contactsQuery = sb.from('contacts')
    .select('id, nom, prenom, entreprise, kanban_col, priority, date_relance, created_by, notes')
    .order('entreprise', { ascending: true });

  if (!isAdm && role !== 'admin_candy' && role !== 'super_admin') {
    if (role === 'dci') {
      // niv2 : soi + ses niv1
      const { data: equipe } = await sb.from('profiles')
        .select('id').eq('dci_parent_id', myId).eq('role', 'user');
      const ids = [myId, ...(equipe || []).map(p => p.id)];
      contactsQuery = contactsQuery.in('created_by', ids);
    } else {
      // niv1 : soi uniquement
      contactsQuery = contactsQuery.eq('created_by', myId);
    }
  }

  const { data: contacts, error: cErr } = await contactsQuery;
  if (cErr) throw cErr;
  _plContacts = contacts || [];

  // Charger les contrats pour ces contacts
  if (_plContacts.length) {
    const contactIds = _plContacts.map(c => c.id);
    const { data: contracts, error: ctErr } = await sb.from('contracts')
      .select('id, contact_id, type, formule, montant, statut, date_echeance, notes, recurrence')
      .in('contact_id', contactIds)
      .neq('statut', 'résilié');
    if (ctErr) throw ctErr;
    _plContracts = {};
    (contracts || []).forEach(ct => {
      if (!_plContracts[ct.contact_id]) _plContracts[ct.contact_id] = [];
      _plContracts[ct.contact_id].push(ct);
    });
  }

  // Charger profils pour afficher les commerciaux
  if (!state.profilesById || !Object.keys(state.profilesById).length) {
    const { data: profs } = await sb.from('profiles').select('id, prenom, nom');
    state.profilesById = {};
    (profs || []).forEach(p => { state.profilesById[p.id] = p; });
  }
}

// ── Rendu du board ──
function _plRenderBoard() {
  const board = document.getElementById('pl-board');

  // Filtrage commercial
  let contacts = _plContacts;
  if (_plFilter) contacts = contacts.filter(c => c.created_by === _plFilter);

  // Grouper par colonne
  const byCol = {};
  PIPELINE_COLS.forEach(col => { byCol[col.id] = []; });
  contacts.forEach(c => {
    const col = c.kanban_col || 'prospect';
    if (byCol[col]) byCol[col].push(c);
  });

  board.innerHTML = PIPELINE_COLS.map(col => `
    <div class="pcol" id="pcol-${col.id}">
      <div class="pcol-head">
        <div class="pcol-accent" style="background:${col.color}"></div>
        <div class="pcol-label">${col.icon} ${col.label}</div>
        <div class="pcol-count" id="pcol-count-${col.id}">${byCol[col.id].length}</div>
      </div>
      <div class="pcol-cards" id="pcol-cards-${col.id}"
           ondragover="_plDragOver(event,'${col.id}')"
           ondragleave="_plDragLeave(event,'${col.id}')"
           ondrop="_plDrop(event,'${col.id}')">
        ${byCol[col.id].length
          ? byCol[col.id].map(c => _plCardHTML(c)).join('')
          : '<div class="pcol-empty">Aucune fiche</div>'}
      </div>
    </div>
  `).join('');

  _plInitCardEvents();
}

// ── HTML d'une carte ──
function _plCardHTML(contact) {
  const contracts = _plContracts[contact.id] || [];
  const prio      = PRIORITIES[contact.priority] || PRIORITIES.normale;
  const commercial = state.profilesById?.[contact.created_by];
  const commercialName = commercial
    ? (commercial.prenom || commercial.nom || '—')
    : '—';

  // Montant total des contrats
  const totalMontant = contracts.reduce((s, ct) => s + (parseFloat(ct.montant) || 0), 0);
  const montantStr   = totalMontant > 0
    ? totalMontant.toLocaleString('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:0 })
    : '—';

  // Date de relance
  const today      = new Date(); today.setHours(0,0,0,0);
  let relanceHTML  = '';
  if (contact.date_relance) {
    const dr      = new Date(contact.date_relance);
    const overdue = dr < today;
    const fmtDate = dr.toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
    relanceHTML = `<input class="pcard-date-input ${overdue ? 'overdue' : ''}"
      type="date" value="${contact.date_relance}"
      title="Date de relance"
      onchange="_plUpdateRelance('${contact.id}', this.value)"
      onclick="event.stopPropagation()">`;
  } else {
    relanceHTML = `<input class="pcard-date-input" type="date" placeholder="Relance"
      title="Définir une date de relance"
      onchange="_plUpdateRelance('${contact.id}', this.value)"
      onclick="event.stopPropagation()">`;
  }

  // Onglets contrats
  const tabsHTML = contracts.length ? `
    <div class="pcard-tabs" id="pcard-tabs-${contact.id}">
      ${contracts.map((ct, i) => {
        const icon = TYPE_ICONS[ct.type] || '📄';
        return `<button class="pcard-tab ${i===0?'active':''}"
          onclick="_plSelectTab('${contact.id}', ${i}, event)"
          data-tab-idx="${i}">${icon} ${escapeHtml(ct.type||'Contrat')}</button>`;
      }).join('')}
    </div>
    ${contracts.map((ct, i) => _plContractDetailHTML(ct, i, contact.id)).join('')}
  ` : '';

  return `
  <div class="pcard" id="pcard-${contact.id}"
       draggable="true"
       ondragstart="_plDragStart(event,'${contact.id}')"
       ondragend="_plDragEnd(event)">
    <div class="pcard-priority-stripe" style="background:${prio.color}"></div>

    <div class="pcard-head" style="padding-left:6px">
      <button class="pcard-priority-badge"
        style="color:${prio.color};background:${prio.bg}"
        onclick="_plTogglePriorityMenu('${contact.id}',event)">
        ${prio.icon} ${prio.label}
      </button>
      ${relanceHTML}
    </div>

    <!-- Priority menu -->
    <div class="pcard-priority-menu" id="ppm-${contact.id}">
      ${Object.entries(PRIORITIES).map(([k,p]) => `
        <div class="ppm-item" onclick="_plSetPriority('${contact.id}','${k}')">
          ${p.icon} ${p.label}
        </div>`).join('')}
    </div>

    <div style="padding-left:6px">
      <div class="pcard-company">${escapeHtml(contact.entreprise || contact.nom || '—')}</div>
      <div class="pcard-name">${escapeHtml(contact.prenom || '')} ${escapeHtml(contact.nom || '')}</div>
      <div class="pcard-meta">
        <div class="pcard-meta-item">👤 ${escapeHtml(commercialName)}</div>
        ${totalMontant > 0 ? `<div class="pcard-meta-item pcard-amount">💰 ${montantStr}</div>` : ''}
      </div>
    </div>

    ${tabsHTML}

    <div class="pcard-actions">
      <button class="pcard-edit-btn" onclick="switchView('contacts');setTimeout(()=>openContactModal('${contact.id}'),80)">
        ✏️ Modifier la fiche
      </button>
    </div>
  </div>`;
}

// ── Détail d'un contrat ──
function _plContractDetailHTML(ct, idx, contactId) {
  const echeance = ct.date_echeance
    ? new Date(ct.date_echeance).toLocaleDateString('fr-FR')
    : '—';
  const montant = ct.montant
    ? parseFloat(ct.montant).toLocaleString('fr-FR', { style:'currency', currency:'EUR' })
    : '—';

  return `<div class="pcard-contract-detail ${idx===0?'open':''}"
              id="pcard-ct-${contactId}-${idx}">
    <div class="pcard-contract-detail-row">
      <span>Formule</span><span>${escapeHtml(ct.formule || ct.type || '—')}</span>
    </div>
    <div class="pcard-contract-detail-row">
      <span>Montant</span><span>${montant}</span>
    </div>
    <div class="pcard-contract-detail-row">
      <span>Récurrence</span><span>${escapeHtml(ct.recurrence || '—')}</span>
    </div>
    <div class="pcard-contract-detail-row">
      <span>Statut</span><span>${escapeHtml(ct.statut || '—')}</span>
    </div>
    <div class="pcard-contract-detail-row">
      <span>Échéance</span><span>${echeance}</span>
    </div>
    ${ct.notes ? `<div class="pcard-contract-notes">📝 ${escapeHtml(ct.notes)}</div>` : ''}
  </div>`;
}

// ── Sélection d'un onglet contrat ──
function _plSelectTab(contactId, idx, event) {
  event.stopPropagation();
  const tabsEl = document.getElementById(`pcard-tabs-${contactId}`);
  if (!tabsEl) return;
  tabsEl.querySelectorAll('.pcard-tab').forEach((t, i) => {
    t.classList.toggle('active', i === idx);
  });
  const card = document.getElementById(`pcard-${contactId}`);
  if (!card) return;
  card.querySelectorAll('.pcard-contract-detail').forEach((d, i) => {
    d.classList.toggle('open', i === idx);
  });
}

// ── Menu priorité ──
function _plTogglePriorityMenu(contactId, event) {
  event.stopPropagation();
  const menu = document.getElementById(`ppm-${contactId}`);
  if (!menu) return;
  // Fermer les autres
  document.querySelectorAll('.pcard-priority-menu.open').forEach(m => {
    if (m !== menu) m.classList.remove('open');
  });
  menu.classList.toggle('open');
}

async function _plSetPriority(contactId, priority) {
  document.querySelectorAll('.pcard-priority-menu.open').forEach(m => m.classList.remove('open'));
  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact) return;
  contact.priority = priority;
  const { error } = await sb.from('contacts').update({ priority }).eq('id', contactId);
  if (error) { console.error('[pipeline] priority update', error); return; }
  // Re-render uniquement la carte
  const cardEl = document.getElementById(`pcard-${contactId}`);
  if (cardEl) cardEl.outerHTML = _plCardHTML(contact);
  _plInitCardEvents();
}

// ── Mise à jour date de relance ──
async function _plUpdateRelance(contactId, value) {
  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact) return;
  contact.date_relance = value || null;
  await sb.from('contacts').update({ date_relance: value || null }).eq('id', contactId);
}

// ── Drag & Drop ──
function _plDragStart(event, contactId) {
  _plDragging = contactId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', contactId);
  setTimeout(() => {
    const el = document.getElementById(`pcard-${contactId}`);
    if (el) el.classList.add('dragging');
  }, 0);
}

function _plDragEnd(event) {
  if (_plDragging) {
    const el = document.getElementById(`pcard-${_plDragging}`);
    if (el) el.classList.remove('dragging');
  }
  document.querySelectorAll('.pcol-cards').forEach(c => c.classList.remove('drag-over'));
}

function _plDragOver(event, colId) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.getElementById(`pcol-cards-${colId}`)?.classList.add('drag-over');
}

function _plDragLeave(event, colId) {
  document.getElementById(`pcol-cards-${colId}`)?.classList.remove('drag-over');
}

async function _plDrop(event, colId) {
  event.preventDefault();
  document.querySelectorAll('.pcol-cards').forEach(c => c.classList.remove('drag-over'));
  const contactId = event.dataTransfer.getData('text/plain') || _plDragging;
  if (!contactId) return;

  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact || contact.kanban_col === colId) return;

  const oldCol = contact.kanban_col;
  contact.kanban_col = colId;

  // Mettre à jour Supabase
  const { error } = await sb.from('contacts').update({ kanban_col: colId }).eq('id', contactId);
  if (error) {
    console.error('[pipeline] drop update', error);
    contact.kanban_col = oldCol; // rollback
    return;
  }

  // Mise à jour DOM rapide (sans reload complet)
  const cardEl = document.getElementById(`pcard-${contactId}`);
  const oldCards = document.getElementById(`pcol-cards-${oldCol}`);
  const newCards = document.getElementById(`pcol-cards-${colId}`);
  if (cardEl && oldCards && newCards) {
    // Retirer l'état "empty" si présent
    newCards.querySelectorAll('.pcol-empty').forEach(e => e.remove());
    newCards.appendChild(cardEl);
    // Ajouter empty si oldCol est vide
    if (!oldCards.querySelector('.pcard')) {
      oldCards.innerHTML = '<div class="pcol-empty">Aucune fiche</div>';
    }
    // Mettre à jour les compteurs
    _plUpdateColCount(oldCol);
    _plUpdateColCount(colId);
  }

  _plDragging = null;
}

function _plUpdateColCount(colId) {
  const count = document.querySelectorAll(`#pcol-cards-${colId} .pcard`).length;
  const badge = document.getElementById(`pcol-count-${colId}`);
  if (badge) badge.textContent = count;
}

// ── Initialiser events cards (après rendu) ──
function _plInitCardEvents() {
  // Fermer menus priorité au clic extérieur
  document.addEventListener('click', _plCloseMenus, { once: false });
}

function _plCloseMenus(event) {
  if (!event.target.closest('.pcard-priority-badge')) {
    document.querySelectorAll('.pcard-priority-menu.open')
      .forEach(m => m.classList.remove('open'));
  }
}

// ── Filtre commercial ──
function _plApplyFilter() {
  _plFilter = document.getElementById('pl-filter-user')?.value || '';
  _plRenderBoard();
}

// ── Construire le select filtre commercial ──
function _plBuildFilterSelect() {
  const sel = document.getElementById('pl-filter-user');
  if (!sel || !state.profilesById) return;
  const profiles = Object.values(state.profilesById);
  // N'afficher que les commerciaux présents dans les contacts chargés
  const usedIds = new Set(_plContacts.map(c => c.created_by));
  const relevant = profiles.filter(p => usedIds.has(p.id));
  sel.innerHTML = '<option value="">Tous les commerciaux</option>'
    + relevant.map(p => `<option value="${p.id}">${escapeHtml(p.prenom || p.nom || p.id)}</option>`).join('');
}

// ── Point d'entrée appelé par switchView ──
window.loadPipeline = async function() {
  await initPipeline();
  _plBuildFilterSelect();
};
