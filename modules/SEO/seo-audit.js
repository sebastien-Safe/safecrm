/* ============================================================
   SEO Clients — Checklist d'audit SEO (25 points)
   ============================================================ */

let _seoAuditData = {};

async function loadSeoAudit() {
  if (!currentContact) return;
  const el = document.getElementById('audit-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Analyse en cours…</div>';

  let q = supa.from('seo_client_audits').select('*').eq('contact_id', currentContact.id);
  if (currentDomaine) {
    q = q.or(`domaine_id.eq.${currentDomaine.id},domaine_id.is.null`);
  }
  const { data: rows } = await q;
  _seoAuditData = {};
  (rows || []).forEach(r => { _seoAuditData[r.item_key] = r; });

  const { score, catScores } = await computeScoreSEO(currentContact.id, currentDomaine?.id);

  const scoreEl = document.getElementById('sidebar-score');
  if (scoreEl) { scoreEl.textContent = score + '%'; scoreEl.style.color = scoreColor(score); }

  const totalItems = Object.values(SEO_CATS).flatMap(c => c.items).length;
  const verified   = Object.values(_seoAuditData).filter(r => r.statut !== 'non_verifie').length;

  const domLabel = currentDomaine
    ? `<span style="font-size:.78rem;color:var(--seo);font-family:var(--ff-mono)">${escHtml(currentDomaine.domaine)}</span>`
    : '';

  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <div style="text-align:center;min-width:80px">
          <div style="font-family:var(--ff-disp);font-size:2.8rem;font-weight:800;
            color:${scoreColor(score)};line-height:1">${score}%</div>
          <div style="margin-top:6px">${scoreBadge(score)}</div>
          ${domLabel ? `<div style="margin-top:6px">${domLabel}</div>` : ''}
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:.75rem;color:var(--mut);margin-bottom:8px;font-family:var(--ff-mono)">
            ${verified}/${totalItems} points vérifiés
          </div>
          <div class="score-bar-wrap" style="margin-bottom:12px">
            <div class="score-bar" style="width:${Math.round((verified/totalItems)*100)}%;background:var(--seo)"></div>
          </div>
          ${Object.entries(SEO_CATS).map(([catKey, cat]) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
              <span style="font-size:.73rem;color:var(--mut);min-width:160px;
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cat.icon} ${cat.label}</span>
              <div class="score-bar-wrap" style="flex:1">
                <div class="score-bar" style="width:${catScores[catKey]||0}%;background:${scoreColor(catScores[catKey]||0)}"></div>
              </div>
              <span style="font-family:var(--ff-mono);font-size:.72rem;font-weight:700;
                color:${scoreColor(catScores[catKey]||0)};min-width:32px;text-align:right">${catScores[catKey]||0}%</span>
            </div>`).join('')}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn btn-pri btn-sm" onclick="saveAllSeoAudit()">💾 Sauvegarder</button>
          <button class="btn btn-ghost btn-sm" onclick="exportSeoAuditPDF()">📄 PDF</button>
        </div>
      </div>
    </div>

    ${Object.entries(SEO_CATS).map(([catKey, cat]) => renderSeoCatBlock(catKey, cat, catScores[catKey]||0)).join('')}`;
}

function renderSeoCatBlock(catKey, cat, catScore) {
  return `
    <div class="checklist-cat">
      <div class="checklist-cat-head">
        <span class="checklist-cat-label">${cat.icon} ${cat.label}
          <span style="font-size:.72rem;color:var(--mut);font-weight:400">(${Math.round(cat.weight*100)}%)</span>
        </span>
        <span class="checklist-cat-score" style="color:${scoreColor(catScore)}">${catScore}%</span>
      </div>
      <div class="checklist-items">
        ${cat.items.map(item => {
          const row    = _seoAuditData[item.key] || {};
          const statut = row.statut || 'non_verifie';
          return `
            <div class="checklist-item">
              <span style="font-size:.95rem;flex-shrink:0">${seoStatusIcon(statut)}</span>
              <span class="checklist-item-label">${escHtml(item.label)}</span>
              <select class="status-select ${statut}" id="st-${item.key}"
                onchange="onSeoStatusChange('${item.key}','${catKey}',this)">
                <option value="non_verifie" ${statut==='non_verifie'?'selected':''}>⚪ Non vérifié</option>
                <option value="conforme"    ${statut==='conforme'?'selected':''}>✅ Conforme</option>
                <option value="partiel"     ${statut==='partiel'?'selected':''}>🟡 Partiel</option>
                <option value="non_conforme"${statut==='non_conforme'?'selected':''}>❌ Non conforme</option>
                <option value="na"          ${statut==='na'?'selected':''}>➖ N/A</option>
              </select>
              <input class="checklist-notes-input" id="notes-${item.key}"
                value="${escHtml(row.notes||'')}" placeholder="Note…"
                onchange="onSeoNotesChange('${item.key}',this.value)">
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function seoStatusIcon(st) {
  return { conforme:'✅', partiel:'🟡', non_conforme:'❌', na:'➖', non_verifie:'⚪' }[st] || '⚪';
}

function onSeoStatusChange(itemKey, catKey, sel) {
  const newSt = sel.value;
  const itemEl = sel.closest('.checklist-item');
  if (itemEl) itemEl.querySelector('span').textContent = seoStatusIcon(newSt);
  sel.className = `status-select ${newSt}`;
  if (!_seoAuditData[itemKey]) _seoAuditData[itemKey] = {};
  _seoAuditData[itemKey].statut    = newSt;
  _seoAuditData[itemKey].categorie = catKey;
}

function onSeoNotesChange(itemKey, val) {
  if (!_seoAuditData[itemKey]) _seoAuditData[itemKey] = {};
  _seoAuditData[itemKey].notes = val;
}

async function saveAllSeoAudit() {
  if (!currentContact) return;
  const { data: { user } } = await supa.auth.getUser();
  const now = new Date().toISOString();
  const domaineId = currentDomaine?.id || null;

  const updates = [], inserts = [];
  for (const [catKey, cat] of Object.entries(SEO_CATS)) {
    for (const item of cat.items) {
      const cached = _seoAuditData[item.key] || {};
      const payload = {
        contact_id: currentContact.id,
        domaine_id: domaineId,
        categorie:  catKey,
        item_key:   item.key,
        statut:     cached.statut || 'non_verifie',
        notes:      cached.notes  || null,
        updated_at: now,
      };
      if (cached.id) {
        updates.push({ id: cached.id, ...payload });
      } else {
        inserts.push({ ...payload, created_by: user?.id });
      }
    }
  }

  const errors = [];
  for (const row of updates) {
    const { id, ...data } = row;
    const { error } = await supa.from('seo_client_audits').update(data).eq('id', id);
    if (error) errors.push(error.message);
  }
  if (inserts.length) {
    const { error } = await supa.from('seo_client_audits').insert(inserts);
    if (error) errors.push(error.message);
  }

  if (errors.length) { toast('Erreur : ' + errors[0], 'err'); return; }
  toast('Audit SEO sauvegardé ✅');
  loadSeoAudit();
}

async function exportSeoAuditPDF() {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) { toast('jsPDF non disponible', 'err'); return; }
  const { score, catScores } = await computeScoreSEO(currentContact.id, currentDomaine?.id);
  const nom = currentContact.nom || currentContact.entreprise || 'Client';
  const domTxt = currentDomaine?.domaine || '';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 16;
  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(10,22,40);
  doc.text(`Audit SEO — ${nom}`, 14, y); y += 7;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,80);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} · Score SEO global : ${score}%${domTxt?' · '+domTxt:''}`, 14, y); y += 9;

  for (const [catKey, cat] of Object.entries(SEO_CATS)) {
    if (y > 255) { doc.addPage(); y = 14; }
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(10,22,40);
    doc.text(`${cat.label} — ${catScores[catKey]||0}%`, 14, y); y += 5;
    for (const item of cat.items) {
      if (y > 270) { doc.addPage(); y = 14; }
      const row = _seoAuditData[item.key] || {};
      const st  = row.statut || 'non_verifie';
      const ico = { conforme:'✓', partiel:'~', non_conforme:'✗', na:'N/A', non_verifie:'?' }[st] || '?';
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
      const c = st==='conforme'?[34,150,34]:st==='non_conforme'?[200,50,50]:[80,80,80];
      doc.setTextColor(...c);
      const lines = doc.splitTextToSize(`  [${ico}] ${item.label}`, 170);
      lines.forEach(l => { doc.text(l, 14, y); y += 4.5; });
      if (row.notes) {
        doc.setTextColor(100,100,100); doc.setFontSize(7.5);
        doc.text(`       → ${row.notes}`, 14, y); y += 4;
      }
    }
    y += 4;
  }

  const nonConformes = [];
  for (const [, cat] of Object.entries(SEO_CATS)) {
    for (const item of cat.items) {
      const st = (_seoAuditData[item.key] || {}).statut;
      if (st === 'non_conforme' || st === 'partiel') nonConformes.push(item.label);
    }
  }
  if (nonConformes.length && y < 250) {
    if (y > 220) { doc.addPage(); y = 14; }
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(10,22,40);
    doc.text('Recommandations prioritaires', 14, y); y += 6;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(80,80,80);
    nonConformes.slice(0,8).forEach(r => {
      if (y > 270) { doc.addPage(); y = 14; }
      const lines = doc.splitTextToSize(`• ${r}`, 170);
      lines.forEach(l => { doc.text(l, 14, y); y += 4.5; });
    });
  }

  doc.save(`audit-seo-${nom.replace(/[^a-z0-9]/gi,'_')}${domTxt?'-'+domTxt.replace(/[^a-z0-9]/gi,'_'):''}.pdf`);
}
