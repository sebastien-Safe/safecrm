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
    });
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
