/* ============================================================
   DPO Clients — Registre des traitements (Art.30 RGPD)
   ============================================================ */

async function loadTraitements() {
  if (!currentContact) return;
  const el = document.getElementById('traitements-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  const { data, error } = await supa.from('dpo_client_traitements')
    .select('*').eq('contact_id', currentContact.id)
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = `<p style="color:var(--alert)">${escHtml(error.message)}</p>`; return; }

  const actifs = (data || []).filter(t => t.statut === 'Actif');
  const archived = (data || []).filter(t => t.statut !== 'Actif');

  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div class="card-header">
        <span class="card-title">— Traitements actifs (${actifs.length})</span>
        <button class="btn btn-pri btn-sm" onclick="openTraitementModal()">+ Nouveau traitement</button>
      </div>
      ${actifs.length ? renderTraitList(actifs) : '<div class="empty-state"><div class="ico">📋</div><p>Aucun traitement actif.<br>Ajoutez le premier traitement pour commencer.</p></div>'}
    </div>
    ${archived.length ? `
      <div class="card">
        <div class="card-header"><span class="card-title">— Archivés (${archived.length})</span></div>
        ${renderTraitList(archived, true)}
      </div>` : ''}
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn btn-ghost btn-sm" onclick="exportTraitementsJSON()">📋 Exporter JSON</button>
      <button class="btn btn-ghost btn-sm" onclick="exportTraitementsPDF()">📄 Export PDF</button>
    </div>`;
}

function renderTraitList(list, archived = false) {
  return '<div class="item-list">' + list.map(t => `
    <div class="item-row" onclick="openTraitementModal('${t.id}')">
      <div style="width:34px;height:34px;border-radius:8px;background:rgba(59,130,246,.12);
        border:1px solid rgba(59,130,246,.25);display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">📁</div>
      <div class="item-row-info">
        <div class="item-row-name">${escHtml(t.nom)}</div>
        <div class="item-row-meta">${escHtml(t.base_legale || '—')} · Conservation : ${escHtml(t.duree_conservation || '?')}</div>
      </div>
      ${(t.sous_traitants || []).length ? `<span class="badge badge-blue">${t.sous_traitants.length} ST</span>` : '<span class="badge badge-warn">ST ?</span>'}
      <span class="badge ${archived ? 'badge-gray' : 'badge-ok'}">${escHtml(t.statut)}</span>
    </div>`).join('') + '</div>';
}

function openTraitementModal(id = null) {
  const t = id ? null : {}; // sera chargé si id
  const title = id ? 'Modifier le traitement' : 'Nouveau traitement';

  const form = `
    <div class="form-group">
      <label class="form-label">Nom du traitement *</label>
      <input class="form-input" id="tr-nom" placeholder="Ex : Gestion des contacts clients" maxlength="120">
    </div>
    <div class="form-group">
      <label class="form-label">Finalité</label>
      <input class="form-input" id="tr-finalite" placeholder="Ex : Prospection commerciale, suivi clients">
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Base légale</label>
        <select class="form-select" id="tr-base">
          <option>Consentement (Art.6.1.a)</option>
          <option>Contrat (Art.6.1.b)</option>
          <option>Obligation légale (Art.6.1.c)</option>
          <option>Intérêt légitime (Art.6.1.f)</option>
          <option>Mission d'intérêt public (Art.6.1.e)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Durée de conservation</label>
        <input class="form-input" id="tr-duree" placeholder="Ex : 3 ans après fin de contrat">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Catégories de données (virgule séparées)</label>
      <input class="form-input" id="tr-categories" placeholder="Ex : nom, email, téléphone, adresse">
    </div>
    <div class="form-group">
      <label class="form-label">Responsable du traitement</label>
      <input class="form-input" id="tr-responsable" placeholder="Nom / fonction">
    </div>
    <div class="form-group">
      <label class="form-label">Sous-traitants (virgule séparés)</label>
      <input class="form-input" id="tr-st" placeholder="Ex : Supabase (hébergement), Stripe (paiement)">
    </div>`;

  const actions = `
    ${id ? `<button class="btn btn-danger btn-sm" style="margin-right:auto" onclick="deleteTraitement('${id}')">Supprimer</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-pri" onclick="saveTraitement(${id ? `'${id}'` : 'null'})">Enregistrer</button>`;

  openModal(title, form, actions);

  if (id) {
    supa.from('dpo_client_traitements').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) return;
      document.getElementById('tr-nom').value = data.nom || '';
      document.getElementById('tr-finalite').value = data.finalite || '';
      document.getElementById('tr-base').value = data.base_legale || '';
      document.getElementById('tr-duree').value = data.duree_conservation || '';
      document.getElementById('tr-categories').value = (data.categories_donnees || []).join(', ');
      document.getElementById('tr-responsable').value = data.responsable_traitement || '';
      document.getElementById('tr-st').value = (data.sous_traitants || []).join(', ');
    });
  }
}

