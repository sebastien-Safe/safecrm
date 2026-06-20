/* ============================================================
   DPO Clients — Gestion des consentements
   Synchronisé avec les champs consent_* du contact CRM
   ============================================================ */

const CONSENT_TYPES = [
  { key: 'email',      label: 'Email',         icon: '✉️' },
  { key: 'sms',        label: 'SMS',           icon: '📱' },
  { key: 'marketing',  label: 'Marketing',     icon: '📣' },
  { key: 'formulaire', label: 'Formulaire',    icon: '📝' },
];

async function loadConsentements() {
  if (!currentContact) return;
  const el = document.getElementById('consentements-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  const [{ data: consentements }, { data: contact }] = await Promise.all([
    supa.from('dpo_client_consentements').select('*').eq('contact_id', currentContact.id).order('created_at', { ascending: false }),
    supa.from('contacts').select('consent_email,consent_telephone,consent_courrier').eq('id', currentContact.id).single(),
  ]);

  const actifs   = (consentements || []).filter(c => c.statut === 'actif');
  const retires  = (consentements || []).filter(c => c.statut === 'retiré');

  // Résumé des consentements CRM existants
  const crmBlock = contact ? `
    <div class="card" style="margin-bottom:12px">
      <div class="card-header"><span class="card-title">— Consentements CRM (source de vérité)</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${[
          ['✉️ Email',    contact.consent_email],
          ['📞 Tél.',     contact.consent_telephone],
          ['📬 Courrier', contact.consent_courrier],
        ].map(([lbl, val]) => `
          <span class="badge ${val ? 'badge-ok' : 'badge-gray'}" style="font-size:.75rem;padding:4px 12px">
            ${lbl} ${val ? '✓' : '—'}
          </span>`).join('')}
      </div>
      <p style="font-size:.74rem;color:var(--mut);margin-top:8px;font-family:var(--ff-mono)">
        Modifiables depuis la fiche contact dans le CRM.
      </p>
    </div>` : '';

  el.innerHTML = `
    ${crmBlock}
    <div class="card">
      <div class="card-header">
        <span class="card-title">— Consentements DPO (${actifs.length} actifs)</span>
        <button class="btn btn-pri btn-sm" onclick="openConsentModal()">+ Ajouter</button>
      </div>
      ${actifs.length ? renderConsentList(actifs) : '<div class="empty-state"><div class="ico">✅</div><p>Aucun consentement enregistré.</p></div>'}
    </div>
    ${retires.length ? `
      <div class="card" style="margin-top:12px">
        <div class="card-header"><span class="card-title">— Consentements retirés (${retires.length})</span></div>
        ${renderConsentList(retires, true)}
      </div>` : ''}`;
}

function renderConsentList(list, retired = false) {
  return '<div style="display:flex;flex-direction:column;gap:8px">' + list.map(c => {
    const typeInfo = CONSENT_TYPES.find(t => t.key === c.type_consentement) || { icon: '📋', label: c.type_consentement };
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
        background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:var(--r-sm)">
        <span style="font-size:1.1rem">${typeInfo.icon}</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:.85rem;color:#fff">${escHtml(typeInfo.label)}</div>
          <div style="font-size:.73rem;color:var(--mut);font-family:var(--ff-mono)">
            Obtenu le ${fmtDate(c.date_obtention)} · Source : ${escHtml(c.source || '—')}
            ${c.date_retrait ? ' · Retiré le ' + fmtDate(c.date_retrait) : ''}
          </div>
        </div>
        <span class="badge ${retired ? 'badge-gray' : 'badge-ok'}">${retired ? 'Retiré' : 'Actif'}</span>
        ${!retired ? `<button class="btn btn-ghost btn-sm" onclick="retirerConsent('${c.id}')">Retirer</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="deleteConsent('${c.id}')">🗑</button>
      </div>`;
  }).join('') + '</div>';
}

function openConsentModal(id = null) {
  const form = `
    <div class="form-group">
      <label class="form-label">Type de consentement *</label>
      <select class="form-select" id="cs-type">
        ${CONSENT_TYPES.map(t => `<option value="${t.key}">${t.icon} ${t.label}</option>`).join('')}
      </select>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Date d'obtention</label>
        <input class="form-input" id="cs-date" type="date" value="${today()}">
      </div>
      <div class="form-group">
        <label class="form-label">Source</label>
        <input class="form-input" id="cs-source" placeholder="Ex : Formulaire site, appel entrant…">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <input class="form-input" id="cs-notes" placeholder="Contexte, précisions…">
    </div>`;

  openModal('Ajouter un consentement', form, `
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-pri" onclick="saveConsent()">Enregistrer</button>`);
}

async function saveConsent() {
  const type = document.getElementById('cs-type').value;
  if (!type) { toast('Type requis', 'err'); return; }
  const { error } = await supa.from('dpo_client_consentements').insert({
    contact_id: currentContact.id,
    type_consentement: type,
    statut: 'actif',
    date_obtention: document.getElementById('cs-date').value || today(),
    source: document.getElementById('cs-source').value.trim() || null,
    notes:  document.getElementById('cs-notes').value.trim()  || null,
  });
  if (error) { toast('Erreur : ' + error.message, 'err'); return; }
  closeModal();
  toast('Consentement enregistré', 'ok');
  loadConsentements();
}

async function retirerConsent(id) {
  const { error } = await supa.from('dpo_client_consentements').update({
    statut: 'retiré',
    date_retrait: today(),
  }).eq('id', id);
  if (error) { toast('Erreur', 'err'); return; }
  toast('Consentement retiré');
  loadConsentements();
}

async function deleteConsent(id) {
  if (!confirm('Supprimer ce consentement ?')) return;
  const { error } = await supa.from('dpo_client_consentements').delete().eq('id', id);
  if (error) { toast('Erreur', 'err'); return; }
  toast('Consentement supprimé');
  loadConsentements();
}
