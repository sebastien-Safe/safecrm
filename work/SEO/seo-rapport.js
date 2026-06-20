/* ============================================================
   SEO Clients — Rapport mensuel PDF
   ============================================================ */

async function loadRapport() {
  if (!currentContact) return;
  const el = document.getElementById('rapport-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Préparation du rapport…</div>';

  const [
    { data: profile },
    { data: mcs },
    { data: audits },
  ] = await Promise.all([
    supa.from('seo_client_profiles').select('*').eq('contact_id', currentContact.id).maybeSingle(),
    supa.from('seo_client_mots_cles').select('*').eq('contact_id', currentContact.id).order('position_actuelle', { ascending: true, nullsFirst: false }),
    supa.from('seo_client_audits').select('*').eq('contact_id', currentContact.id),
  ]);

  const nom     = currentContact.nom || currentContact.entreprise || 'Client';
  const domaine = profile?.domaine || '—';
  const score   = profile?.score_global ?? 0;

  const list    = mcs    || [];
  const auditRows = audits || [];
  const top3    = list.filter(m => m.position_actuelle && m.position_actuelle <= 3).length;
  const top10   = list.filter(m => m.position_actuelle && m.position_actuelle <= 10).length;
  const gains   = list.filter(m => m.position_actuelle && m.position_precedente && m.position_precedente > m.position_actuelle).length;
  const pertes  = list.filter(m => m.position_actuelle && m.position_precedente && m.position_precedente < m.position_actuelle).length;

  const byKey = {};
  auditRows.forEach(r => { byKey[r.item_key] = r.statut; });
  const nonConformes = Object.entries(SEO_CATS).flatMap(([_, cat]) =>
    cat.items.filter(i => byKey[i.key] === 'non_conforme' || byKey[i.key] === 'partiel').map(i => i.label)
  );

  el.innerHTML = `
    <div class="card" style="margin-bottom:16px;border-color:rgba(16,185,129,.2)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-family:var(--ff-disp);font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:3px">
            Rapport mensuel SEO — ${escHtml(nom)}
          </div>
          <div style="font-size:.76rem;color:var(--seo);font-family:var(--ff-mono)">${escHtml(domaine)}</div>
        </div>
        <button class="btn btn-pri" onclick="genererRapportPDF()">📄 Générer le PDF</button>
      </div>
    </div>

    <div class="stats-row" style="grid-template-columns:repeat(6,1fr)">
      ${[
        [score + '%', 'Score SEO', scoreColor(score)],
        [list.length, 'Mots-clés', 'var(--seo)'],
        [top3,        'Top 3',    '#fbbf24'],
        [top10,       'Top 10',   'var(--ok)'],
        ['↑' + gains, 'Gains',    'var(--ok)'],
        ['↓' + pertes,'Pertes',   pertes > 0 ? 'var(--alert)' : 'var(--mut)'],
      ].map(([v,l,c]) => `
        <div class="stat-card">
          <div class="stat-val" style="color:${c};font-size:1.4rem">${v}</div>
          <div class="stat-lbl">${l}</div>
        </div>`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
      <!-- Meilleures positions -->
      <div class="card">
        <div class="card-header"><span class="card-title">— Meilleures positions</span></div>
        ${list.length ? `<table class="mc-table">
          <thead><tr><th>Mot-clé</th><th style="text-align:center">Pos.</th><th style="text-align:center">Évol.</th></tr></thead>
          <tbody>
            ${list.slice(0,10).map(m => {
              const pos = m.position_actuelle;
              const posCls = !pos ? 'pos-low' : pos <= 3 ? 'pos-1-3' : pos <= 10 ? 'pos-4-10' : pos <= 20 ? 'pos-11-20' : 'pos-low';
              return `<tr>
                <td style="font-size:.8rem;color:#fff;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(m.mot_cle)}</td>
                <td style="text-align:center"><span class="pos-val ${posCls}">${pos || '—'}</span></td>
                <td style="text-align:center">${positionEvolution(m.position_actuelle, m.position_precedente)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>` : '<div class="empty-state" style="padding:20px"><div class="ico">🔍</div><p>Aucun mot-clé suivi</p></div>'}
      </div>

      <!-- Améliorations prioritaires -->
      <div class="card">
        <div class="card-header"><span class="card-title">— Priorités d'amélioration</span></div>
        ${nonConformes.length ? `
          <ul style="list-style:none;display:flex;flex-direction:column;gap:6px">
            ${nonConformes.slice(0,8).map(r => `
              <li style="display:flex;align-items:flex-start;gap:8px;font-size:.8rem;color:var(--mut-2)">
                <span style="color:var(--alert);flex-shrink:0;margin-top:1px">→</span>${escHtml(r)}
              </li>`).join('')}
          </ul>` : `
          <div class="empty-state" style="padding:20px">
            <div class="ico">🎉</div><p>Aucune anomalie détectée</p>
          </div>`}
      </div>
    </div>

    <!-- Scores par catégorie -->
    <div class="card" style="margin-top:14px">
      <div class="card-header"><span class="card-title">— Détail par catégorie</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        ${await renderCatCards(byKey)}
      </div>
    </div>`;
}

async function renderCatCards(byKey) {
  let html = '';
  for (const [catKey, cat] of Object.entries(SEO_CATS)) {
    let sum = 0, total = 0;
    for (const item of cat.items) {
      const st = byKey[item.key] || 'non_verifie';
      if (st === 'na') continue;
      total++;
      if (st === 'conforme') sum++;
      else if (st === 'partiel') sum += 0.5;
    }
    const catScore = total > 0 ? Math.round((sum/total)*100) : 0;
    html += `
      <div style="background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:var(--r-sm);padding:12px 14px">
        <div style="font-size:.8rem;font-weight:700;color:#fff;margin-bottom:6px">${cat.icon} ${cat.label}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="score-bar-wrap" style="flex:1">
            <div class="score-bar" style="width:${catScore}%;background:${scoreColor(catScore)}"></div>
          </div>
          <span style="font-family:var(--ff-mono);font-size:.76rem;font-weight:700;color:${scoreColor(catScore)};min-width:32px;text-align:right">${catScore}%</span>
        </div>
        <div style="font-size:.7rem;color:var(--mut);margin-top:4px;font-family:var(--ff-mono)">${Math.round(cat.weight*100)}% du score global</div>
      </div>`;
  }
  return html;
}

async function genererRapportPDF() {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) { toast('jsPDF non disponible', 'err'); return; }

  const [{ data: profile }, { data: mcs }, { data: audits }] = await Promise.all([
    supa.from('seo_client_profiles').select('*').eq('contact_id', currentContact.id).maybeSingle(),
    supa.from('seo_client_mots_cles').select('*').eq('contact_id', currentContact.id).order('position_actuelle', { ascending: true, nullsFirst: false }),
    supa.from('seo_client_audits').select('*').eq('contact_id', currentContact.id),
  ]);

  const nom     = currentContact.nom || currentContact.entreprise || 'Client';
  const domaine = profile?.domaine || '—';
  const score   = profile?.score_global ?? 0;
  const mois    = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const list    = mcs || [];

  const byKey = {};
  (audits || []).forEach(r => { byKey[r.item_key] = r.statut; });

  const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
  let y = 0;

  // HEADER
  doc.setFillColor(10,22,40);
  doc.rect(0, 0, 210, 38, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(255,255,255);
  doc.text(`Rapport SEO — ${nom}`, 14, 15);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(200,200,200);
  doc.text(`${domaine}  ·  ${mois}  ·  Score global : ${score}%`, 14, 23);
  doc.text('S@FE CRM — Module SEO Clients', 14, 30);

  y = 48;
  // STATS
  const stats = [
    ['Score SEO', score + '%'],
    ['Mots-clés', list.length],
    ['Top 3',     list.filter(m => m.position_actuelle <= 3).length],
    ['Top 10',    list.filter(m => m.position_actuelle <= 10).length],
  ];
  const colW = 42;
  stats.forEach((s, i) => {
    const x = 14 + i * colW;
    doc.setFillColor(20,34,64); doc.roundedRect(x, y, colW-4, 22, 3, 3, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(255,255,255);
    doc.text(String(s[1]), x + (colW-4)/2, y + 10, { align:'center' });
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(148,163,184);
    doc.text(s[0], x + (colW-4)/2, y + 17, { align:'center' });
  });
  y += 30;

  // MOTS-CLÉS
  if (list.length) {
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(10,22,40);
    doc.text('Suivi des positions', 14, y); y += 6;

    const headers = ['Mot-clé', 'Type', 'Position', 'Précédente', 'Évolution', 'Volume/mois'];
    const colWidths = [65, 28, 22, 22, 22, 24];
    let x = 14;
    doc.setFillColor(20,34,64);
    doc.rect(14, y - 3, 182, 8, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(255,255,255);
    headers.forEach((h, i) => { doc.text(h, x + 2, y + 2); x += colWidths[i]; });
    y += 7;

    list.slice(0, 30).forEach((m, idx) => {
      if (y > 260) { doc.addPage(); y = 14; }
      if (idx % 2 === 0) { doc.setFillColor(245,247,250); doc.rect(14, y-3, 182, 7, 'F'); }
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(30,30,30);
      x = 14;
      const cells = [
        m.mot_cle.substring(0,32),
        { principal:'Principal', secondaire:'Secondaire', longue_queue:'Longue queue' }[m.type_mc] || m.type_mc,
        m.position_actuelle ? String(m.position_actuelle) : '—',
        m.position_precedente ? String(m.position_precedente) : '—',
        m.position_actuelle && m.position_precedente
          ? (m.position_precedente > m.position_actuelle ? '+' + (m.position_precedente - m.position_actuelle)
             : m.position_precedente < m.position_actuelle ? String(m.position_precedente - m.position_actuelle) : '=')
          : '—',
        m.volume_recherche ? m.volume_recherche.toLocaleString('fr-FR') : '—',
      ];
      cells.forEach((c, i) => {
        if (i === 4 && c.startsWith('+')) doc.setTextColor(34,150,34);
        else if (i === 4 && c.startsWith('-')) doc.setTextColor(200,50,50);
        else doc.setTextColor(30,30,30);
        doc.text(String(c), x + 2, y + 1);
        x += colWidths[i];
      });
      y += 7;
    });
  }
  y += 8;

  // SCORES PAR CAT
  if (y > 220) { doc.addPage(); y = 14; }
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(10,22,40);
  doc.text('Scores par catégorie', 14, y); y += 6;
  for (const [catKey, cat] of Object.entries(SEO_CATS)) {
    if (y > 270) { doc.addPage(); y = 14; }
    let sum = 0, total = 0;
    cat.items.forEach(item => {
      const st = byKey[item.key] || 'non_verifie';
      if (st === 'na') return;
      total++;
      if (st === 'conforme') sum += 1;
      else if (st === 'partiel') sum += 0.5;
    });
    const catScore = total > 0 ? Math.round((sum/total)*100) : 0;
    const barColor = catScore >= 80 ? [34,197,94] : catScore >= 50 ? [245,158,11] : [255,77,94];
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(30,30,30);
    doc.text(`${cat.label} (${Math.round(cat.weight*100)}%)`, 14, y + 2);
    doc.setFillColor(230,232,236); doc.rect(70, y - 1, 90, 5, 'F');
    doc.setFillColor(...barColor); doc.rect(70, y - 1, Math.round(catScore * 0.9), 5, 'F');
    doc.setFont('helvetica','bold'); doc.setTextColor(...barColor);
    doc.text(catScore + '%', 164, y + 2);
    y += 9;
  }
  y += 6;

  // RECOMMANDATIONS
  const recs = Object.entries(SEO_CATS).flatMap(([_, cat]) =>
    cat.items.filter(i => byKey[i.key] === 'non_conforme' || byKey[i.key] === 'partiel').map(i => ({
      label: i.label, statut: byKey[i.key],
    }))
  );
  if (recs.length) {
    if (y > 220) { doc.addPage(); y = 14; }
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(10,22,40);
    doc.text('Recommandations prioritaires', 14, y); y += 6;
    recs.slice(0,10).forEach(r => {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.setFont('helvetica','normal'); doc.setFontSize(8);
      const ico = r.statut === 'non_conforme' ? '✗' : '~';
      const c = r.statut === 'non_conforme' ? [200,50,50] : [180,120,0];
      doc.setTextColor(...c);
      const lines = doc.splitTextToSize(`[${ico}] ${r.label}`, 178);
      lines.forEach(l => { doc.text(l, 16, y); y += 4.5; });
    });
  }

  // FOOTER
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(150,150,150);
    doc.text(`S@FE CRM — Rapport SEO ${nom} — ${mois} — Page ${i}/${pageCount}`, 14, 292);
  }

  doc.save(`rapport-seo-${nom.replace(/[^a-z0-9]/gi,'_')}-${new Date().toISOString().slice(0,7)}.pdf`);
  toast('Rapport PDF généré ✅');
}
