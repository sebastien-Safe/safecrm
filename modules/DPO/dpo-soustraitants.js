/* ============================================================
   DPO — Sous-traitants & DPA (Art.28 RGPD)
   ============================================================ */

const SST_STATUTS = ['À signer', 'Signé', 'Expiré', 'Résilié'];

const SST_STATUT_STYLE = {
  'À signer': { bg: 'var(--bg-warn)',   bd: 'var(--bd-warn)',   tx: 'var(--tx-warn)'   },
  'Signé':    { bg: 'var(--bg-ok)',     bd: 'var(--bd-ok)',     tx: 'var(--tx-ok)'     },
  'Expiré':   { bg: 'var(--bg-danger)', bd: 'var(--bd-danger)', tx: 'var(--tx-danger)' },
  'Résilié':  { bg: 'rgba(100,100,100,.12)', bd: 'rgba(150,150,150,.3)', tx: 'var(--tx-3)' },
};

/* ── Liste ──────────────────────────────────────────────── */

async function loadSoustraitants() {
  const el = document.getElementById('sst-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const { data, error } = await supa
    .from('dpo_soustraitants')
    .select('*')
    .order('statut_dpa', { ascending: true })
    .order('nom', { ascending: true });

  if (error) {
    el.innerHTML = `<div class="empty-state" style="color:var(--tx-danger)">${error.message}</div>`;
    return;
  }

  if (!data?.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="ico">🤝</div>
        <p>Aucun sous-traitant enregistré.<br>Cliquez sur <strong>+ Nouveau sous-traitant</strong> pour commencer votre registre Art.28.</p>
      </div>`;
    return;
  }

  const actifs   = data.filter(s => s.statut_dpa !== 'Résilié');
  const resilies = data.filter(s => s.statut_dpa === 'Résilié');

  const renderGroup = (list) => list.map(s => renderSSTCard(s)).join('');

  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title">— Sous-traitants actifs (${actifs.length})</span></div>
      ${actifs.length
        ? `<div class="item-list">${renderGroup(actifs)}</div>`
        : '<div class="empty-state" style="padding:16px"><p>Aucun sous-traitant actif.</p></div>'}
    </div>
    ${resilies.length ? `
    <div class="card">
      <div class="card-header"><span class="card-title">— Résiliés (${resilies.length})</span></div>
      <div class="item-list">${renderGroup(resilies)}</div>
    </div>` : ''}`;
}

function renderSSTCard(s) {
  const style = SST_STATUT_STYLE[s.statut_dpa] || SST_STATUT_STYLE['À signer'];
  const today = new Date();
  let alertBadge = '';
  if (s.date_expiration_dpa) {
    const exp = new Date(s.date_expiration_dpa);
    const diff = Math.ceil((exp - today) / 86400000);
    if (diff < 0)        alertBadge = `<span class="badge" style="background:var(--bg-danger);color:var(--tx-danger);border:1px solid var(--bd-danger);font-size:.6rem">DPA expiré</span>`;
    else if (diff <= 30) alertBadge = `<span class="badge" style="background:var(--bg-warn);color:var(--tx-warn);border:1px solid var(--bd-warn);font-size:.6rem">Expire J-${diff}</span>`;
  }
  return `
    <div class="item-row" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line)">
      <div style="min-width:72px">
        <span class="badge" style="background:${style.bg};color:${style.tx};border:1px solid ${style.bd};font-size:.65rem;white-space:nowrap">${s.statut_dpa}</span>
        ${alertBadge}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:#fff;font-size:.9rem">${escHtml(s.nom)}${s.siren ? ` <span style="color:var(--tx-3);font-size:.72rem;font-family:var(--ff-mono)">${escHtml(s.siren)}</span>` : ''}</div>
        <div style="font-size:.75rem;color:var(--tx-2);margin-top:2px">${escHtml(s.service)} · ${escHtml(s.lieu_traitement)}${s.pays_hors_ue ? ' 🌍' : ''}</div>
      </div>
      <div style="font-size:.72rem;color:var(--tx-3);white-space:nowrap;text-align:right">
        ${s.date_dpa_signe ? `Signé ${fmtDate(s.date_dpa_signe)}` : '—'}<br>
        ${s.date_expiration_dpa ? `Exp. ${fmtDate(s.date_expiration_dpa)}` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="previewDPA('${s.id}')">Aperçu DPA</button>
        <button class="btn btn-ghost btn-sm" onclick="exportDPAPdf('${s.id}')">PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="openEditSSTModal('${s.id}')">Modifier</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--tx-danger)" onclick="deleteSST('${s.id}')">✕</button>
      </div>
    </div>`;
}

/* ── Modal création ─────────────────────────────────────── */

function openSSTModal(prefill = {}) {
  const isEdit = !!prefill.id;
  document.getElementById('modal-title-text').textContent = isEdit
    ? `Modifier — ${prefill.nom}`
    : 'Nouveau sous-traitant — Art.28 RGPD';

  document.getElementById('modal-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

      <div class="form-group">
        <label class="form-label">Raison sociale *</label>
        <input class="form-input" id="sst-nom" value="${escHtml(prefill.nom||'')}" placeholder="Ex : Mailchimp / Intuit Inc.">
      </div>
      <div class="form-group">
        <label class="form-label">SIREN / identifiant</label>
        <input class="form-input" id="sst-siren" value="${escHtml(prefill.siren||'')}" placeholder="Ex : 123 456 789">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Service / prestation fournie *</label>
        <input class="form-input" id="sst-service" value="${escHtml(prefill.service||'')}" placeholder="Ex : Plateforme d'emailing, hébergement cloud, CRM…">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Catégories de données traitées *</label>
        <input class="form-input" id="sst-categories" value="${escHtml((prefill.categories_donnees||[]).join(', '))}" placeholder="Ex : Noms, emails, données comportementales">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Finalités du traitement</label>
        <textarea class="form-textarea" id="sst-finalites" placeholder="Une finalité par ligne">${(prefill.finalites||[]).join('\n')}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Lieu de traitement *</label>
        <input class="form-input" id="sst-lieu" value="${escHtml(prefill.lieu_traitement||'')}" placeholder="Ex : France, Union Européenne, USA…">
      </div>
      <div class="form-group" style="display:flex;flex-direction:column;gap:6px">
        <label class="form-label">Transfert hors UE/EEE</label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:6px">
          <input type="checkbox" id="sst-hors-ue" style="width:16px;height:16px" ${prefill.pays_hors_ue?'checked':''} onchange="toggleGaranties(this.checked)">
          <span style="font-size:.85rem">Des données sont traitées hors UE/EEE</span>
        </label>
      </div>

      <div class="form-group" id="sst-garanties-wrap" style="display:${prefill.pays_hors_ue?'block':'none'};grid-column:1/-1">
        <label class="form-label">Garanties de transfert (Art.46)</label>
        <input class="form-input" id="sst-garanties" value="${escHtml(prefill.garanties_transfert||'')}" placeholder="Ex : Clauses contractuelles types UE (CCT), décision d'adéquation…">
      </div>

      <div class="form-group">
        <label class="form-label">Contact RGPD / DPO sous-traitant</label>
        <input class="form-input" id="sst-contact" value="${escHtml(prefill.contact_rgpd||'')}" placeholder="Nom, email…">
      </div>
      <div class="form-group">
        <label class="form-label">Statut DPA *</label>
        <select class="form-select" id="sst-statut">
          ${SST_STATUTS.map(s => `<option value="${s}" ${(prefill.statut_dpa||'À signer')===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Date de signature DPA</label>
        <input class="form-input" type="date" id="sst-date-sign" value="${prefill.date_dpa_signe||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Date d'expiration DPA</label>
        <input class="form-input" type="date" id="sst-date-exp" value="${prefill.date_expiration_dpa||''}">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Sous-sous-traitants autorisés (Art.28.2)</label>
        <input class="form-input" id="sst-subsst" value="${escHtml(prefill.sous_sous_traitants||'')}" placeholder="Ex : AWS (hébergement), SendGrid (emails)…">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Mesures de sécurité Art.32</label>
        <textarea class="form-textarea" id="sst-securite" placeholder="Ex : Chiffrement TLS, ISO 27001, SOC2…">${prefill.mesures_securite||''}</textarea>
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Obligations spécifiques contractuelles</label>
        <textarea class="form-textarea" id="sst-obligations" placeholder="Ex : Assistance aux droits des personnes, notification violations sous 48h…">${prefill.obligations_specifiques||''}</textarea>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:20px">
      <button class="btn btn-pri" onclick="${isEdit ? `updateSST('${prefill.id}')` : 'saveSST()'}" style="flex:1">
        ${isEdit ? 'Enregistrer les modifications' : 'Enregistrer le sous-traitant'}
      </button>
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    </div>`;
  openModal();
}

function toggleGaranties(checked) {
  const w = document.getElementById('sst-garanties-wrap');
  if (w) w.style.display = checked ? 'block' : 'none';
}

function collectSSTForm() {
  return {
    nom:                   document.getElementById('sst-nom')?.value?.trim(),
    siren:                 document.getElementById('sst-siren')?.value?.trim() || null,
    service:               document.getElementById('sst-service')?.value?.trim(),
    categories_donnees:    (document.getElementById('sst-categories')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
    finalites:             (document.getElementById('sst-finalites')?.value||'').split('\n').map(s=>s.trim()).filter(Boolean),
    lieu_traitement:       document.getElementById('sst-lieu')?.value?.trim(),
    pays_hors_ue:          document.getElementById('sst-hors-ue')?.checked || false,
    garanties_transfert:   document.getElementById('sst-garanties')?.value?.trim() || null,
    contact_rgpd:          document.getElementById('sst-contact')?.value?.trim() || null,
    statut_dpa:            document.getElementById('sst-statut')?.value,
    date_dpa_signe:        document.getElementById('sst-date-sign')?.value || null,
    date_expiration_dpa:   document.getElementById('sst-date-exp')?.value || null,
    sous_sous_traitants:   document.getElementById('sst-subsst')?.value?.trim() || null,
    mesures_securite:      document.getElementById('sst-securite')?.value?.trim() || null,
    obligations_specifiques: document.getElementById('sst-obligations')?.value?.trim() || null,
  };
}

async function saveSST() {
  const row = collectSSTForm();
  if (!row.nom)             { toast('Raison sociale requise', 'error'); return; }
  if (!row.service)         { toast('Service requis', 'error'); return; }
  if (!row.lieu_traitement) { toast('Lieu de traitement requis', 'error'); return; }
  row.dpa_html = buildDPAHtml(row);
  const { error } = await supa.from('dpo_soustraitants').insert([row]);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  closeModal(); loadSoustraitants(); updateSidebarCounts();
  toast('Sous-traitant enregistré', 'success');
}

async function openEditSSTModal(id) {
  const { data: s } = await supa.from('dpo_soustraitants').select('*').eq('id', id).single();
  if (!s) return;
  openSSTModal(s);
}

async function updateSST(id) {
  const row = collectSSTForm();
  if (!row.nom)             { toast('Raison sociale requise', 'error'); return; }
  if (!row.service)         { toast('Service requis', 'error'); return; }
  if (!row.lieu_traitement) { toast('Lieu de traitement requis', 'error'); return; }
  row.dpa_html = buildDPAHtml(row);
  const { error } = await supa.from('dpo_soustraitants').update(row).eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  closeModal(); loadSoustraitants();
  toast('Mis à jour', 'success');
}

/* ── Générateur DPA HTML ────────────────────────────────── */

function buildDPAHtml(s) {
  const today = new Date().toLocaleDateString('fr-FR');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#222;max-width:720px">
<h2 style="font-size:18px;margin-bottom:4px">Accord de sous-traitance des données personnelles</h2>
<p style="font-size:12px;color:#666;margin-bottom:4px">Conformément à l'article 28 du Règlement (UE) 2016/679 (RGPD)</p>
<p style="font-size:12px;color:#666;margin-bottom:20px">Document généré le ${today}</p>

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px">1. Parties</h3>
<p><strong>Responsable du traitement :</strong> S@FE SAS — SIRET 104 699 558 00011</p>
<p><strong>Sous-traitant :</strong> ${escHtml(s.nom)}${s.siren ? ` — SIREN ${escHtml(s.siren)}` : ''}</p>
${s.contact_rgpd ? `<p><strong>Contact RGPD sous-traitant :</strong> ${escHtml(s.contact_rgpd)}</p>` : ''}

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">2. Objet et durée</h3>
<p><strong>Prestation :</strong> ${escHtml(s.service)}</p>
${s.finalites?.length ? `<p><strong>Finalités :</strong></p><ul>${s.finalites.map(f=>`<li>${escHtml(f)}</li>`).join('')}</ul>` : ''}
${s.date_dpa_signe ? `<p><strong>Date de prise d'effet :</strong> ${fmtDate(s.date_dpa_signe)}</p>` : ''}
${s.date_expiration_dpa ? `<p><strong>Durée :</strong> jusqu'au ${fmtDate(s.date_expiration_dpa)}</p>` : ''}

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">3. Nature des données traitées</h3>
<p><strong>Catégories de données :</strong> ${escHtml((s.categories_donnees||[]).join(', '))}</p>
<p><strong>Lieu de traitement :</strong> ${escHtml(s.lieu_traitement)}</p>
${s.pays_hors_ue ? `<p><strong>Transfert hors UE/EEE :</strong> Oui — ${escHtml(s.garanties_transfert||'Garanties à préciser')}</p>` : ''}

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">4. Obligations du sous-traitant (Art.28.3)</h3>
<ul>
  <li>Traiter les données uniquement sur instruction documentée du responsable du traitement</li>
  <li>Garantir que les personnes habilitées s'engagent à respecter la confidentialité</li>
  <li>Mettre en œuvre les mesures de sécurité requises par l'Art.32 du RGPD</li>
  <li>Respecter les conditions pour faire appel à un autre sous-traitant (Art.28.2)</li>
  <li>Aider le responsable du traitement à répondre aux demandes d'exercice des droits</li>
  <li>Aider le responsable à assurer le respect des obligations Art.32 à 36</li>
  <li>Supprimer ou restituer toutes les données à l'issue de la prestation</li>
  <li>Mettre à disposition toutes les informations nécessaires pour démontrer la conformité</li>
</ul>
${s.obligations_specifiques ? `<p><strong>Obligations spécifiques :</strong> ${escHtml(s.obligations_specifiques)}</p>` : ''}

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">5. Mesures de sécurité (Art.32)</h3>
<p>${escHtml(s.mesures_securite||'À compléter par le sous-traitant.')}</p>

${s.sous_sous_traitants ? `<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">6. Sous-sous-traitants autorisés (Art.28.2)</h3>
<p>${escHtml(s.sous_sous_traitants)}</p>` : ''}

<div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
  <div>
    <p style="font-size:12px;color:#888">Pour le Responsable du traitement</p>
    <div style="border-bottom:1px solid #ccc;margin-top:40px;margin-bottom:4px"></div>
    <p style="font-size:12px">Nom, qualité, date, signature</p>
  </div>
  <div>
    <p style="font-size:12px;color:#888">Pour le Sous-traitant — ${escHtml(s.nom)}</p>
    <div style="border-bottom:1px solid #ccc;margin-top:40px;margin-bottom:4px"></div>
    <p style="font-size:12px">Nom, qualité, date, signature</p>
  </div>
</div>
</div>`;
}

/* ── Aperçu DPA ─────────────────────────────────────────── */

async function previewDPA(id) {
  const { data: s } = await supa.from('dpo_soustraitants').select('*').eq('id', id).single();
  if (!s) return;
  document.getElementById('modal-title-text').textContent = `DPA — ${s.nom}`;
  document.getElementById('modal-content').innerHTML = `
    <div style="background:#fff;border-radius:8px;padding:20px;max-height:60vh;overflow-y:auto">
      ${s.dpa_html || buildDPAHtml(s)}
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-ghost btn-sm" onclick="exportDPAPdf('${id}')">Exporter PDF</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Fermer</button>
    </div>`;
  openModal();
}

/* ── Export PDF ─────────────────────────────────────────── */

async function exportDPAPdf(id) {
  const { data: s } = await supa.from('dpo_soustraitants').select('*').eq('id', id).single();
  if (!s) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  const lm = 14; const pw = 182;

  const txt = (t, opts = {}) => {
    doc.setFontSize(opts.size || 10);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(opts.color || 30);
    const lines = doc.splitTextToSize(String(t), pw - (opts.indent || 0) * 5);
    if (y + lines.length * (opts.size || 10) * 0.42 > 280) { doc.addPage(); y = 16; }
    doc.text(lines, lm + (opts.indent || 0) * 5, y);
    y += lines.length * (opts.size || 10) * 0.42 + (opts.after !== undefined ? opts.after : 3);
  };

  const sep = () => { if (y > 270) { doc.addPage(); y = 16; } doc.setDrawColor(200); doc.line(lm, y, lm + pw, y); y += 5; };

  doc.setFillColor(6, 13, 31);
  doc.rect(0, 0, 210, 14, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255);
  doc.text('ACCORD DE SOUS-TRAITANCE — ART.28 RGPD', lm, 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180);
  doc.text(new Date().toLocaleDateString('fr-FR'), 196, 9, { align: 'right' });

  y = 22;
  txt('Accord de sous-traitance des données personnelles', { size: 14, bold: true, color: 10, after: 2 });
  txt('Conformément à l\'article 28 du Règlement (UE) 2016/679 (RGPD)', { size: 9, color: 100, after: 6 });

  sep();
  txt('1. Parties', { size: 11, bold: true, after: 3 });
  txt('Responsable du traitement : S@FE SAS — SIRET 104 699 558 00011', { after: 2 });
  txt(`Sous-traitant : ${s.nom}${s.siren ? ` — SIREN ${s.siren}` : ''}`, { after: 2 });
  if (s.contact_rgpd) txt(`Contact RGPD : ${s.contact_rgpd}`, { after: 2 });

  sep();
  txt('2. Objet et durée', { size: 11, bold: true, after: 3 });
  txt(`Prestation : ${s.service}`, { after: 2 });
  if (s.finalites?.length) { txt('Finalités :', { after: 1 }); s.finalites.forEach(f => txt(`• ${f}`, { indent: 1, after: 1 })); }
  if (s.date_dpa_signe)      txt(`Prise d'effet : ${fmtDate(s.date_dpa_signe)}`, { after: 2 });
  if (s.date_expiration_dpa) txt(`Expiration : ${fmtDate(s.date_expiration_dpa)}`, { after: 2 });

  sep();
  txt('3. Nature des données traitées', { size: 11, bold: true, after: 3 });
  txt(`Catégories : ${(s.categories_donnees||[]).join(', ')}`, { after: 2 });
  txt(`Lieu de traitement : ${s.lieu_traitement}`, { after: 2 });
  if (s.pays_hors_ue) txt(`Transfert hors UE/EEE : Oui — ${s.garanties_transfert||'Garanties à préciser'}`, { after: 2 });

  sep();
  txt('4. Obligations du sous-traitant (Art.28.3)', { size: 11, bold: true, after: 3 });
  const obligations = [
    'Traiter les données uniquement sur instruction documentée du RT',
    'Garantir la confidentialité des personnes habilitées',
    'Mettre en œuvre les mesures de sécurité Art.32',
    'Respecter les conditions de recours à un sous-traitant ultérieur (Art.28.2)',
    'Aider le RT à répondre aux demandes d\'exercice des droits',
    'Supprimer ou restituer toutes les données à l\'issue de la prestation',
    'Mettre à disposition toutes informations nécessaires à la conformité',
  ];
  obligations.forEach(o => txt(`• ${o}`, { indent: 1, after: 1 }));
  if (s.obligations_specifiques) { y += 2; txt(`Obligations spécifiques : ${s.obligations_specifiques}`, { after: 2 }); }

  sep();
  txt('5. Mesures de sécurité (Art.32)', { size: 11, bold: true, after: 3 });
  txt(s.mesures_securite || 'À compléter par le sous-traitant.', { after: 3 });

  if (s.sous_sous_traitants) {
    sep();
    txt('6. Sous-sous-traitants autorisés', { size: 11, bold: true, after: 3 });
    txt(s.sous_sous_traitants, { after: 3 });
  }

  if (y > 240) { doc.addPage(); y = 20; } else { y += 10; }
  sep();
  txt('Signatures', { size: 11, bold: true, after: 10 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100);
  doc.text('Responsable du traitement', lm, y);
  doc.text(`Sous-traitant — ${s.nom}`, lm + 95, y);
  y += 25;
  doc.setDrawColor(180); doc.line(lm, y, lm + 80, y); doc.line(lm + 95, y, lm + 175, y);
  y += 5;
  doc.setFontSize(8); doc.text('Nom, qualité, date, signature', lm, y);
  doc.text('Nom, qualité, date, signature', lm + 95, y);

  doc.save(`dpa-art28-${s.nom.replace(/\s+/g,'-').toLowerCase()}.pdf`);
  toast('PDF DPA téléchargé', 'success');
}

/* ── Suppression ────────────────────────────────────────── */

async function deleteSST(id) {
  if (!confirm('Supprimer ce sous-traitant et son DPA ?')) return;
  const { error } = await supa.from('dpo_soustraitants').delete().eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  loadSoustraitants(); updateSidebarCounts();
  toast('Supprimé', 'success');
}
