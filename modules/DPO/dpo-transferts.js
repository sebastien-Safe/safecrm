/* ============================================================
   DPO — Transferts hors UE/EEE (Art.44-49 RGPD)
   ============================================================ */

const TRF_MECANISMES = [
  { val: 'Décision d\'adéquation (Art.45)',                    art: '45', risk: 'low'  },
  { val: 'Clauses contractuelles types — CCT (Art.46.2.c)',    art: '46', risk: 'low'  },
  { val: 'Règles d\'entreprise contraignantes — BCR (Art.47)', art: '47', risk: 'low'  },
  { val: 'Code de conduite approuvé (Art.46.2.e)',             art: '46', risk: 'low'  },
  { val: 'Certification approuvée (Art.46.2.f)',               art: '46', risk: 'low'  },
  { val: 'Consentement explicite (Art.49.1.a)',                art: '49', risk: 'med'  },
  { val: 'Exécution d\'un contrat (Art.49.1.b)',               art: '49', risk: 'med'  },
  { val: 'Intérêt public (Art.49.1.d)',                        art: '49', risk: 'med'  },
  { val: 'Constatation / défense de droits (Art.49.1.e)',      art: '49', risk: 'med'  },
  { val: 'Aucune garantie — à régulariser',                    art: '—',  risk: 'high' },
];

const TRF_STATUT_STYLE = {
  'Actif':          { bg: 'var(--bg-ok)',     bd: 'var(--bd-ok)',     tx: 'var(--tx-ok)'     },
  'À régulariser':  { bg: 'var(--bg-danger)', bd: 'var(--bd-danger)', tx: 'var(--tx-danger)' },
  'Suspendu':       { bg: 'var(--bg-warn)',   bd: 'var(--bd-warn)',   tx: 'var(--tx-warn)'   },
  'Clôturé':        { bg: 'rgba(100,100,100,.12)', bd: 'rgba(150,150,150,.3)', tx: 'var(--tx-3)' },
};

/* Pays avec décision d'adéquation CEPD (liste 2024) */
const PAYS_ADEQUATION = [
  'Andorre','Argentine','Canada (secteur commercial)','Îles Féroé','Guernesey','Israël',
  'Île de Man','Japon','Jersey','Nouvelle-Zélande','République de Corée','Royaume-Uni',
  'Suisse','Uruguay','États-Unis (DPF)',
];

/* ── Liste ──────────────────────────────────────────────── */

