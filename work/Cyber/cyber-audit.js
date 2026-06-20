/* ============================================================
   Cybersec Clients — Checklist d'audit (ANSSI/CIS)
   23 points de contrôle, 6 catégories pondérées
   ============================================================ */

let _auditData = {}; // { item_key: { statut, notes, id } }

async function loadAudit() {
  if (!currentContact) return;
  const el = document.getElementById('audit-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement de l\'audit…</div>';

  const { data: rows } = await supa
    .from('cyber_client_audits')
    .select('*')
    .eq('contact_id', currentContact.id);

  _auditData = {};
  (rows || []).forEach(r => { _auditData[r.item_key] = r; });

  const { score, catScores } = await computeScoreCyber(currentContact.id);

  // Mettre à jour le score sidebar
  const scoreEl = document.getElementById('sidebar-score');
  if (scoreEl) { scoreEl.textContent = score + '%'; scoreEl.style.color = scoreColor(score); }

  // Progression globale
  const totalItems = Object.values(CYBER_CATS).flatMap(c => c.items).length;
  const verified   = Object.values(_auditData).filter(r => r.statut !== 'non_verifie').length;

  el.innerHTML = `
    <!-- Score global -->
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <div style="text-align:center;min-width:80px">
          <div style="font-family:var(--ff-disp);font-size:2.8rem;font-weight:800;
            color:${scoreColor(score)};line-height:1">${score}%</div>
          <div style="margin-top:4px">${scoreBadge(score)}</div>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:.76rem;color:var(--mut);margin-bottom:8px;font-family:var(--ff-mono)">
            ${verified}/${totalItems} points vérifiés
          </div>
          <div class="score-bar-wrap" style="margin-bottom:12px">
            <div class="score-bar" style="width:${Math.round((verified/totalItems)*100)}%;background:var(--cyber)"></div>
          </div>
          ${Object.entries(CYBER_CATS).map(([catKey, cat]) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
              <span style="font-size:.74rem;color:var(--mut);min-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cat.icon} ${cat.label}</span>
              <div class="score-bar-wrap" style="flex:1">
                <div class="score-bar" style="width:${catScores[catKey]||0}%;background:${scoreColor(catScores[catKey]||0)}"></div>
              </div>
              <span style="font-family:var(--ff-mono);font-size:.72rem;font-weight:700;
                color:${scoreColor(catScores[catKey]||0)};min-width:32px;text-align:right">${catScores[catKey]||0}%</span>
            </div>`).join('')}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn btn-pri btn-sm" onclick="saveAllAudit()">💾 Sauvegarder</button>
          <button class="btn btn-ghost btn-sm" onclick="exportAuditPDF()">PDF</button>
        </div>
      </div>
    </div>

    <!-- Checklist par catégorie -->
    ${Object.entries(CYBER_CATS).map(([catKey, cat]) => renderCatBlock(catKey, cat, catScores[catKey]||0)).join('')}`;
}

function renderCatBlock(catKey, cat, catScore) {
  const catItems = cat.items.map(item => {
    const row    = _auditData[item.key] || {};
    const statut = row.statut || 'non_verifie';
    const notes  = row.notes  || '';
    return `
      <div class="checklist-item">
        <span style="font-size:1rem;flex-shrink:0">${statusIcon(statut)}</span>
        <span class="checklist-item-label">${escHtml(item.label)}</span>
        <select class="status-select ${statut}" id="st-${item.key}"
          onchange="onStatusChange('${item.key}','${catKey}',this)">
          <option value="non_verifie"  ${statut==='non_verifie'  ?'selected':''}>⚪ Non vérifié</option>
          <option value="conforme"     ${statut==='conforme'     ?'selected':''}>✅ Conforme</option>
          <option value="partiel"      ${statut==='partiel'      ?'selected':''}>🟡 Partiel</option>
          <option value="non_conforme" ${statut==='non_conforme' ?'selected':''}>❌ Non conforme</option>
          <option value="na"           ${statut==='na'           ?'selected':''}>➖ N/A</option>
        </select>
        <input class="checklist-notes-input" id="notes-${item.key}"
          value="${escHtml(notes)}" placeholder="Note…"
          onchange="onNotesChange('${item.key}',this.value)">
      </div>`;
  }).join('');

  return `
    <div class="checklist-cat">
      <div class="checklist-cat-head">
        <span class="checklist-cat-label">${cat.icon} ${cat.label}
          <span style="font-size:.72rem;color:var(--mut);font-weight:400">(${Math.round(cat.weight*100)}% du score)</span>
        </span>
        <span class="checklist-cat-score" style="color:${scoreColor(catScore)}">${catScore}%</span>
      </div>
      <div class="checklist-items">${catItems}</div>
    </div>`;
}

function statusIcon(st) {
  return { conforme:'✅', partiel:'🟡', non_conforme:'❌', na:'➖', non_verifie:'⚪' }[st] || '⚪';
}

/* ---- Changements inline ---- */
function onStatusChange(itemKey, catKey, selectEl) {
  const newSt = selectEl.value;
  // Mettre à jour l'icône
  const itemEl = selectEl.closest('.checklist-item');
  if (itemEl) itemEl.querySelector('span').textContent = statusIcon(newSt);
  // Mettre à jour classe du select
  selectEl.className = `status-select ${newSt}`;
  // Mettre en cache
  if (!_auditData[itemKey]) _auditData[itemKey] = {};
  _auditData[itemKey].statut   = newSt;
  _auditData[itemKey].categorie = catKey;
}

function onNotesChange(itemKey, val) {
  if (!_auditData[itemKey]) _auditData[itemKey] = {};
  _auditData[itemKey].notes = val;
}

/* ---- Sauvegarde de toute la checklist ---- */
async function saveAllAudit() {
  if (!currentContact) return;
  const { data: { user } } = await supa.auth.getUser();
  const now = new Date().toISOString();

  const upserts = [];
  for (const [catKey, cat] of Object.entries(CYBER_CATS)) {
    for (const item of cat.items) {
      const cached = _auditData[item.key] || {};
      upserts.push({
        contact_id: currentContact.id,
        categorie:  catKey,
        item_key:   item.key,
        statut:     cached.statut || 'non_verifie',
        notes:      cached.notes  || null,
        updated_at: now,
        created_by: user?.id,
      });
    }
  }

  const { error } = await supa.from('cyber_client_audits')
    .upsert(upserts, { onConflict: 'contact_id,item_key' });

  if (error) { toast('Erreur sauvegarde : ' + error.message, 'err'); return; }

  toast('Audit sauvegardé ✅');
  loadAudit(); // recalcul score
}

/* ---- Export PDF ---- */
async function exportAuditPDF() {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) { toast('jsPDF non disponible', 'err'); return; }

  const { score, catScores } = await computeScoreCyber(currentContact.id);
  const nom = currentContact.nom || currentContact.entreprise || 'Client';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 16;

  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(10,22,40);
  doc.text(`Audit Cybersécurité — ${nom}`, 14, y); y += 7;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,80);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} · Score global : ${score}%`, 14, y); y += 8;

  for (const [catKey, cat] of Object.entries(CYBER_CATS)) {
    if (y > 260) { doc.addPage(); y = 14; }
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(10,22,40);
    doc.text(`${cat.label} (${catScores[catKey]||0}%)`, 14, y); y += 5;

    for (const item of cat.items) {
      if (y > 270) { doc.addPage(); y = 14; }
      const row = _auditData[item.key] || {};
      const st  = row.statut || 'non_verifie';
      const ico = { conforme:'✓', partiel:'~', non_conforme:'✗', na:'N/A', non_verifie:'?' }[st] || '?';
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
      doc.setTextColor(st==='conforme'?34:st==='non_conforme'?200:80, st==='conforme'?180:80, 80);
      doc.text(`  [${ico}] ${item.label}`, 14, y);
      if (row.notes) {
        y += 4;
        doc.setTextColor(100,100,100); doc.setFontSize(7.5);
        doc.text(`       Note : ${row.notes}`, 14, y);
      }
      y += 5;
    }
    y += 3;
  }

  doc.save(`audit-cyber-${nom.replace(/[^a-z0-9]/gi,'_')}.pdf`);
}
