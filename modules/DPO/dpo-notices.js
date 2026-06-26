/* ============================================================
   DPO — Notices d'information (Art.13 & Art.14 RGPD)
   ============================================================ */

const BASES_LEGALES = [
  'Consentement (Art.6.1.a)',
  'Contrat (Art.6.1.b)',
  'Obligation légale (Art.6.1.c)',
  'Sauvegarde des intérêts vitaux (Art.6.1.d)',
  'Mission d\'intérêt public (Art.6.1.e)',
  'Intérêt légitime (Art.6.1.f)',
];

const DROITS_LISTE = [
  { key: 'acces',          label: 'Droit d\'accès (Art.15)' },
  { key: 'rectification',  label: 'Rectification (Art.16)' },
  { key: 'effacement',     label: 'Effacement (Art.17)' },
  { key: 'limitation',     label: 'Limitation (Art.18)' },
  { key: 'portabilite',    label: 'Portabilité (Art.20)' },
  { key: 'opposition',     label: 'Opposition (Art.21)' },
];

/* ── Liste ──────────────────────────────────────────────── */

async function loadNotices() {
  const el = document.getElementById('notices-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const { data, error } = await supa
    .from('dpo_notices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    el.innerHTML = `<div class="empty-state" style="color:var(--tx-danger)">${error.message}</div>`;
    return;
  }

  if (!data?.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="ico">📄</div>
        <p>Aucune notice créée.<br>Cliquez sur <strong>+ Nouvelle notice</strong> pour générer votre première notice Art.13/14.</p>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="item-list">${data.map(n => renderNoticeCard(n)).join('')}</div>`;
}

function renderNoticeCard(n) {
  const art = n.type_collecte === 'directe' ? 'Art.13' : 'Art.14';
  const artColor = n.type_collecte === 'directe' ? 'var(--accent)' : 'var(--gold-lt)';
  const date = fmtDate(n.created_at);
  return `
    <div class="item-row" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line)">
      <div style="min-width:56px;text-align:center">
        <span class="badge" style="background:rgba(59,130,246,.15);color:${artColor};border:1px solid ${artColor};font-family:var(--ff-mono);font-size:.65rem">${art}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:#fff;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(n.nom_traitement)}</div>
        <div style="font-size:.75rem;color:var(--tx-2);margin-top:2px">${escHtml(n.responsable_traitement)} · ${escHtml(n.base_legale)}</div>
      </div>
      <div style="font-size:.72rem;color:var(--tx-3);white-space:nowrap">${date}</div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="previewNotice('${n.id}')">Aperçu</button>
        <button class="btn btn-ghost btn-sm" onclick="copyNoticeHtml('${n.id}')">Copier HTML</button>
        <button class="btn btn-ghost btn-sm" onclick="exportNoticePdf('${n.id}')">PDF</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--tx-danger)" onclick="deleteNotice('${n.id}')">✕</button>
      </div>
    </div>`;
}

/* ── Modal création ─────────────────────────────────────── */

function openNoticeModal() {
  document.getElementById('modal-title-text').textContent = 'Nouvelle notice — Art.13 / Art.14 RGPD';
  document.getElementById('modal-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Type de collecte *</label>
        <div style="display:flex;gap:10px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="radio" name="n-type" value="directe" checked onchange="toggleCollecteType(this.value)">
            <span>Collecte directe — <code style="font-size:.72rem">Art.13</code> (formulaire, téléphone…)</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="radio" name="n-type" value="indirecte" onchange="toggleCollecteType(this.value)">
            <span>Collecte indirecte — <code style="font-size:.72rem">Art.14</code> (achat de fichier, partenaire…)</span>
          </label>
        </div>
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Nom du traitement / contexte de collecte *</label>
        <input class="form-input" id="n-nom" placeholder="Ex : Formulaire de contact site web, Inscription newsletter…">
      </div>

      <div class="form-group">
        <label class="form-label">Responsable du traitement *</label>
        <input class="form-input" id="n-rt" placeholder="Raison sociale, adresse, SIRET">
      </div>
      <div class="form-group">
        <label class="form-label">Contact DPO</label>
        <input class="form-input" id="n-dpo" placeholder="Nom / email DPO ou DPO externalisé">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Finalité(s) du traitement *</label>
        <textarea class="form-textarea" id="n-finalites" placeholder="Une finalité par ligne&#10;Ex : Gestion des demandes de contact&#10;Envoi de la newsletter"></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Base légale *</label>
        <select class="form-select" id="n-base" onchange="toggleBaseLegale(this.value)">
          ${BASES_LEGALES.map(b => `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" id="n-base-detail-wrap" style="display:none">
        <label class="form-label">Précision intérêt légitime</label>
        <input class="form-input" id="n-base-detail" placeholder="Ex : Prospection commerciale B2B auprès de professionnels">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Catégories de données collectées *</label>
        <input class="form-input" id="n-categories" placeholder="Ex : Nom, prénom, email, téléphone, entreprise">
      </div>

      <div class="form-group" id="n-source-wrap" style="display:none;grid-column:1/-1">
        <label class="form-label">Source des données (Art.14 uniquement) *</label>
        <input class="form-input" id="n-source" placeholder="Ex : Partenaire commercial XYZ, base publique Infogreffe…">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Destinataires des données</label>
        <input class="form-input" id="n-destinataires" placeholder="Ex : Service commercial, prestataire CRM, expert-comptable">
      </div>

      <div class="form-group">
        <label class="form-label">Durée de conservation *</label>
        <input class="form-input" id="n-duree" placeholder="Ex : 3 ans après le dernier contact">
      </div>
      <div class="form-group" style="display:flex;flex-direction:column;gap:6px">
        <label class="form-label">Transferts hors UE</label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:6px">
          <input type="checkbox" id="n-transferts" style="width:16px;height:16px" onchange="toggleTransferts(this.checked)">
          <span style="font-size:.85rem">Des données sont transférées hors de l'UE/EEE</span>
        </label>
      </div>

      <div class="form-group" id="n-transferts-detail-wrap" style="display:none;grid-column:1/-1">
        <label class="form-label">Détail des transferts hors UE</label>
        <input class="form-input" id="n-transferts-detail" placeholder="Ex : Hébergement AWS us-east-1 — clauses contractuelles types (CCT)">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Droits exercés par les personnes</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
          ${DROITS_LISTE.map(d => `
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.82rem">
              <input type="checkbox" name="n-droits" value="${d.key}" checked style="width:14px;height:14px">
              ${escHtml(d.label)}
            </label>`).join('')}
        </div>
      </div>

      <div class="form-group" style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="n-retrait" style="width:16px;height:16px" checked>
        <label class="form-label" for="n-retrait" style="margin:0;cursor:pointer">Droit de retrait du consentement</label>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="n-auto" style="width:16px;height:16px" onchange="toggleDecisionAuto(this.checked)">
        <label class="form-label" for="n-auto" style="margin:0;cursor:pointer">Décision automatisée / profilage (Art.22)</label>
      </div>

      <div class="form-group" id="n-auto-detail-wrap" style="display:none;grid-column:1/-1">
        <label class="form-label">Logique de la décision automatisée</label>
        <input class="form-input" id="n-auto-detail" placeholder="Ex : Score de crédit calculé par algorithme…">
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Caractère obligatoire ou contractuel de la collecte</label>
        <input class="form-input" id="n-obligatoire" placeholder="Ex : Obligatoire pour l'exécution du contrat — sans ces données, la prestation ne peut être fournie">
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:20px">
      <button class="btn btn-pri" onclick="saveNotice()" style="flex:1">Générer et enregistrer la notice</button>
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    </div>`;
  openModal();
}

function toggleCollecteType(val) {
  const srcWrap = document.getElementById('n-source-wrap');
  if (srcWrap) srcWrap.style.display = val === 'indirecte' ? 'block' : 'none';
}

function toggleBaseLegale(val) {
  const wrap = document.getElementById('n-base-detail-wrap');
  if (wrap) wrap.style.display = val.includes('légitime') ? 'block' : 'none';
}

function toggleTransferts(checked) {
  const wrap = document.getElementById('n-transferts-detail-wrap');
  if (wrap) wrap.style.display = checked ? 'block' : 'none';
}

function toggleDecisionAuto(checked) {
  const wrap = document.getElementById('n-auto-detail-wrap');
  if (wrap) wrap.style.display = checked ? 'block' : 'none';
}

/* ── Sauvegarde ─────────────────────────────────────────── */

async function saveNotice() {
  const type_collecte   = document.querySelector('input[name="n-type"]:checked')?.value;
  const nom_traitement  = document.getElementById('n-nom')?.value?.trim();
  const responsable_traitement = document.getElementById('n-rt')?.value?.trim();
  const base_legale     = document.getElementById('n-base')?.value;
  const duree_conservation = document.getElementById('n-duree')?.value?.trim();

  if (!nom_traitement)         { toast('Nom du traitement requis', 'error'); return; }
  if (!responsable_traitement) { toast('Responsable du traitement requis', 'error'); return; }
  if (!duree_conservation)     { toast('Durée de conservation requise', 'error'); return; }

  const finalites      = (document.getElementById('n-finalites')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const categories     = (document.getElementById('n-categories')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
  const destinataires  = (document.getElementById('n-destinataires')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
  const droits         = [...document.querySelectorAll('input[name="n-droits"]:checked')].map(el => el.value);
  const transferts     = document.getElementById('n-transferts')?.checked || false;

  const row = {
    type_collecte,
    nom_traitement,
    responsable_traitement,
    contact_dpo:              document.getElementById('n-dpo')?.value?.trim() || null,
    finalites,
    base_legale,
    base_legale_detail:       document.getElementById('n-base-detail')?.value?.trim() || null,
    categories_donnees:       categories,
    source_donnees:           document.getElementById('n-source')?.value?.trim() || null,
    destinataires,
    transferts_pays_tiers:    transferts,
    pays_tiers_detail:        document.getElementById('n-transferts-detail')?.value?.trim() || null,
    duree_conservation,
    droits,
    retrait_consentement:     document.getElementById('n-retrait')?.checked || false,
    decision_automatisee:     document.getElementById('n-auto')?.checked || false,
    decision_automatisee_detail: document.getElementById('n-auto-detail')?.value?.trim() || null,
    collecte_obligatoire:     document.getElementById('n-obligatoire')?.value?.trim() || null,
  };

  row.notice_html = buildNoticeHtml(row);

  const { error } = await supa.from('dpo_notices').insert([row]);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }

  closeModal();
  loadNotices();
  updateSidebarCounts();
  toast('Notice enregistrée', 'success');
}

/* ── Générateur HTML ────────────────────────────────────── */

function buildNoticeHtml(n) {
  const art = n.type_collecte === 'directe' ? '13' : '14';
  const droitsLabels = (n.droits || []).map(k => {
    const d = DROITS_LISTE.find(x => x.key === k);
    return d ? d.label : k;
  });

  let html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#222;max-width:700px">
<h2 style="font-size:18px;margin-bottom:4px">Information sur le traitement de vos données personnelles</h2>
<p style="font-size:12px;color:#666;margin-bottom:20px">Conformément à l'article ${art} du Règlement Général sur la Protection des Données (RGPD)</p>

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px">1. Responsable du traitement</h3>
<p>${escHtml(n.responsable_traitement)}</p>
${n.contact_dpo ? `<p><strong>Délégué à la Protection des Données (DPO) :</strong> ${escHtml(n.contact_dpo)}</p>` : ''}

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">2. Finalités du traitement</h3>
<ul>${(n.finalites || []).map(f => `<li>${escHtml(f)}</li>`).join('')}</ul>

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">3. Base légale</h3>
<p>${escHtml(n.base_legale)}${n.base_legale_detail ? ` — ${escHtml(n.base_legale_detail)}` : ''}</p>

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">4. Données collectées</h3>
<p>${escHtml((n.categories_donnees || []).join(', '))}</p>
${n.type_collecte === 'indirecte' && n.source_donnees ? `<p><strong>Source :</strong> ${escHtml(n.source_donnees)}</p>` : ''}

${n.destinataires?.length ? `<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">5. Destinataires</h3>
<p>${escHtml(n.destinataires.join(', '))}</p>` : ''}

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">6. Durée de conservation</h3>
<p>${escHtml(n.duree_conservation)}</p>

${n.transferts_pays_tiers ? `<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">7. Transferts hors Union Européenne</h3>
<p>${escHtml(n.pays_tiers_detail || 'Des transferts vers des pays tiers sont effectués dans le respect des garanties appropriées (Art.44 et suivants du RGPD).')}</p>` : ''}

<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">${n.transferts_pays_tiers ? '8' : '7'}. Vos droits</h3>
<p>Vous disposez des droits suivants sur vos données personnelles :</p>
<ul>${droitsLabels.map(l => `<li>${escHtml(l)}</li>`).join('')}</ul>
${n.retrait_consentement ? '<p>Vous pouvez retirer votre consentement à tout moment sans que cela ne porte atteinte à la licéité du traitement effectué avant ce retrait.</p>' : ''}
<p>Vous disposez également du droit d\'introduire une réclamation auprès de la <strong>CNIL</strong> (www.cnil.fr).</p>

${n.decision_automatisee ? `<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">Décision automatisée / Profilage (Art.22)</h3>
<p>${escHtml(n.decision_automatisee_detail || 'Votre dossier peut faire l\'objet d\'une décision automatisée.')}</p>` : ''}

${n.collecte_obligatoire ? `<h3 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:16px">Caractère obligatoire de la collecte</h3>
<p>${escHtml(n.collecte_obligatoire)}</p>` : ''}

<p style="margin-top:20px;font-size:12px;color:#888">Pour exercer vos droits, contactez-nous${n.contact_dpo ? ` : ${escHtml(n.contact_dpo)}` : '.'}
</p></div>`;

  return html;
}

