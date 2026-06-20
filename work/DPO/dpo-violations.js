/* ============================================================
   DPO Clients — Violations de données (Art.33-34 RGPD)
   ============================================================ */

const GRAVITES = [
  { key: 'faible',    label: 'Faible',    cls: 'badge-ok',    icon: '🟢' },
  { key: 'modéré',   label: 'Modéré',    cls: 'badge-warn',  icon: '🟡' },
  { key: 'grave',    label: 'Grave',     cls: 'badge-alert', icon: '🔴' },
  { key: 'critique', label: 'Critique',  cls: 'badge-alert', icon: '🚨' },
];
const STATUTS_VIOL = ['ouvert', 'en_cours', 'cloture'];

async function loadViolations() {
  if (!currentContact) return;
  const el = document.getElementById('violations-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  const { data, error } = await supa.from('dpo_client_violations')
    .select('*').eq('contact_id', currentContact.id)
    .order('date_incident', { ascending: false });

  if (error) { el.innerHTML = `<p style="color:var(--alert)">${escHtml(error.message)}</p>`; return; }

  const ouvertes  = (data || []).filter(v => v.statut !== 'cloture');
  const clôtures  = (data || []).filter(v => v.statut === 'cloture');

  el.innerHTML = `
    ${ouvertes.filter(v => v.niveau_gravite === 'critique' || v.niveau_gravite === 'grave').length ? `
      <div style="background:var(--alert-bg);border:1px solid var(--alert-bd);border-radius:var(--r-sm);
        padding:10px 14px;font-size:.8rem;color:var(--alert);margin-bottom:14px">
        🚨 ${ouvertes.filter(v => v.niveau_gravite === 'critique' || v.niveau_gravite === 'grave').length}
        violation(s) grave(s) ou critique(s) ouverte(s) — nécessite une notification CNIL potentielle (Art.33)
      </div>` : ''}
    <div class="card">
      <div class="card-header">
        <span class="card-title">— Incidents ouverts (${ouvertes.length})</span>
        <button class="btn btn-danger btn-sm" onclick="openViolationModal()">🚨 Déclarer un incident</button>
      </div>
      ${ouvertes.length ? renderViolList(ouvertes) : '<div class="empty-state"><div class="ico">✅</div><p>Aucun incident en cours. Bonne nouvelle !</p></div>'}
    </div>
    ${clôtures.length ? `
      <div class="card" style="margin-top:12px">
        <div class="card-header"><span class="card-title">— Incidents clôturés (${clôtures.length})</span></div>
        ${renderViolList(clôtures, true)}
      </div>` : ''}`;
}

function renderViolList(list, archived = false) {
  return '<div class="item-list">' + list.map(v => {
    const grav = GRAVITES.find(g => g.key === v.niveau_gravite) || { icon: '⚪', cls: 'badge-gray', label: v.niveau_gravite };
    const statLabel = { ouvert: 'Ouvert', en_cours: 'En cours', cloture: 'Clôturé' }[v.statut] || v.statut;
    return `
      <div class="item-row" onclick="openViolationModal('${v.id}')">
        <span style="font-size:1.2rem;flex-shrink:0">${grav.icon}</span>
        <div class="item-row-info">
          <div class="item-row-name">${escHtml(v.description.slice(0, 80))}${v.description.length > 80 ? '…' : ''}</div>
          <div class="item-row-meta">
            Incident le ${fmtDate(v.date_incident)}
            ${v.nb_personnes_concernees ? ' · ' + v.nb_personnes_concernees + ' personnes' : ''}
            ${(v.categories_donnees||[]).length ? ' · ' + v.categories_donnees.join(', ') : ''}
          </div>
        </div>
        <span class="badge ${grav.cls}">${escHtml(grav.label)}</span>
        <span class="badge ${archived ? 'badge-gray' : v.statut === 'ouvert' ? 'badge-alert' : 'badge-warn'}">${statLabel}</span>
      </div>`;
  }).join('') + '</div>';
}

function openViolationModal(id = null) {
  const form = `
    <div style="background:var(--alert-bg);border:1px solid var(--alert-bd);border-radius:var(--r-sm);
      padding:9px 13px;font-size:.78rem;color:var(--alert);margin-bottom:14px;font-family:var(--ff-mono)">
      ⏱ Art.33 RGPD : notification CNIL requise sous 72h en cas de violation probable
    </div>
    <div class="form-group">
      <label class="form-label">Description de l'incident *</label>
      <textarea class="form-textarea" id="vl-desc" placeholder="Décrire : nature, données concernées, cause probable, mesures prises…"></textarea>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Date de l'incident *</label>
        <input class="form-input" id="vl-date" type="date" value="${today()}">
      </div>
      <div class="form-group">
        <label class="form-label">Niveau de gravité *</label>
        <select class="form-select" id="vl-gravite">
          ${GRAVITES.map(g => `<option value="${g.key}">${g.icon} ${g.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Personnes concernées (estimation)</label>
        <input class="form-input" id="vl-nb" type="number" min="0" placeholder="Ex : 150">
      </div>
      <div class="form-group">
        <label class="form-label">Catégories de données (virgule)</label>
        <input class="form-input" id="vl-cats" placeholder="Ex : emails, adresses, IBAN">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Actions correctives prises</label>
      <textarea class="form-textarea" id="vl-actions" placeholder="Mesures immédiates et correctives…" style="min-height:70px"></textarea>
    </div>
    ${id ? `<div class="form-group">
      <label class="form-label">Statut</label>
      <select class="form-select" id="vl-statut">
        <option value="ouvert">Ouvert</option>
        <option value="en_cours">En cours</option>
        <option value="cloture">Clôturé</option>
      </select>
    </div>` : ''}`;

  openModal(id ? 'Modifier l\'incident' : '🚨 Déclarer un incident de données', form, `
    ${id ? `<button class="btn btn-danger btn-sm" style="margin-right:auto" onclick="deleteViolation('${id}')">Supprimer</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-pri" onclick="saveViolation(${id ? `'${id}'` : 'null'})">Enregistrer</button>`);

  if (id) {
    supa.from('dpo_client_violations').select('*').eq('id', id).single().then(({ data: v }) => {
      if (!v) return;
      document.getElementById('vl-desc').value    = v.description   || '';
      document.getElementById('vl-date').value    = v.date_incident || today();
      document.getElementById('vl-gravite').value = v.niveau_gravite|| 'modéré';
      document.getElementById('vl-nb').value      = v.nb_personnes_concernees || '';
      document.getElementById('vl-cats').value    = (v.categories_donnees||[]).join(', ');
      document.getElementById('vl-actions').value = v.actions_correctives || '';
      if (document.getElementById('vl-statut')) document.getElementById('vl-statut').value = v.statut || 'ouvert';
    });
  }
}

async function saveViolation(id) {
  const desc = document.getElementById('vl-desc').value.trim();
  if (!desc) { toast('Description requise', 'err'); return; }
  const cats = document.getElementById('vl-cats').value.split(',').map(s => s.trim()).filter(Boolean);
  const { data: { user } } = await supa.auth.getUser();
  const payload = {
    contact_id: currentContact.id,
    description: desc,
    date_incident: document.getElementById('vl-date').value || today(),
    niveau_gravite: document.getElementById('vl-gravite').value,
    nb_personnes_concernees: parseInt(document.getElementById('vl-nb').value) || null,
    categories_donnees: cats,
    actions_correctives: document.getElementById('vl-actions').value.trim() || null,
    statut: id && document.getElementById('vl-statut') ? document.getElementById('vl-statut').value : 'ouvert',
    updated_at: new Date().toISOString(),
  };
  if (payload.statut === 'cloture') payload.cloture_at = new Date().toISOString();

  let err;
  if (id) {
    ({ error: err } = await supa.from('dpo_client_violations').update(payload).eq('id', id));
  } else {
    ({ error: err } = await supa.from('dpo_client_violations').insert({ ...payload, created_by: user?.id }));
  }
  if (err) { toast('Erreur : ' + err.message, 'err'); return; }
  closeModal(); toast(id ? 'Incident mis à jour' : 'Incident enregistré', 'ok'); loadViolations();
}

async function deleteViolation(id) {
  if (!confirm('Supprimer cet incident ?')) return;
  const { error } = await supa.from('dpo_client_violations').delete().eq('id', id);
  if (error) { toast('Erreur', 'err'); return; }
  closeModal(); toast('Incident supprimé'); loadViolations();
}
