/* Social Clients — Rapport mensuel + export PDF */

async function loadRapport() {
  if (!currentContact) return;
  const el = document.getElementById('rapport-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const now   = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const debut = new Date(y, m, 1).toISOString().slice(0, 10);
  const fin   = new Date(y, m + 1, 0).toISOString().slice(0, 10);

  const [{ data: allP }, { data: monthP }] = await Promise.all([
    supa.from('social_posts').select('*').eq('contact_id', currentContact.id),
    supa.from('social_posts').select('*').eq('contact_id', currentContact.id)
      .gte('date_publication', debut).lte('date_publication', fin),
  ]);

  const all       = allP  || [];
  const month     = monthP || [];
  const published = all.filter(p => p.statut === 'publie');
  const totalLikes = published.reduce((s, p) => s + (p.perf_likes || 0), 0);
  const totalReach = published.reduce((s, p) => s + (p.perf_reach || 0), 0);

  const byNet = {};
  all.forEach(p => {
    if (!byNet[p.reseau]) byNet[p.reseau] = { total:0, publie:0, likes:0 };
    byNet[p.reseau].total++;
    if (p.statut === 'publie') { byNet[p.reseau].publie++; byNet[p.reseau].likes += p.perf_likes || 0; }
  });

  const monthLabel = now.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <span class="eyebrow">Rapport mensuel</span>
        <h3 style="font-size:1rem;color:#fff;margin:0">Bilan — ${monthLabel}</h3>
      </div>
      <button class="btn btn-pri btn-sm" onclick="genererRapportPDF()">⬇ Télécharger PDF</button>
    </div>

    <div class="stats-row" style="margin-bottom:14px">
      <div class="stat-card"><div class="stat-val" style="color:var(--social)">${month.length}</div><div class="stat-lbl">Posts ce mois</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--ok)">${month.filter(p=>p.statut==='publie').length}</div><div class="stat-lbl">Publiés</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--warn)">❤️ ${totalLikes}</div><div class="stat-lbl">Likes total</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--mut-2)">👁 ${totalReach.toLocaleString('fr-FR')}</div><div class="stat-lbl">Reach total</div></div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">— Par réseau</span></div>
      ${Object.keys(byNet).length === 0
        ? '<p style="color:var(--mut);font-size:.8rem">Aucune donnée.</p>'
        : Object.entries(byNet).map(([k, v]) => {
            const net = RESEAUX[k] || { label:k, ico:'🌐', color:'var(--mut)' };
            const pct = v.total > 0 ? Math.round(v.publie / v.total * 100) : 0;
            return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <span style="font-size:1.1rem;color:${net.color};width:22px;text-align:center">${net.ico}</span>
              <div style="flex:1">
                <div style="font-size:.77rem;color:#fff;margin-bottom:3px">${net.label}</div>
                <div style="height:4px;background:rgba(255,255,255,.06);border-radius:2px">
                  <div style="height:100%;width:${pct}%;background:${net.color};border-radius:2px;transition:.4s"></div>
                </div>
              </div>
              <div style="font-family:var(--ff-mono);font-size:.68rem;color:var(--mut);text-align:right;min-width:85px">
                ${v.publie}/${v.total} publiés${v.likes ? '<br>❤️ '+v.likes : ''}
              </div>
            </div>`;
          }).join('')}
    </div>

    ${month.filter(p=>p.statut==='publie').length ? `
    <div class="card">
      <div class="card-header"><span class="card-title">— Posts publiés ce mois</span></div>
      ${month.filter(p=>p.statut==='publie').map(p => {
        const net = RESEAUX[p.reseau] || { ico:'🌐', label:p.reseau, color:'var(--mut)' };
        return `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--line2)">
          <span style="color:${net.color};font-size:1rem;flex-shrink:0">${net.ico}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:.77rem;color:var(--mut-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.texte||'—')}</div>
            <div style="font-size:.67rem;color:var(--mut);margin-top:1px">${fmtDate(p.date_publication)}</div>
          </div>
          <div style="font-family:var(--ff-mono);font-size:.67rem;color:var(--mut);flex-shrink:0">
            ${p.perf_likes ? `❤️${p.perf_likes}` : ''}${p.perf_reach ? ` 👁${p.perf_reach}` : ''}
          </div>
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
  doc.setFillColor(139, 92, 246); doc.rect(0, 0, 5, 38, 'F');

  doc.setTextColor(139, 92, 246); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
  doc.text('S@FE WORK — RAPPORT SOCIAL MEDIA', 12, 11);
  doc.setTextColor(255,255,255); doc.setFontSize(16);
  doc.text('Rapport Social Media', 12, 21);

  const nom = [currentContact.nom, currentContact.prenom].filter(Boolean).join(' ') || currentContact.entreprise || '—';
  doc.setFontSize(9.5); doc.setTextColor(203,213,225);
  doc.text(nom, 12, 29);
  doc.setFontSize(7.5); doc.setTextColor(148,163,184);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 12, 35);

  let y = 50;

  /* Data */
  const { data: allP } = await supa.from('social_posts').select('*').eq('contact_id', currentContact.id);
  const all = allP || [];
  const published = all.filter(p => p.statut === 'publie');
  const totalLikes = published.reduce((s,p) => s + (p.perf_likes||0), 0);
  const totalReach = published.reduce((s,p) => s + (p.perf_reach||0), 0);

  /* Stats boxes */
  [['Posts total', all.length],['Publiés', published.length],['Likes', totalLikes],['Reach', totalReach]].forEach(([lbl,val],i) => {
    const x = 12 + i * 47;
    doc.setFillColor(20,34,64); doc.roundedRect(x, y, 42, 20, 2, 2, 'F');
    doc.setTextColor(139,92,246); doc.setFont('helvetica','bold'); doc.setFontSize(13);
    doc.text(String(val), x+21, y+10, { align:'center' });
    doc.setFontSize(6.5); doc.setTextColor(148,163,184);
    doc.text(lbl, x+21, y+17, { align:'center' });
  });
  y += 30;

  /* By network */
  doc.setTextColor(139,92,246); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('PAR RÉSEAU', 12, y); y += 5;

  const byNet = {};
  all.forEach(p => {
    if (!byNet[p.reseau]) byNet[p.reseau] = { total:0, publie:0, likes:0 };
    byNet[p.reseau].total++;
    if (p.statut === 'publie') { byNet[p.reseau].publie++; byNet[p.reseau].likes += p.perf_likes||0; }
  });

  const NET_LABELS = { facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',x:'X/Twitter',gmb:'Google My Business' };
  Object.entries(byNet).forEach(([k,v]) => {
    doc.setTextColor(203,213,225); doc.setFontSize(7.5); doc.setFont('helvetica','normal');
    doc.text(`${NET_LABELS[k]||k} : ${v.publie}/${v.total} publiés${v.likes?' — ❤️ '+v.likes:''}`, 12, y);
    y += 5;
  });
  y += 5;

  /* Posts */
  if (published.length) {
    doc.setTextColor(139,92,246); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('POSTS PUBLIÉS', 12, y); y += 6;

    published.slice(0, 15).forEach(p => {
      if (y > 272) { doc.addPage(); y = 15; }
      const net = NET_LABELS[p.reseau] || p.reseau;
      const date = p.date_publication ? new Date(p.date_publication).toLocaleDateString('fr-FR') : '—';
      doc.setFillColor(20,34,64); doc.roundedRect(12, y, 186, 12, 1, 1, 'F');
      doc.setTextColor(203,213,225); doc.setFont('helvetica','bold'); doc.setFontSize(7);
      doc.text(`${net} — ${date}`, 15, y+4.5);
      doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184); doc.setFontSize(6.5);
      doc.text((p.texte||'(pas de texte)').substring(0,90), 15, y+9);
      y += 14;
    });
  }

  doc.save(`rapport-social-${nom.replace(/\s+/g,'-').toLowerCase()}-${today()}.pdf`);
  toast('PDF téléchargé ✓');
}
