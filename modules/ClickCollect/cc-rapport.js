/* Click & Collect — Rapport mensuel + PDF */

async function loadRapport() {
  if (!currentContact) return;
  const el = document.getElementById('rapport-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const debut = new Date(y, m, 1).toISOString().slice(0, 10);
  const fin   = new Date(y, m + 1, 0).toISOString().slice(0, 10);

  const [{ data: allC }, { data: monthC }, { data: prods }] = await Promise.all([
    supa.from('cc_commandes').select('*').eq('contact_id', currentContact.id),
    supa.from('cc_commandes').select('*').eq('contact_id', currentContact.id)
      .gte('created_at', debut).lte('created_at', fin+'T23:59:59Z'),
    supa.from('cc_produits').select('id,nom,prix').eq('contact_id', currentContact.id),
  ]);

  const all       = allC   || [];
  const month     = monthC || [];
  const prodsMap  = {};
  (prods || []).forEach(p => { prodsMap[p.id] = p; });

  const terminees = all.filter(c => ['confirme','pret','retire'].includes(c.statut));
  const caTotal   = terminees.reduce((s, c) => s + Number(c.total || 0), 0);
  const caMonth   = month.filter(c => ['confirme','pret','retire'].includes(c.statut))
                         .reduce((s, c) => s + Number(c.total || 0), 0);

  // Top produits
  const prodStats = {};
  all.forEach(c => {
    const items = Array.isArray(c.produits) ? c.produits : (typeof c.produits === 'string' ? JSON.parse(c.produits||'[]') : []);
    items.forEach(i => {
      const key = i.nom || i.produit_id || 'Inconnu';
      if (!prodStats[key]) prodStats[key] = { qte:0, ca:0 };
      prodStats[key].qte += i.qte || 1;
      prodStats[key].ca  += (i.prix || 0) * (i.qte || 1);
    });
  });
  const topProd = Object.entries(prodStats).sort((a,b) => b[1].ca - a[1].ca).slice(0, 5);

  // Par statut ce mois
  const byStatut = {};
  month.forEach(c => {
    if (!byStatut[c.statut]) byStatut[c.statut] = { nb:0, total:0 };
    byStatut[c.statut].nb++;
    byStatut[c.statut].total += Number(c.total||0);
  });

  const monthLabel = now.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <span class="eyebrow">Rapport mensuel</span>
        <h3 style="font-size:1rem;color:#fff;margin:0">Bilan Click & Collect — ${monthLabel}</h3>
      </div>
      <button class="btn btn-pri btn-sm" onclick="genererRapportPDF()">⬇ Télécharger PDF</button>
    </div>

    <div class="stats-row" style="margin-bottom:14px">
      <div class="stat-card"><div class="stat-val" style="color:var(--cc)">${month.length}</div><div class="stat-lbl">Commandes ce mois</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--ok);font-size:1.3rem">${fmtEur(caMonth)}</div><div class="stat-lbl">CA ce mois</div></div>
      <div class="stat-card"><div class="stat-val">${all.length}</div><div class="stat-lbl">Total commandes</div></div>
      <div class="stat-card"><div class="stat-val" style="font-size:1.3rem">${fmtEur(caTotal)}</div><div class="stat-lbl">CA total</div></div>
    </div>

    <div class="grid-2" style="gap:12px;margin-bottom:14px">
      <!-- Statuts ce mois -->
      <div class="card">
        <div class="card-header"><span class="card-title">— Commandes par statut</span></div>
        ${Object.keys(CC_STATUTS).map(k => {
          const s = CC_STATUTS[k];
          const d = byStatut[k] || { nb:0, total:0 };
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line2)">
            <span class="badge ${s.cls}">${s.label}</span>
            <div style="font-family:var(--ff-mono);font-size:.7rem;color:var(--mut);text-align:right">
              ${d.nb} cmd${d.nb>1?'s':''} · ${fmtEur(d.total)}
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Top produits -->
      <div class="card">
        <div class="card-header"><span class="card-title">— Top produits</span></div>
        ${topProd.length === 0
          ? '<p style="color:var(--mut);font-size:.8rem">Aucune donnée.</p>'
          : topProd.map(([nom, v]) => `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line2)">
              <div style="flex:1;font-size:.78rem;color:var(--mut-2)">${escHtml(nom)}</div>
              <div style="font-family:var(--ff-mono);font-size:.7rem;color:var(--mut);text-align:right">
                ×${v.qte} · ${fmtEur(v.ca)}
              </div>
            </div>`).join('')}
      </div>
    </div>

    <!-- Commandes du mois -->
    ${month.length ? `
    <div class="card">
      <div class="card-header"><span class="card-title">— Commandes ce mois</span></div>
      ${month.map(c => {
        const st = CC_STATUTS[c.statut] || { label:c.statut, cls:'st-attente' };
        return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line2)">
          <span class="badge ${st.cls}" style="flex-shrink:0">${st.label}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:.8rem;color:#fff">${escHtml(c.client_nom||'—')}</div>
            <div style="font-size:.68rem;color:var(--mut)">${escHtml(c.reference||'')} · ${fmtDate(c.created_at?.slice(0,10))}</div>
          </div>
          <div style="font-family:var(--ff-mono);font-size:.82rem;color:var(--cc);font-weight:700;flex-shrink:0">${fmtEur(c.total)}</div>
        </div>`;
      }).join('')}
    </div>` : ''}`;
}