async function loadTransferts() {
  const el = document.getElementById('trf-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const { data, error } = await supa
    .from('dpo_transferts')
    .select('*')
    .order('statut', { ascending: true })
    .order('pays_destination', { ascending: true });

  if (error) {
    el.innerHTML = `<div class="empty-state" style="color:var(--tx-danger)">${error.message}</div>`;
    return;
  }

  if (!data?.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="ico">🌍</div>
        <p>Aucun transfert hors UE enregistré.<br>Cliquez sur <strong>+ Nouveau transfert</strong> pour documenter vos flux de données internationaux.</p>
      </div>`;
    return;
  }

  const aRegulariser = data.filter(t => t.statut === 'À régulariser' || t.mecanisme === 'Aucune garantie — à régulariser');
  const actifs       = data.filter(t => t.statut === 'Actif' && t.mecanisme !== 'Aucune garantie — à régulariser');
  const autres       = data.filter(t => t.statut === 'Suspendu' || t.statut === 'Clôturé');

  const renderGroup = (list) => `<div class="item-list">${list.map(t => renderTrfCard(t)).join('')}</div>`;

  el.innerHTML = `
    ${aRegulariser.length ? `
    <div class="card" style="margin-bottom:16px;border-color:var(--bd-danger)">
      <div class="card-header"><span class="card-title" style="color:var(--tx-danger)">⚠ À régulariser (${aRegulariser.length})</span></div>
      ${renderGroup(aRegulariser)}
    </div>` : ''}
    ${actifs.length ? `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title">— Transferts actifs (${actifs.length})</span></div>
      ${renderGroup(actifs)}
    </div>` : ''}
    ${autres.length ? `
    <div class="card">
      <div class="card-header"><span class="card-title">— Suspendus / Clôturés (${autres.length})</span></div>
      ${renderGroup(autres)}
    </div>` : ''}`;
}

function renderTrfCard(t) {
  const statStyle = TRF_STATUT_STYLE[t.statut] || TRF_STATUT_STYLE['Actif'];
  const mec = TRF_MECANISMES.find(m => m.val === t.mecanisme);
  const artBadge = mec
    ? `<span class="badge" style="background:rgba(59,130,246,.12);color:var(--tx-info);border:1px solid rgba(59,130,246,.3);font-size:.6rem;font-family:var(--ff-mono)">Art.${mec.art}</span>`
    : '';
  const riskColor = mec?.risk === 'high' ? 'var(--tx-danger)' : mec?.risk === 'med' ? 'var(--tx-warn)' : 'var(--tx-ok)';

  let reviewAlert = '';
  if (t.date_revue) {
    const diff = Math.ceil((new Date(t.date_revue) - new Date()) / 86400000);
    if (diff < 0)        reviewAlert = `<span class="badge" style="background:var(--bg-danger);color:var(--tx-danger);border:1px solid var(--bd-danger);font-size:.6rem">Revue dépassée</span>`;
    else if (diff <= 30) reviewAlert = `<span class="badge" style="background:var(--bg-warn);color:var(--tx-warn);border:1px solid var(--bd-warn);font-size:.6rem">Revue J-${diff}</span>`;
  }

  return `
    <div class="item-row" style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line)">
      <div style="min-width:90px;display:flex;flex-direction:column;gap:4px;margin-top:2px">
        <span class="badge" style="background:${statStyle.bg};color:${statStyle.tx};border:1px solid ${statStyle.bd};font-size:.6rem">${t.statut}</span>
        ${artBadge}
        ${reviewAlert}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:#fff;font-size:.9rem">${escHtml(t.organisation_dest)} <span style="color:var(--tx-3);font-size:.78rem">(${escHtml(t.pays_destination)})</span></div>
        <div style="font-size:.75rem;color:var(--tx-2);margin-top:2px">${escHtml(t.service)}</div>
        <div style="font-size:.72rem;margin-top:4px;color:${riskColor}">${escHtml(t.mecanisme)}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;align-self:center">
        <button class="btn btn-ghost btn-sm" onclick="previewTransfert('${t.id}')">Détail</button>
        <button class="btn btn-ghost btn-sm" onclick="exportTransfertPdf('${t.id}')">PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="openEditTrfModal('${t.id}')">Modifier</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--tx-danger)" onclick="deleteTransfert('${t.id}')">✕</button>
      </div>
    </div>`;
}

/* ── Modal création / édition ───────────────────────────── */

function openTransfertModal(prefill = {}) {
  const isEdit = !!prefill.id;
  document.getElementById('modal-title-text').textContent = isEdit
    ? `Modifier — ${prefill.organisation_dest}`
    : 'Nouveau transfert hors UE — Art.44-49 RGPD';

  const adequationHint = PAYS_ADEQUATION.map(p => `<span style="font-size:.68rem;background:var(--bg-ok);color:var(--tx-ok);border:1px solid var(--bd-ok);border-radius:4px;padding:1px 6px;cursor:pointer" onclick="document.getElementById('trf-pays').value='${p}'">${p}</span>`).join(' ');

  document.getElementById('modal-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

      <div class="form-group">
        <label class="form-label">Pays destinataire *</label>
        <input class="form-input" id="trf-pays" value="${escHtml(prefill.pays_destination||'')}" placeholder="Ex : États-Unis, Inde, Chine…">
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
          <span style="font-size:.68rem;color:var(--tx-3);align-self:center">Adéquation :</span>
          ${adequationHint}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Organisation destinataire *</label>
        <input class="form-input" id="trf-org" value="${escHtml(prefill.organisation_dest||'')}" placeholder="Ex : AWS Inc., Google LLC…">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Service / flux concerné *</label>
        <input class="form-input" id="trf-service" value="${escHtml(prefill.service||'')}" placeholder="Ex : Hébergement cloud, analytics, CRM, support client…">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Finalités *</label>
        <textarea class="form-textarea" id="trf-finalites" placeholder="Une finalité par ligne">${(prefill.finalites||[]).join('\n')}</textarea>
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Catégories de données transférées *</label>
        <input class="form-input" id="trf-categories" value="${escHtml((prefill.categories_donnees||[]).join(', '))}" placeholder="Ex : Noms, emails, données de navigation, IP…">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Mécanisme de transfert *</label>
        <select class="form-select" id="trf-mec" onchange="onMecanismeChange(this.value)">
          ${TRF_MECANISMES.map(m => `<option value="${escHtml(m.val)}" ${(prefill.mecanisme||'')=== m.val?'selected':''}>${escHtml(m.val)}</option>`).join('')}
        </select>
      </div>

      <div class="form-group" style="grid-column:1/-1" id="trf-mec-detail-wrap">
        <label class="form-label">Précision / référence du mécanisme</label>
        <input class="form-input" id="trf-mec-detail" value="${escHtml(prefill.detail_mecanisme||'')}" placeholder="Ex : CCT signées le 01/01/2024, décision d'adéquation UE-USA du 10/07/2023…">
      </div>

      <div class="form-group">
        <label class="form-label">Statut *</label>
        <select class="form-select" id="trf-statut">
          ${['Actif','À régulariser','Suspendu','Clôturé'].map(s => `<option value="${s}" ${(prefill.statut||'Actif')===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Date de mise en place</label>
        <input class="form-input" type="date" id="trf-date" value="${prefill.date_mise_en_place||''}">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Date de prochaine revue</label>
        <input class="form-input" type="date" id="trf-revue" value="${prefill.date_revue||''}">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Risques identifiés</label>
        <textarea class="form-textarea" id="trf-risques" placeholder="Ex : Législation CLOUD Act (USA), accès gouvernemental possible, absence de droit de recours effectif…">${prefill.risques||''}</textarea>
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Mesures complémentaires (Art.46 + recommandations CEPD)</label>
        <textarea class="form-textarea" id="trf-mesures" placeholder="Ex : Chiffrement de bout en bout, pseudonymisation, clauses additionnelles, TIA (Transfer Impact Assessment)…">${prefill.mesures_complementaires||''}</textarea>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:20px">
      <button class="btn btn-pri" onclick="${isEdit ? `updateTransfert('${prefill.id}')` : 'saveTransfert()'}" style="flex:1">
        ${isEdit ? 'Enregistrer les modifications' : 'Enregistrer le transfert'}
      </button>
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    </div>`;

  onMecanismeChange(prefill.mecanisme || TRF_MECANISMES[0].val);
  openModal();
}

function onMecanismeChange(val) {
  const wrap = document.getElementById('trf-mec-detail-wrap');
  if (!wrap) return;
  const noDetail = val === 'Aucune garantie — à régulariser';
  wrap.style.display = noDetail ? 'none' : 'block';
}

function collectTrfForm() {
  return {
    pays_destination:       document.getElementById('trf-pays')?.value?.trim(),
    organisation_dest:      document.getElementById('trf-org')?.value?.trim(),
    service:                document.getElementById('trf-service')?.value?.trim(),
    finalites:              (document.getElementById('trf-finalites')?.value||'').split('\n').map(s=>s.trim()).filter(Boolean),
    categories_donnees:     (document.getElementById('trf-categories')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
    mecanisme:              document.getElementById('trf-mec')?.value,
    detail_mecanisme:       document.getElementById('trf-mec-detail')?.value?.trim() || null,
    statut:                 document.getElementById('trf-statut')?.value,
    date_mise_en_place:     document.getElementById('trf-date')?.value || null,
    date_revue:             document.getElementById('trf-revue')?.value || null,
    risques:                document.getElementById('trf-risques')?.value?.trim() || null,
    mesures_complementaires: document.getElementById('trf-mesures')?.value?.trim() || null,
  };
}

async function saveTransfert() {
  const row = collectTrfForm();
  if (!row.pays_destination)  { toast('Pays destinataire requis', 'error'); return; }
  if (!row.organisation_dest) { toast('Organisation destinataire requise', 'error'); return; }
  if (!row.service)           { toast('Service requis', 'error'); return; }
  const { error } = await supa.from('dpo_transferts').insert([row]);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  closeModal(); loadTransferts(); updateSidebarCounts();
  toast('Transfert enregistré', 'success');
}

async function openEditTrfModal(id) {
  const { data: t } = await supa.from('dpo_transferts').select('*').eq('id', id).single();
  if (!t) return;
  openTransfertModal(t);
}

async function updateTransfert(id) {
  const row = collectTrfForm();
  if (!row.pays_destination)  { toast('Pays destinataire requis', 'error'); return; }
  if (!row.organisation_dest) { toast('Organisation destinataire requise', 'error'); return; }
  if (!row.service)           { toast('Service requis', 'error'); return; }
  const { error } = await supa.from('dpo_transferts').update(row).eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  closeModal(); loadTransferts();
  toast('Mis à jour', 'success');
}

/* ── Aperçu détail ──────────────────────────────────────── */

async function previewTransfert(id) {
  const { data: t } = await supa.from('dpo_transferts').select('*').eq('id', id).single();
  if (!t) return;
  const mec = TRF_MECANISMES.find(m => m.val === t.mecanisme);
  const riskLabel = mec?.risk === 'high' ? '🔴 Élevé' : mec?.risk === 'med' ? '🟡 Moyen' : '🟢 Faible';
  const statStyle = TRF_STATUT_STYLE[t.statut] || TRF_STATUT_STYLE['Actif'];

  document.getElementById('modal-title-text').textContent = `Transfert — ${t.organisation_dest} (${t.pays_destination})`;
  document.getElementById('modal-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div class="form-label">Statut</div>
        <span class="badge" style="background:${statStyle.bg};color:${statStyle.tx};border:1px solid ${statStyle.bd}">${t.statut}</span>
      </div>
      <div><div class="form-label">Niveau de risque</div><div style="margin-top:4px;font-size:.9rem">${riskLabel}</div></div>
      <div><div class="form-label">Service</div><div style="font-size:.85rem;margin-top:2px">${escHtml(t.service)}</div></div>
      <div><div class="form-label">Mécanisme</div><div style="font-size:.8rem;margin-top:2px;color:var(--tx-info)">${escHtml(t.mecanisme)}</div></div>
      ${t.detail_mecanisme ? `<div style="grid-column:1/-1"><div class="form-label">Référence mécanisme</div><div style="font-size:.82rem;margin-top:2px">${escHtml(t.detail_mecanisme)}</div></div>` : ''}
      <div style="grid-column:1/-1"><div class="form-label">Données transférées</div><div style="font-size:.82rem;margin-top:2px">${escHtml((t.categories_donnees||[]).join(', '))}</div></div>
      ${t.finalites?.length ? `<div style="grid-column:1/-1"><div class="form-label">Finalités</div><ul style="margin:4px 0 0 16px;font-size:.82rem">${t.finalites.map(f=>`<li>${escHtml(f)}</li>`).join('')}</ul></div>` : ''}
      ${t.risques ? `<div style="grid-column:1/-1"><div class="form-label" style="color:var(--tx-warn)">⚠ Risques identifiés</div><div style="font-size:.82rem;margin-top:2px;color:var(--tx-warn)">${escHtml(t.risques)}</div></div>` : ''}
      ${t.mesures_complementaires ? `<div style="grid-column:1/-1"><div class="form-label">Mesures complémentaires</div><div style="font-size:.82rem;margin-top:2px">${escHtml(t.mesures_complementaires)}</div></div>` : ''}
      ${t.date_revue ? `<div><div class="form-label">Prochaine revue</div><div style="font-size:.82rem;margin-top:2px">${fmtDate(t.date_revue)}</div></div>` : ''}
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost btn-sm" onclick="exportTransfertPdf('${id}')">Exporter PDF</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Fermer</button>
    </div>`;
  openModal();
}

/* ── Export PDF ─────────────────────────────────────────── */

async function exportTransfertPdf(id) {
  const { data: t } = await supa.from('dpo_transferts').select('*').eq('id', id).single();
  if (!t) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  const lm = 14; const pw = 182;

  const txt = (str, opts = {}) => {
    doc.setFontSize(opts.size || 10);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(...(opts.rgb || [30, 30, 30]));
    const lines = doc.splitTextToSize(String(str || '—'), pw - (opts.indent || 0) * 5);
    if (y + lines.length * (opts.size || 10) * 0.42 > 280) { doc.addPage(); y = 16; }
    doc.text(lines, lm + (opts.indent || 0) * 5, y);
    y += lines.length * (opts.size || 10) * 0.42 + (opts.after !== undefined ? opts.after : 3);
  };

  const sep = () => {
    if (y > 270) { doc.addPage(); y = 16; }
    doc.setDrawColor(200); doc.line(lm, y, lm + pw, y); y += 5;
  };

  const mec = TRF_MECANISMES.find(m => m.val === t.mecanisme);
  const riskLabel = mec?.risk === 'high' ? 'Élevé' : mec?.risk === 'med' ? 'Moyen' : 'Faible';

  doc.setFillColor(6, 13, 31);
  doc.rect(0, 0, 210, 14, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255);
  doc.text('FICHE TRANSFERT HORS UE/EEE — ART.44-49 RGPD', lm, 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180);
  doc.text(new Date().toLocaleDateString('fr-FR'), 196, 9, { align: 'right' });

  y = 22;
  txt(`Transfert vers : ${t.organisation_dest} (${t.pays_destination})`, { size: 14, bold: true, color: 10, after: 2 });
  txt(t.service, { size: 10, rgb: [100, 100, 100], after: 6 });

  sep();
  txt('1. Identification', { size: 11, bold: true, after: 3 });
  txt(`Pays destinataire : ${t.pays_destination}`, { after: 1 });
  txt(`Organisation : ${t.organisation_dest}`, { after: 1 });
  txt(`Service / flux : ${t.service}`, { after: 1 });
  txt(`Statut : ${t.statut}`, { after: 1 });
  if (t.date_mise_en_place) txt(`Mis en place le : ${fmtDate(t.date_mise_en_place)}`, { after: 1 });
  if (t.date_revue)         txt(`Prochaine revue : ${fmtDate(t.date_revue)}`, { after: 1 });

  sep();
  txt('2. Données transférées', { size: 11, bold: true, after: 3 });
  txt(`Catégories : ${(t.categories_donnees||[]).join(', ')}`, { after: 2 });
  if (t.finalites?.length) {
    txt('Finalités :', { after: 1 });
    t.finalites.forEach(f => txt(`• ${f}`, { indent: 1, after: 1 }));
  }

  sep();
  txt('3. Base juridique du transfert', { size: 11, bold: true, after: 3 });
  txt(`Mécanisme : ${t.mecanisme}`, { after: 2 });
  if (t.detail_mecanisme) txt(`Référence : ${t.detail_mecanisme}`, { after: 2 });
  txt(`Niveau de risque estimé : ${riskLabel}`, { after: 2 });

  if (t.risques) {
    sep();
    txt('4. Risques identifiés', { size: 11, bold: true, after: 3 });
    txt(t.risques, { after: 3 });
  }

  if (t.mesures_complementaires) {
    sep();
    txt(`${t.risques ? '5' : '4'}. Mesures complémentaires`, { size: 11, bold: true, after: 3 });
    txt(t.mesures_complementaires, { after: 3 });
  }

  sep();
  txt('Références réglementaires', { size: 11, bold: true, after: 3 });
  [
    'Art.44 RGPD — Principe général des transferts',
    'Art.45 RGPD — Transferts sur la base d\'une décision d\'adéquation',
    'Art.46 RGPD — Transferts moyennant des garanties appropriées (CCT, BCR, codes, certifications)',
    'Art.47 RGPD — Règles d\'entreprise contraignantes (BCR)',
    'Art.49 RGPD — Dérogations pour situations particulières',
    'Recommandations 01/2020 du CEPD sur les mesures complémentaires',
  ].forEach(r => txt(`• ${r}`, { indent: 1, after: 1, rgb: [80, 80, 80] }));

  doc.save(`transfert-hors-ue-${t.organisation_dest.replace(/\s+/g,'-').toLowerCase()}.pdf`);
  toast('PDF téléchargé', 'success');
}

/* ── Suppression ────────────────────────────────────────── */

async function deleteTransfert(id) {
  if (!confirm('Supprimer ce transfert ?')) return;
  const { error } = await supa.from('dpo_transferts').delete().eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  loadTransferts(); updateSidebarCounts();
  toast('Supprimé', 'success');
}