/* ── Aperçu ─────────────────────────────────────────────── */

async function previewNotice(id) {
  const { data: n } = await supa.from('dpo_notices').select('*').eq('id', id).single();
  if (!n) return;
  const art = n.type_collecte === 'directe' ? 'Art.13' : 'Art.14';
  document.getElementById('modal-title-text').textContent = `Notice — ${n.nom_traitement} (${art})`;
  document.getElementById('modal-content').innerHTML = `
    <div style="background:#fff;border-radius:8px;padding:20px;max-height:60vh;overflow-y:auto">
      ${n.notice_html || buildNoticeHtml(n)}
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-ghost btn-sm" onclick="copyNoticeHtml('${id}')">Copier HTML</button>
      <button class="btn btn-ghost btn-sm" onclick="exportNoticePdf('${id}')">Exporter PDF</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Fermer</button>
    </div>`;
  openModal();
}

/* ── Copie HTML ─────────────────────────────────────────── */

async function copyNoticeHtml(id) {
  const { data: n } = await supa.from('dpo_notices').select('notice_html,nom_traitement').eq('id', id).single();
  if (!n) return;
  const html = n.notice_html || '';
  try {
    await navigator.clipboard.writeText(html);
    toast('HTML copié dans le presse-papier', 'success');
  } catch {
    toast('Copie échouée — utilisez l\'aperçu', 'error');
  }
}

