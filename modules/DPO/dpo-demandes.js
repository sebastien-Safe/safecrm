/* ============================================================
   DPO Clients — Demandes d'exercice des droits (Art.15-22 RGPD)
   ============================================================ */

const DROITS = [
  { key: 'accès',        label: 'Droit d\'accès (Art.15)',        icon: '🔍' },
  { key: 'rectification',label: 'Rectification (Art.16)',          icon: '✏️' },
  { key: 'suppression',  label: 'Effacement ("droit à l\'oubli") (Art.17)', icon: '🗑️' },
  { key: 'portabilité',  label: 'Portabilité (Art.20)',            icon: '📤' },
  { key: 'opposition',   label: 'Opposition (Art.21)',             icon: '🚫' },
  { key: 'limitation',   label: 'Limitation (Art.18)',             icon: '⏸️' },
];

const STATUTS_DEMANDE = ['Reçue', 'En cours', 'Traitée', 'Refusée'];

async function loadDemandes() {
  if (!currentContact) return;
  const el = document.getElementById('demandes-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  const { data, error } = await supa.from('dpo_client_demandes')
    .select('*').eq('contact_id', currentContact.id)
    .order('date_demande', { ascending: false });

  if (error) { el.innerHTML = `<p style="color:var(--alert)">${escHtml(error.message)}</p>`; return; }

  const actives  = (data || []).filter(d => d.statut !== 'Traitée' && d.statut !== 'Refusée');
  const archives = (data || []).filter(d => d.statut === 'Traitée' || d.statut === 'Refusée');
  const now = new Date();

  el.innerHTML = `
    <div style="background:var(--warn-bg);border:1px solid var(--warn-bd);border-radius:var(--r-sm);
      padding:10px 14px;font-size:.8rem;color:var(--warn);margin-bottom:14px;font-family:var(--ff-mono)">
      ⏱ Délai légal : 1 mois pour répondre (Art.12 RGPD) — prorogeable de 2 mois max
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">— Demandes actives (${actives.length})</span>
        <button class="btn btn-pri btn-sm" onclick="openDemandeModal()">+ Nouvelle demande</button>
      </div>
      ${actives.length ? renderDemandeList(actives, now) : '<div class="empty-state"><div class="ico">📩</div><p>Aucune demande en cours.</p></div>'}
    </div>
    ${archives.length ? `
      <div class="card" style="margin-top:12px">
        <div class="card-header"><span class="card-title">— Traitées / Refusées (${archives.length})</span></div>
        ${renderDemandeList(archives, now, true)}
      </div>` : ''}`;
}

function renderDemandeList(list, now, archived = false) {
  return '<div class="item-list">' + list.map(d => {
    const droit = DROITS.find(x => x.key === d.type_droit) || { icon: '📩', label: d.type_droit };
    const dl = d.date_limite ? new Date(d.date_limite) : null;
    const diff = dl ? Math.ceil((dl - now) / 86400000) : null;
    const dlBadge = dl
      ? (diff < 0
          ? `<span class="badge badge-alert">⚠ Dépassé de ${Math.abs(diff)}j</span>`
          : diff <= 7
            ? `<span class="badge badge-warn">⏱ J-${diff}</span>`
            : `<span class="badge badge-ok">⏱ J-${diff}</span>`)
      : '';
    const statut = d.statut || 'Reçue';
    const statutBadge = {
      'Reçue': 'badge-blue', 'En cours': 'badge-warn',
      'Traitée': 'badge-ok', 'Refusée': 'badge-alert'
    }[statut] || 'badge-gray';

    return `
      <div class="item-row" onclick="openDemandeModal('${d.id}')">
        <span style="font-size:1.2rem;flex-shrink:0">${droit.icon}</span>
        <div class="item-row-info">
          <div class="item-row-name">${escHtml(droit.label)}</div>
          <div class="item-row-meta">
            ${escHtml(d.demandeur_nom)} · Reçue le ${fmtDate(d.date_demande)}
            ${d.date_limite ? ' · Échéance ' + fmtDate(d.date_limite) : ''}
          </div>
        </div>
        ${dlBadge}
        <span class="badge ${statutBadge}">${escHtml(statut)}</span>
      </div>`;
  }).join('') + '</div>';
}

function openDemandeModal(id = null) {
  const form = `
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Nom du demandeur *</label>
        <input class="form-input" id="dm-nom" placeholder="Prénom Nom">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="dm-email" type="email" placeholder="email@domaine.fr">
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Type de droit *</label>
        <select class="form-select" id="dm-type">
          ${DROITS.map(r => `<option value="${r.key}">${r.icon} ${r.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Date de réception</label>
        <input class="form-input" id="dm-date" type="date" value="${today()}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description de la demande</label>
      <textarea class="form-textarea" id="dm-desc" placeholder="Contenu de la demande reçue…"></textarea>
    </div>
    <div id="dm-automation"></div>
    ${id ? `
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Statut</label>
          <select class="form-select" id="dm-statut">
            ${STATUTS_DEMANDE.map(s => `<option>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Date limite de réponse</label>
          <input class="form-input" id="dm-limite" type="date">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Réponse apportée</label>
        <textarea class="form-textarea" id="dm-reponse" placeholder="Rédiger la réponse officielle…" style="min-height:100px"></textarea>
      </div>` : ''}`;

  openModal(id ? 'Modifier la demande' : 'Nouvelle demande de droit', form, `
    ${id ? `<button class="btn btn-danger btn-sm" style="margin-right:auto" onclick="deleteDemande('${id}')">Supprimer</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-pri" onclick="saveDemande(${id ? `'${id}'` : 'null'})">Enregistrer</button>`);

  renderDmAutomation(id);
  document.getElementById('dm-type').addEventListener('change', () => renderDmAutomation(id));

  if (id) {
    supa.from('dpo_client_demandes').select('*').eq('id', id).single().then(({ data: d }) => {
      if (!d) return;
      document.getElementById('dm-nom').value   = d.demandeur_nom   || '';
      document.getElementById('dm-email').value = d.demandeur_email || '';
      document.getElementById('dm-type').value  = d.type_droit      || '';
      document.getElementById('dm-date').value  = d.date_demande    || '';
      document.getElementById('dm-desc').value  = d.description     || '';
      if (document.getElementById('dm-statut'))  document.getElementById('dm-statut').value  = d.statut       || 'Reçue';
      if (document.getElementById('dm-limite'))  document.getElementById('dm-limite').value  = d.date_limite  || '';
      if (document.getElementById('dm-reponse')) document.getElementById('dm-reponse').value = d.reponse      || '';
      renderDmAutomation(id);
    });
  }
}

function renderDmAutomation(id) {
  const zone = document.getElementById('dm-automation');
  if (!zone) return;
  const type = document.getElementById('dm-type').value;
  if (type === 'accès') {
    zone.innerHTML = `<button class="btn btn-out btn-sm" type="button" onclick="dmGenererPdfReponse('accès', ${id ? `'${id}'` : 'null'})">🔍 Générer le PDF de réponse (registre)</button>`;
  } else if (type === 'opposition') {
    zone.innerHTML = `<button class="btn btn-out btn-sm" type="button" onclick="dmGenererPdfReponse('opposition', ${id ? `'${id}'` : 'null'})">🚫 Générer l'accusé d'opposition (registre)</button>`;
  } else {
    zone.innerHTML = '';
  }
}

// ── Automatisation — PDF de réponse type basé sur le registre de traitements
// du client (le demandeur n'est pas un contact connu : ses données réelles ne
// résident pas dans ce système, seul le registre du client l'est).
async function dmGenererPdfReponse(type, id) {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) { toast('jsPDF non disponible', 'err'); return; }

  const nom = document.getElementById('dm-nom').value.trim() || 'Madame, Monsieur';
  const { data: traitements } = await supa.from('dpo_client_traitements')
    .select('*').eq('contact_id', currentContact.id).eq('statut', 'Actif');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;
  const title = type === 'accès'
    ? "Réponse à votre demande de droit d'accès (Art.15 RGPD)"
    : "Accusé de réception — Droit d'opposition (Art.21 RGPD)";
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(doc.splitTextToSize(title, 180), 14, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`À l'attention de : ${nom}`, 14, y); y += 6;
  doc.text(`Responsable de traitement : ${currentContact.nom}${currentContact.entreprise ? ' — ' + currentContact.entreprise : ''}`, 14, y); y += 6;
  doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 14, y); y += 10;

  const intro = type === 'accès'
    ? "Conformément à l'article 15 du RGPD, voici les catégories de données que nous traitons vous concernant, telles qu'elles figurent dans notre registre des activités de traitement :"
    : "Nous accusons réception de votre demande d'opposition. Conformément à l'article 21 du RGPD, voici les traitements concernés par votre demande et les mesures prises :";
  doc.text(doc.splitTextToSize(intro, 180), 14, y); y += doc.splitTextToSize(intro, 180).length * 5 + 6;

  (traitements || []).forEach((t, i) => {
    if (y > 265) { doc.addPage(); y = 18; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`${i + 1}. ${t.nom}`, 14, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    if (t.finalite)           { doc.text(doc.splitTextToSize(`Finalité : ${t.finalite}`, 175), 18, y); y += 5; }
    if (t.duree_conservation) { doc.text(`Conservation : ${t.duree_conservation}`, 18, y); y += 5; }
    if ((t.categories_donnees || []).length) { doc.text(doc.splitTextToSize(`Données : ${t.categories_donnees.join(', ')}`, 175), 18, y); y += 5; }
    if (type === 'opposition') { doc.text('→ Traitement stoppé au titre de votre opposition.', 18, y); y += 5; }
    y += 3;
  });

  if (!traitements || !traitements.length) {
    doc.text("Aucun traitement actif identifié dans le registre à ce jour.", 14, y); y += 6;
  }

  doc.save(`reponse-${type}-${(currentContact.nom || 'client').replace(/[^a-z0-9]/gi, '_')}-${today()}.pdf`);

  if (id) {
    await supa.from('dpo_client_demandes').update({
      statut: 'Traitée',
      reponse: type === 'accès'
        ? 'PDF de réponse (registre des traitements) généré et remis au demandeur.'
        : "Opposition traitée : PDF d'accusé généré, traitements concernés arrêtés.",
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    toast('PDF généré — demande marquée Traitée', 'ok');
    closeModal();
    loadDemandes();
  } else {
    toast('PDF généré', 'ok');
  }
}

async function saveDemande(id) {
  const nom = document.getElementById('dm-nom').value.trim();
  if (!nom) { toast('Nom requis', 'err'); return; }
  const dateDemande = document.getElementById('dm-date').value || today();
  const { data: { user } } = await supa.auth.getUser();

  const payload = {
    contact_id: currentContact.id,
    demandeur_nom:   nom,
    demandeur_email: document.getElementById('dm-email').value.trim() || null,
    type_droit:      document.getElementById('dm-type').value,
    date_demande:    dateDemande,
    date_limite:     id && document.getElementById('dm-limite')?.value ? document.getElementById('dm-limite').value : addDays(dateDemande, 30),
    statut:          id && document.getElementById('dm-statut') ? document.getElementById('dm-statut').value : 'Reçue',
    description:     document.getElementById('dm-desc').value.trim() || null,
    reponse:         id && document.getElementById('dm-reponse') ? document.getElementById('dm-reponse').value.trim() || null : null,
    updated_at:      new Date().toISOString(),
  };

  let err;
  if (id) {
    ({ error: err } = await supa.from('dpo_client_demandes').update(payload).eq('id', id));
  } else {
    ({ error: err } = await supa.from('dpo_client_demandes').insert({ ...payload, created_by: user?.id }));
  }
  if (err) { toast('Erreur : ' + err.message, 'err'); return; }
  closeModal();
  toast(id ? 'Demande mise à jour' : 'Demande enregistrée', 'ok');
  loadDemandes();
}

async function deleteDemande(id) {
  if (!confirm('Supprimer cette demande ?')) return;
  const { error } = await supa.from('dpo_client_demandes').delete().eq('id', id);
  if (error) { toast('Erreur', 'err'); return; }
  closeModal(); toast('Demande supprimée'); loadDemandes();
}