async function genererRapportPDF() {
  if (!currentContact) return;
  if (!window.jspdf) { toast('jsPDF non disponible', true); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' });

  /* Header */
  doc.setFillColor(10, 22, 40); doc.rect(0, 0, 210, 38, 'F');
  doc.setFillColor(236, 72, 153); doc.rect(0, 0, 5, 38, 'F');
  doc.setTextColor(236, 72, 153); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
  doc.text('S@FE WORK — RAPPORT CLICK & COLLECT', 12, 11);
  doc.setTextColor(255,255,255); doc.setFontSize(15);
  doc.text('Rapport Click & Collect', 12, 21);
  const nom = [currentContact.nom, currentContact.prenom].filter(Boolean).join(' ') || currentContact.entreprise || '—';
  doc.setFontSize(9.5); doc.setTextColor(203,213,225); doc.text(nom, 12, 29);
  doc.setFontSize(7.5); doc.setTextColor(148,163,184);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 12, 35);

  let y = 50;

  /* Fetch data */
  const now = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const fin   = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
  const [{ data: allC }, { data: monthC }] = await Promise.all([
    supa.from('cc_commandes').select('*').eq('contact_id', currentContact.id),
    supa.from('cc_commandes').select('*').eq('contact_id', currentContact.id)
      .gte('created_at', debut).lte('created_at', fin+'T23:59:59Z'),
  ]);
  const all = allC||[], month = monthC||[];
  const caTotal = all.filter(c=>['confirme','pret','retire'].includes(c.statut)).reduce((s,c)=>s+Number(c.total||0),0);
  const caMonth = month.filter(c=>['confirme','pret','retire'].includes(c.statut)).reduce((s,c)=>s+Number(c.total||0),0);

  /* Stats boxes */
  [[`Commandes ce mois`, month.length],[`CA ce mois`, fmtEur(caMonth)],[`Total commandes`, all.length],[`CA total`, fmtEur(caTotal)]].forEach(([lbl,val],i) => {
    const x = 12 + i*47;
    doc.setFillColor(20,34,64); doc.roundedRect(x, y, 42, 22, 2, 2, 'F');
    doc.setTextColor(236,72,153); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text(String(val), x+21, y+11, { align:'center' });
    doc.setFontSize(6); doc.setTextColor(148,163,184);
    doc.text(lbl, x+21, y+18, { align:'center' });
  });
  y += 32;

  /* Commandes du mois */
  if (month.length) {
    doc.setTextColor(236,72,153); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('COMMANDES DU MOIS', 12, y); y += 6;

    month.forEach(c => {
      if (y > 272) { doc.addPage(); y = 15; }
      const stLbl = CC_STATUTS[c.statut]?.label || c.statut;
      doc.setFillColor(20,34,64); doc.roundedRect(12, y, 186, 12, 1, 1, 'F');
      doc.setTextColor(203,213,225); doc.setFont('helvetica','bold'); doc.setFontSize(7);
      doc.text(`${c.reference||c.id.slice(0,8)} — ${c.client_nom||'—'}`, 15, y+4.5);
      doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184); doc.setFontSize(6.5);
      doc.text(`${stLbl} · ${fmtDate(c.created_at?.slice(0,10))} · ${fmtEur(c.total)}`, 15, y+9);
      y += 14;
    });
  }

  doc.save(`rapport-cc-${nom.replace(/\s+/g,'-').toLowerCase()}-${today()}.pdf`);
  toast('PDF téléchargé ✓');
}