/* ── Export PDF ─────────────────────────────────────────── */

async function exportNoticePdf(id) {
  const { data: n } = await supa.from('dpo_notices').select('*').eq('id', id).single();
  if (!n) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const art = n.type_collecte === 'directe' ? 'Art.13' : 'Art.14';
  const droitsLabels = (n.droits || []).map(k => {
    const d = DROITS_LISTE.find(x => x.key === k);
    return d ? d.label : k;
  });

  let y = 18;
  const lm = 14; const pw = 182;

  const txt = (t, opts = {}) => {
    doc.setFontSize(opts.size || 10);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(opts.color || 30);
    const lines = doc.splitTextToSize(t, pw - (opts.indent || 0) * 4);
    doc.text(lines, lm + (opts.indent || 0) * 4, y);
    y += lines.length * (opts.size || 10) * 0.45 + (opts.after || 3);
  };

  const sep = () => { doc.setDrawColor(200); doc.line(lm, y, lm + pw, y); y += 4; };

  doc.setFillColor(6, 13, 31);
  doc.rect(0, 0, 210, 14, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255);
  doc.text(`NOTICE D'INFORMATION — ${art} RGPD`, lm, 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180);
  doc.text(new Date().toLocaleDateString('fr-FR'), 196, 9, { align: 'right' });

  y = 22;
  txt(`Information sur le traitement de vos données personnelles`, { size: 14, bold: true, color: 10, after: 2 });
  txt(`Conformément à l'article ${art === 'Art.13' ? '13' : '14'} du RGPD`, { size: 9, color: 100, after: 6 });

  sep();
  txt('1. Responsable du traitement', { size: 11, bold: true, after: 2 });
  txt(n.responsable_traitement, { after: 2 });
  if (n.contact_dpo) txt(`DPO : ${n.contact_dpo}`, { after: 4 });

  sep();
  txt('2. Finalités', { size: 11, bold: true, after: 2 });
  (n.finalites || []).forEach(f => txt(`• ${f}`, { indent: 1, after: 1 }));
  y += 2;

  sep();
  txt('3. Base légale', { size: 11, bold: true, after: 2 });
  txt(n.base_legale + (n.base_legale_detail ? ` — ${n.base_legale_detail}` : ''), { after: 4 });

  sep();
  txt('4. Données collectées', { size: 11, bold: true, after: 2 });
  txt((n.categories_donnees || []).join(', '), { after: 2 });
  if (n.type_collecte === 'indirecte' && n.source_donnees) txt(`Source : ${n.source_donnees}`, { after: 4 });

  if (n.destinataires?.length) {
    sep();
    txt('5. Destinataires', { size: 11, bold: true, after: 2 });
    txt(n.destinataires.join(', '), { after: 4 });
  }

  sep();
  txt('6. Durée de conservation', { size: 11, bold: true, after: 2 });
  txt(n.duree_conservation, { after: 4 });

  if (n.transferts_pays_tiers) {
    sep();
    txt('7. Transferts hors UE/EEE', { size: 11, bold: true, after: 2 });
    txt(n.pays_tiers_detail || 'Des transferts vers des pays tiers sont effectués dans le respect des garanties appropriées.', { after: 4 });
  }

  sep();
  txt('Vos droits', { size: 11, bold: true, after: 2 });
  droitsLabels.forEach(l => txt(`• ${l}`, { indent: 1, after: 1 }));
  if (n.retrait_consentement) txt('• Droit de retrait du consentement à tout moment', { indent: 1, after: 1 });
  txt('• Droit d\'introduire une réclamation auprès de la CNIL (www.cnil.fr)', { indent: 1, after: 4 });

  if (n.decision_automatisee && n.decision_automatisee_detail) {
    sep();
    txt('Décision automatisée / Profilage (Art.22)', { size: 11, bold: true, after: 2 });
    txt(n.decision_automatisee_detail, { after: 4 });
  }

  if (n.collecte_obligatoire) {
    sep();
    txt('Caractère obligatoire de la collecte', { size: 11, bold: true, after: 2 });
    txt(n.collecte_obligatoire, { after: 4 });
  }

  doc.save(`notice-${art.toLowerCase()}-${n.nom_traitement.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  toast('PDF téléchargé', 'success');
}

/* ── Suppression ────────────────────────────────────────── */

async function deleteNotice(id) {
  if (!confirm('Supprimer cette notice ?')) return;
  const { error } = await supa.from('dpo_notices').delete().eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  loadNotices();
  updateSidebarCounts();
  toast('Notice supprimée', 'success');
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
