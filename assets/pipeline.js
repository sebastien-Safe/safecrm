/* ═══════════════════════════════════════════
   PIPELINE KANBAN — S@FE CRM  (Itération 2)
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

const PJ_BUCKET = 'contrats-pdf';

// ── State local du pipeline ──
let _plContacts  = [];
let _plContracts = {};
let _plFilter    = '';
let _plSearch    = '';
let _plDragging  = null;
let _plPJCache   = {}; // { contact_id: [{name, url}] }

// ── Init principale ──
async function initPipeline() {
  const board = document.getElementById('pl-board');
  if (!board) return;
  board.innerHTML = '<div class="pipeline-loading"><div class="pipeline-spinner"></div> Chargement…</div>';
  try {
    await _plLoadData();
    _plRenderBoard();
    _plBuildFilterSelect();
    _plUpdateTotal();
  } catch(e) {
    board.innerHTML = `<div class="pipeline-loading" style="color:#ef4444">Erreur chargement : ${escapeHtml(e.message)}</div>`;
    console.error('[pipeline]', e);
  }
}

// ── Chargement données ──
async function _plLoadData() {
  const myId  = state.user.id;
  const role  = getRole();
  const isAdm = state.profile?.is_admin;

  let contactsQuery = sb.from('contacts')
    .select('id, nom, prenom, entreprise, kanban_col, priority, date_relance, created_by, notes, kanban_checklist')
    .order('entreprise', { ascending: true });

  if (!isAdm && role !== 'admin_candy' && role !== 'super_admin') {
    if (role === 'dci') {
      const { data: equipe } = await sb.from('profiles')
        .select('id').eq('dci_parent_id', myId).eq('role', 'user');
      const ids = [myId, ...(equipe || []).map(p => p.id)];
      contactsQuery = contactsQuery.in('created_by', ids);
    } else {
      contactsQuery = contactsQuery.eq('created_by', myId);
    }
  }

  const { data: contacts, error: cErr } = await contactsQuery;
  if (cErr) throw cErr;
  _plContacts = (contacts || []).map(c => ({
    ...c,
    kanban_checklist: Array.isArray(c.kanban_checklist) ? c.kanban_checklist : [],
  }));

  if (_plContacts.length) {
    const contactIds = _plContacts.map(c => c.id);
    const { data: contracts, error: ctErr } = await sb.from('contracts')
      .select('id, contact_id, type, formule, montant, statut, date_echeance, notes, recurrence, signed_pdf_contrat_url')
      .in('contact_id', contactIds)
      .neq('statut', 'résilié');
    if (ctErr) throw ctErr;
    _plContracts = {};
    (contracts || []).forEach(ct => {
      if (!_plContracts[ct.contact_id]) _plContracts[ct.contact_id] = [];
      _plContracts[ct.contact_id].push(ct);
    });
  }

  if (!state.profilesById || !Object.keys(state.profilesById).length) {
    const { data: profs } = await sb.from('profiles').select('id, prenom, nom');
    state.profilesById = {};
    (profs || []).forEach(p => { state.profilesById[p.id] = p; });
  }
}

// ── Rendu du board ──
function _plRenderBoard() {
  const board = document.getElementById('pl-board');
  let contacts = _plContacts;

  if (_plFilter) contacts = contacts.filter(c => c.created_by === _plFilter);
  if (_plSearch) {
    const q = _plSearch.toLowerCase();
    contacts = contacts.filter(c =>
      (c.entreprise || '').toLowerCase().includes(q) ||
      (c.nom || '').toLowerCase().includes(q) ||
      (c.prenom || '').toLowerCase().includes(q)
    );
  }

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
  const contracts      = _plContracts[contact.id] || [];
  const prio           = PRIORITIES[contact.priority] || PRIORITIES.normale;
  const commercial     = state.profilesById?.[contact.created_by];
  const commercialName = commercial ? (commercial.prenom || commercial.nom || '—') : '—';

  const totalMontant = contracts.reduce((s, ct) => s + (parseFloat(ct.montant) || 0), 0);
  const montantStr   = totalMontant > 0
    ? totalMontant.toLocaleString('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:0 })
    : '—';

  // Date relance
  const today = new Date(); today.setHours(0,0,0,0);
  let relanceHTML = '';
  if (contact.date_relance) {
    const dr = new Date(contact.date_relance);
    relanceHTML = `<input class="pcard-date-input${dr < today ? ' overdue' : ''}"
      type="date" value="${contact.date_relance}" title="Date de relance"
      onchange="_plUpdateRelance('${contact.id}', this.value)"
      onclick="event.stopPropagation()">`;
  } else {
    relanceHTML = `<input class="pcard-date-input" type="date" placeholder="Relance"
      title="Définir une date de relance"
      onchange="_plUpdateRelance('${contact.id}', this.value)"
      onclick="event.stopPropagation()">`;
  }

  // Checklist badge
  const cl      = contact.kanban_checklist || [];
  const clDone  = cl.filter(i => i.done).length;
  const clTotal = cl.length;
  const clBadge = clTotal > 0
    ? `<div class="pcard-meta-item"><span class="pcard-checklist-progress${clDone===clTotal?' done':''}">☑ ${clDone}/${clTotal}</span></div>`
    : '';

  // Onglets contrats
  const tabsHTML = contracts.length ? `
    <div class="pcard-tabs" id="pcard-tabs-${contact.id}">
      ${contracts.map((ct, i) => {
        const icon = TYPE_ICONS[ct.type] || '📄';
        return `<button class="pcard-tab ${i===0?'active':''}"
          onclick="_plSelectTab('${contact.id}', ${i}, event)">${icon} ${escapeHtml(ct.type||'Contrat')}</button>`;
      }).join('')}
    </div>
    ${contracts.map((ct, i) => _plContractDetailHTML(ct, i, contact.id)).join('')}
  ` : '';

  return `
  <div class="pcard" id="pcard-${contact.id}"
       draggable="${isAdmin()}"
       ondragstart="_plDragStart(event,'${contact.id}')"
       ondragend="_plDragEnd(event)"
       style="${isAdmin() ? '' : 'cursor:default'}">`
    <div class="pcard-priority-stripe" style="background:${prio.color}"></div>

    <div class="pcard-head" style="padding-left:6px">
      <button class="pcard-priority-badge"
        style="color:${prio.color};background:${prio.bg}"
        onclick="_plTogglePriorityMenu('${contact.id}',event)">
        ${prio.icon} ${prio.label}
      </button>
      ${relanceHTML}
    </div>

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
        ${clBadge}
      </div>
    </div>

    ${tabsHTML}
    ${_plChecklistHTML(contact)}
    ${_plPJHTML(contact, contracts)}

    <div class="pcard-actions">
      <button class="pcard-edit-btn" onclick="switchView('contacts');setTimeout(()=>openContactModal('${contact.id}'),80)">
        ✏️ Modifier la fiche
      </button>
      <button class="pcard-edit-btn" style="background:rgba(37,99,235,.15);color:#93c5fd;border-color:rgba(37,99,235,.3)" onclick="openContractForContact('${contact.id}')">
        ➕ Nouveau contrat
      </button>
      ${contact.kanban_col === 'en_cours' && isAdmin() ? `
      <button class="pcard-edit-btn" style="background:rgba(34,197,94,.15);color:#86efac;border-color:rgba(34,197,94,.3)" onclick="_plMarquerLivre('${contact.id}')">
        ✅ Marquer livré
      </button>` : ''}
    </div>
  </div>`;
}

// ── Détail d'un contrat ──
function _plContractDetailHTML(ct, idx, contactId) {
  const echeance = ct.date_echeance
    ? new Date(ct.date_echeance).toLocaleDateString('fr-FR') : '—';
  const montant = ct.montant
    ? parseFloat(ct.montant).toLocaleString('fr-FR', { style:'currency', currency:'EUR' }) : '—';

  return `<div class="pcard-contract-detail ${idx===0?'open':''}" id="pcard-ct-${contactId}-${idx}">
    <div class="pcard-contract-detail-row"><span>Formule</span><span>${escapeHtml(ct.formule || ct.type || '—')}</span></div>
    <div class="pcard-contract-detail-row"><span>Montant</span><span>${montant}</span></div>
    <div class="pcard-contract-detail-row"><span>Récurrence</span><span>${escapeHtml(ct.recurrence || '—')}</span></div>
    <div class="pcard-contract-detail-row"><span>Statut</span><span>${escapeHtml(ct.statut || '—')}</span></div>
    <div class="pcard-contract-detail-row"><span>Échéance</span><span>${echeance}</span></div>
    ${ct.notes ? `<div class="pcard-contract-notes">📝 ${escapeHtml(ct.notes)}</div>` : ''}
    <div style="margin-top:8px;display:flex;gap:6px">
      <button class="pcard-edit-btn" style="flex:1;justify-content:center"
        onclick="openContractModal('${ct.id}');event.stopPropagation()">
        ✏️ Modifier / Envoyer
      </button>
    </div>
  </div>`;
}

// ── HTML Checklist ──
function _plChecklistHTML(contact) {
  const cl = contact.kanban_checklist || [];
  const itemsHTML = cl.map((item, idx) => `
    <div class="pcard-cl-item">
      <input class="pcard-cl-cb" type="checkbox" ${item.done?'checked':''}
        onclick="_plChecklistToggle('${contact.id}',${idx},event)">
      <span class="pcard-cl-label${item.done?' checked':''}"
        onclick="_plChecklistToggle('${contact.id}',${idx},event)">${escapeHtml(item.label)}</span>
      <button class="pcard-cl-del" onclick="_plChecklistDelete('${contact.id}',${idx},event)">×</button>
    </div>`).join('');

  return `
  <div class="pcard-checklist">
    <div class="pcard-checklist-head">
      <span class="pcard-checklist-lbl">☑ Checklist</span>
    </div>
    <div class="pcard-checklist-items" id="cl-items-${contact.id}">${itemsHTML}</div>
    <div class="pcard-cl-add">
      <input class="pcard-cl-input" id="cl-input-${contact.id}" type="text"
        placeholder="Ajouter un élément…" maxlength="120"
        onclick="event.stopPropagation()"
        onkeydown="_plChecklistKeydown('${contact.id}',event)">
      <button class="pcard-cl-submit" onclick="_plChecklistAdd('${contact.id}',event)">+</button>
    </div>
  </div>`;
}

// ── HTML Pièces jointes ──
function _plPJHTML(contact, contracts) {
  const contractPDFs = contracts.map(ct => `
    <div class="pcard-pj-contract">
      <span class="pcard-pj-contract-name">📄 ${escapeHtml(ct.type||'Contrat')}${ct.formule?' — '+escapeHtml(ct.formule):''}</span>
      ${ct.signed_pdf_contrat_url
        ? `<a href="${ct.signed_pdf_contrat_url}" target="_blank" class="pcard-pj-contract-btn">⬇ Signé</a>`
        : `<button class="pcard-pj-contract-btn" onclick="_plGenerateContractPDF('${ct.id}',event)">⬇ Générer</button>`}
    </div>`).join('');

  return `
  <div class="pcard-pj">
    <div class="pcard-pj-head">
      <span class="pcard-pj-lbl">📎 Pièces jointes</span>
      <button class="pcard-pj-toggle" onclick="_plTogglePJ('${contact.id}',event)">Voir ▾</button>
    </div>
    <div class="pcard-pj-body" id="pj-body-${contact.id}">
      ${contractPDFs ? `<div class="pcard-pj-list">${contractPDFs}</div>` : ''}
      <div class="pcard-pj-list" id="pj-list-${contact.id}">
        <div class="pcard-pj-empty" id="pj-empty-${contact.id}">Chargement…</div>
      </div>
      <div class="pcard-pj-upload">
        <label class="pcard-pj-upload-btn" for="pj-file-${contact.id}">⬆ Ajouter un fichier</label>
        <input type="file" id="pj-file-${contact.id}" style="display:none" multiple
          onchange="_plUploadPJ('${contact.id}',this)">
        <span class="pcard-pj-uploading" id="pj-uploading-${contact.id}" style="display:none">Envoi…</span>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════
// CHECKLIST ACTIONS
// ═══════════════════════════════════════

function _plChecklistKeydown(contactId, event) {
  event.stopPropagation();
  if (event.key === 'Enter') _plChecklistAdd(contactId, event);
}

async function _plChecklistAdd(contactId, event) {
  event.stopPropagation();
  const input = document.getElementById(`cl-input-${contactId}`);
  if (!input) return;
  const label = input.value.trim();
  if (!label) return;
  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact) return;
  contact.kanban_checklist = [...(contact.kanban_checklist || []), { id: crypto.randomUUID(), label, done: false }];
  input.value = '';
  await _plSaveChecklist(contactId);
  _plRefreshCard(contactId);
}

async function _plChecklistToggle(contactId, idx, event) {
  event.stopPropagation();
  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact || !contact.kanban_checklist[idx]) return;
  contact.kanban_checklist[idx].done = !contact.kanban_checklist[idx].done;
  await _plSaveChecklist(contactId);
  _plRefreshCard(contactId);
}

async function _plChecklistDelete(contactId, idx, event) {
  event.stopPropagation();
  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact) return;
  contact.kanban_checklist = contact.kanban_checklist.filter((_, i) => i !== idx);
  await _plSaveChecklist(contactId);
  _plRefreshCard(contactId);
}

async function _plSaveChecklist(contactId) {
  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact) return;
  const { error } = await sb.from('contacts')
    .update({ kanban_checklist: contact.kanban_checklist })
    .eq('id', contactId);
  if (error) console.error('[pipeline] checklist save', error);
}

// ═══════════════════════════════════════
// PIÈCES JOINTES
// ═══════════════════════════════════════

async function _plTogglePJ(contactId, event) {
  event.stopPropagation();
  const body = document.getElementById(`pj-body-${contactId}`);
  const btn  = event.currentTarget;
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  btn.textContent = isOpen ? 'Masquer ▴' : 'Voir ▾';
  if (isOpen) await _plLoadPJ(contactId);
}

async function _plLoadPJ(contactId) {
  const listEl  = document.getElementById(`pj-list-${contactId}`);
  const emptyEl = document.getElementById(`pj-empty-${contactId}`);
  if (!listEl) return;

  if (_plPJCache[contactId]) { _plRenderPJList(contactId, _plPJCache[contactId]); return; }
  if (emptyEl) emptyEl.textContent = 'Chargement…';

  const { data, error } = await sb.storage.from(PJ_BUCKET).list(`pj/${contactId}`, { limit: 50 });
  if (error) { if (emptyEl) emptyEl.textContent = 'Erreur chargement'; return; }

  const files = (data || [])
    .filter(f => f.name !== '.emptyFolderPlaceholder')
    .map(f => ({
      name: f.name,
      url:  sb.storage.from(PJ_BUCKET).getPublicUrl(`pj/${contactId}/${f.name}`).data.publicUrl,
    }));

  _plPJCache[contactId] = files;
  _plRenderPJList(contactId, files);
}

function _plRenderPJList(contactId, files) {
  const listEl  = document.getElementById(`pj-list-${contactId}`);
  const emptyEl = document.getElementById(`pj-empty-${contactId}`);
  if (!listEl) return;
  if (!files.length) {
    if (emptyEl) { emptyEl.style.display=''; emptyEl.textContent='Aucun fichier joint'; }
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  const EXT_ICON = { pdf:'📄', jpg:'🖼', jpeg:'🖼', png:'🖼', gif:'🖼', webp:'🖼', xlsx:'📊', csv:'📊', docx:'📝' };
  listEl.innerHTML = files.map(f => {
    const ext  = f.name.split('.').pop().toLowerCase();
    const icon = EXT_ICON[ext] || '📎';
    return `<div class="pcard-pj-item">
      <span class="pcard-pj-icon">${icon}</span>
      <a class="pcard-pj-name" href="${f.url}" target="_blank" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</a>
      <button class="pcard-pj-del" onclick="_plDeletePJ('${contactId}','${escapeHtml(f.name)}',event)" title="Supprimer">×</button>
    </div>`;
  }).join('');
}

async function _plUploadPJ(contactId, input) {
  const upEl = document.getElementById(`pj-uploading-${contactId}`);
  if (upEl) upEl.style.display = '';
  for (const file of input.files) {
    const { error } = await sb.storage.from(PJ_BUCKET).upload(`pj/${contactId}/${file.name}`, file, { upsert: true });
    if (error) { console.error('[pipeline] upload PJ', error); continue; }
    if (typeof logRgpd === 'function') logRgpd('pj_uploadee', 'Pipeline', {
      entityType: 'contact', entityId: contactId, criticite: 'Attention',
      donnees: 'fichier client (PDF/document)',
      details: { fichier: file.name, taille_ko: Math.round(file.size / 1024) },
    });
  }
  if (upEl) upEl.style.display = 'none';
  input.value = '';
  delete _plPJCache[contactId];
  await _plLoadPJ(contactId);
}

async function _plDeletePJ(contactId, filename, event) {
  event.stopPropagation();
  if (!confirm(`Supprimer "${filename}" ?`)) return;
  const { error } = await sb.storage.from(PJ_BUCKET).remove([`pj/${contactId}/${filename}`]);
  if (error) { console.error('[pipeline] delete PJ', error); return; }
  if (typeof logRgpd === 'function') logRgpd('pj_supprimee', 'Pipeline', {
    entityType: 'contact', entityId: contactId, criticite: 'Critique',
    donnees: 'fichier client supprimé définitivement',
    details: { fichier: filename },
  });
  delete _plPJCache[contactId];
  await _plLoadPJ(contactId);
}

async function _plGenerateContractPDF(contractId, event) {
  event.stopPropagation();
  // Redirige vers la vue contrats où la génération PDF est disponible
  switchView('contracts');
  // Tenter d'ouvrir le contrat directement si la fonction existe
  if (typeof openContractModal === 'function') {
    setTimeout(() => openContractModal(contractId), 80);
  }
}

// ═══════════════════════════════════════
// ONGLETS CONTRATS
// ═══════════════════════════════════════

function _plSelectTab(contactId, idx, event) {
  event.stopPropagation();
  const tabsEl = document.getElementById(`pcard-tabs-${contactId}`);
  if (!tabsEl) return;
  tabsEl.querySelectorAll('.pcard-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  document.getElementById(`pcard-${contactId}`)?.querySelectorAll('.pcard-contract-detail')
    .forEach((d, i) => d.classList.toggle('open', i === idx));
}

// ═══════════════════════════════════════
// PRIORITÉ
// ═══════════════════════════════════════

function _plTogglePriorityMenu(contactId, event) {
  event.stopPropagation();
  const menu = document.getElementById(`ppm-${contactId}`);
  if (!menu) return;
  document.querySelectorAll('.pcard-priority-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}

async function _plSetPriority(contactId, priority) {
  document.querySelectorAll('.pcard-priority-menu.open').forEach(m => m.classList.remove('open'));
  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact) return;
  contact.priority = priority;
  await sb.from('contacts').update({ priority }).eq('id', contactId);
  _plRefreshCard(contactId);
}

// ═══════════════════════════════════════
// DATE RELANCE
// ═══════════════════════════════════════

async function _plUpdateRelance(contactId, value) {
  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact) return;
  contact.date_relance = value || null;
  await sb.from('contacts').update({ date_relance: value || null }).eq('id', contactId);
}

// ═══════════════════════════════════════
// MARQUER LIVRÉ
// ═══════════════════════════════════════

async function _plMarquerLivre(contactId) {
  if (!isAdmin()) return;
  if (!confirm('Marquer cette fiche comme Livré ? Les contrats actifs seront passés en "Terminé".')) return;
  const { error } = await sb.from('contacts').update({ kanban_col: 'livre' }).eq('id', contactId);
  if (error) { alert('Erreur : ' + error.message); return; }
  // Passer les contrats actifs en Terminé
  const contracts = (_plContracts[contactId] || []).filter(ct => ct.statut === 'Contrat en cours');
  for (const ct of contracts) {
    await sb.from('contracts').update({ statut: 'Terminé' }).eq('id', ct.id);
  }
  const contact = _plContacts.find(c => c.id === contactId);
  if (contact) contact.kanban_col = 'livre';
  await initPipeline();
  if (typeof showCrmToast === 'function') showCrmToast('✅ Fiche passée en <strong>Livré</strong>');
}

// ═══════════════════════════════════════
// DRAG & DROP
// ═══════════════════════════════════════

function _plDragStart(event, contactId) {
  if (!isAdmin()) { event.preventDefault(); return; }
  _plDragging = contactId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', contactId);
  setTimeout(() => document.getElementById(`pcard-${contactId}`)?.classList.add('dragging'), 0);
}

function _plDragEnd() {
  if (_plDragging) document.getElementById(`pcard-${_plDragging}`)?.classList.remove('dragging');
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
  if (!isAdmin()) return;
  const contactId = event.dataTransfer.getData('text/plain') || _plDragging;
  if (!contactId) return;
  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact || contact.kanban_col === colId) return;

  const oldCol = contact.kanban_col;
  contact.kanban_col = colId;
  const { error } = await sb.from('contacts').update({ kanban_col: colId }).eq('id', contactId);
  if (error) { console.error('[pipeline] drop', error); contact.kanban_col = oldCol; return; }

  const cardEl   = document.getElementById(`pcard-${contactId}`);
  const oldCards = document.getElementById(`pcol-cards-${oldCol}`);
  const newCards = document.getElementById(`pcol-cards-${colId}`);
  if (cardEl && oldCards && newCards) {
    newCards.querySelectorAll('.pcol-empty').forEach(e => e.remove());
    newCards.appendChild(cardEl);
    if (!oldCards.querySelector('.pcard')) oldCards.innerHTML = '<div class="pcol-empty">Aucune fiche</div>';
    _plUpdateColCount(oldCol);
    _plUpdateColCount(colId);
  }
  _plDragging = null;
  _plUpdateTotal();
}

function _plUpdateColCount(colId) {
  const badge = document.getElementById(`pcol-count-${colId}`);
  if (badge) badge.textContent = document.querySelectorAll(`#pcol-cards-${colId} .pcard`).length;
}

// ═══════════════════════════════════════
// COMPTEUR GLOBAL
// ═══════════════════════════════════════

function _plUpdateTotal() {
  const el = document.getElementById('pl-total');
  if (!el) return;

  let contacts = _plContacts;
  if (_plFilter) contacts = contacts.filter(c => c.created_by === _plFilter);
  if (_plSearch) {
    const q = _plSearch.toLowerCase();
    contacts = contacts.filter(c =>
      (c.entreprise||'').toLowerCase().includes(q) ||
      (c.nom||'').toLowerCase().includes(q) ||
      (c.prenom||'').toLowerCase().includes(q)
    );
  }

  let total = 0;
  contacts.filter(c => c.kanban_col !== 'resilie').forEach(c => {
    (_plContracts[c.id] || []).forEach(ct => { total += parseFloat(ct.montant) || 0; });
  });

  const fmt = total.toLocaleString('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:0 });
  el.innerHTML = `<span>Pipeline actif</span> ${fmt}`;
}

// ═══════════════════════════════════════
// RECHERCHE & FILTRE
// ═══════════════════════════════════════

function _plApplySearch() {
  _plSearch = document.getElementById('pl-search')?.value?.trim() || '';
  _plRenderBoard();
  _plUpdateTotal();
}

function _plApplyFilter() {
  _plFilter = document.getElementById('pl-filter-user')?.value || '';
  _plRenderBoard();
  _plUpdateTotal();
}

function _plBuildFilterSelect() {
  const sel = document.getElementById('pl-filter-user');
  if (!sel || !state.profilesById) return;
  const usedIds  = new Set(_plContacts.map(c => c.created_by));
  const relevant = Object.values(state.profilesById).filter(p => usedIds.has(p.id));
  if (relevant.length <= 1) { sel.style.display = 'none'; return; }
  sel.innerHTML = '<option value="">Tous les commerciaux</option>'
    + relevant.map(p => `<option value="${p.id}">${escapeHtml(p.prenom || p.nom || p.id)}</option>`).join('');
}

// ═══════════════════════════════════════
// REFRESH PARTIEL
// ═══════════════════════════════════════

function _plRefreshCard(contactId) {
  const contact = _plContacts.find(c => c.id === contactId);
  if (!contact) return;
  const cardEl = document.getElementById(`pcard-${contactId}`);
  if (!cardEl) return;
  cardEl.outerHTML = _plCardHTML(contact);
  _plInitCardEvents();
}

function _plInitCardEvents() {
  document.removeEventListener('click', _plCloseMenus);
  document.addEventListener('click', _plCloseMenus);
}

function _plCloseMenus(event) {
  if (!event.target.closest('.pcard-priority-badge')) {
    document.querySelectorAll('.pcard-priority-menu.open').forEach(m => m.classList.remove('open'));
  }
}

function openContractForContact(contactId) {
  if (typeof openContractModal !== 'function') {
    switchView('contracts');
    setTimeout(() => openContractModal(null, contactId), 80);
    return;
  }
  openContractModal(null, contactId);
  const modal = document.getElementById('contract-modal');
  if (modal) modal.classList.add('show');
}

// ═══════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════

window.loadPipeline = async function() {
  await initPipeline();
  const searchEl = document.getElementById('pl-search');
  if (searchEl) { searchEl.value = _plSearch; searchEl.oninput = _plApplySearch; }
};