async function saveTraitement(id) {
  const nom = document.getElementById('tr-nom').value.trim();
  if (!nom) { toast('Le nom est obligatoire', 'err'); return; }
  const cats = document.getElementById('tr-categories').value.split(',').map(s => s.trim()).filter(Boolean);
  const sts  = document.getElementById('tr-st').value.split(',').map(s => s.trim()).filter(Boolean);
  const { data: { user } } = await supa.auth.getUser();

  const payload = {
    contact_id: currentContact.id,
    nom,
    finalite: document.getElementById('tr-finalite').value.trim() || null,
    base_legale: document.getElementById('tr-base').value,
    duree_conservation: document.getElementById('tr-duree').value.trim() || null,
    categories_donnees: cats,
    responsable_traitement: document.getElementById('tr-responsable').value.trim() || null,
    sous_traitants: sts,
    updated_at: new Date().toISOString(),
  };

  let err;
  if (id) {
    ({ error: err } = await supa.from('dpo_client_traitements').update(payload).eq('id', id));
  } else {
    ({ error: err } = await supa.from('dpo_client_traitements').insert({ ...payload, created_by: user?.id }));
  }
  if (err) { toast('Erreur : ' + err.message, 'err'); return; }
  closeModal();
  toast(id ? 'Traitement mis à jour' : 'Traitement ajouté', 'ok');
  loadTraitements();
}

async function deleteTraitement(id) {
  if (!confirm('Supprimer ce traitement ?')) return;
  const { error } = await supa.from('dpo_client_traitements').delete().eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'err'); return; }
  closeModal();
  toast('Traitement supprimé');
  loadTraitements();
}

function exportTraitementsJSON() {
  supa.from('dpo_client_traitements').select('*').eq('contact_id', currentContact.id).then(({ data }) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `registre-traitements-${currentContact.nom}-${today()}.json`;
    a.click();
  });
}

async function exportTraitementsPDF() {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) { toast('jsPDF non disponible', 'err'); return; }
  const { data } = await supa.from('dpo_client_traitements').select('*').eq('contact_id', currentContact.id).eq('statut', 'Actif');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(10, 22, 40);
  doc.text('Registre des traitements — Art.30 RGPD', 14, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Client : ${currentContact.nom}${currentContact.entreprise ? ' — ' + currentContact.entreprise : ''}`, 14, y); y += 5;
  doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, y); y += 8;
  (data || []).forEach((t, i) => {
    if (y > 260) { doc.addPage(); y = 18; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(10, 22, 40);
    doc.text(`${i + 1}. ${t.nom}`, 14, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
    if (t.finalite)              { doc.text(`Finalité : ${t.finalite}`, 18, y); y += 4; }
    if (t.base_legale)           { doc.text(`Base légale : ${t.base_legale}`, 18, y); y += 4; }
    if (t.duree_conservation)    { doc.text(`Conservation : ${t.duree_conservation}`, 18, y); y += 4; }
    if ((t.categories_donnees||[]).length) { doc.text(`Données : ${t.categories_donnees.join(', ')}`, 18, y); y += 4; }
    if ((t.sous_traitants||[]).length)     { doc.text(`Sous-traitants : ${t.sous_traitants.join(', ')}`, 18, y); y += 4; }
    y += 4;
  });
  doc.save(`registre-traitements-${currentContact.nom}-${today()}.pdf`);
}
