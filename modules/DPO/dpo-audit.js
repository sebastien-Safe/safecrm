/* ============================================================
   DPO Clients — Audit automatique + Score RGPD
   ============================================================ */

async function loadAudit() {
  if (!currentContact) return;
  const el = document.getElementById('audit-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Analyse en cours…</div>';

  // Récupérer toutes les données
  const [
    { data: traits }, { data: consent }, { data: docs },
    { data: demandes }, { data: violations }, { data: profile }, { data: contact }
  ] = await Promise.all([
    supa.from('dpo_client_traitements').select('*').eq('contact_id', currentContact.id).eq('statut', 'Actif'),
    supa.from('dpo_client_consentements').select('*').eq('contact_id', currentContact.id),
    supa.from('dpo_client_documents').select('type_document,titre').eq('contact_id', currentContact.id),
    supa.from('dpo_client_demandes').select('statut,date_limite').eq('contact_id', currentContact.id),
    supa.from('dpo_client_violations').select('statut,niveau_gravite').eq('contact_id', currentContact.id),
    supa.from('dpo_client_profiles').select('*').eq('contact_id', currentContact.id).maybeSingle(),
    supa.from('contacts').select('consent_email,consent_telephone,consent_courrier,email,siret').eq('id', currentContact.id).single(),
  ]);

  const typesDoc = new Set((docs || []).map(d => d.type_document));
  const activeConsent = (consent || []).filter(c => c.statut === 'actif');
  const demandesRetard = (demandes || []).filter(d => d.date_limite && new Date(d.date_limite) < new Date() && d.statut !== 'Traitée');
  const violOuvertes = (violations || []).filter(v => v.statut !== 'cloture');
  const violGraves = violOuvertes.filter(v => v.niveau_gravite === 'grave' || v.niveau_gravite === 'critique');

  // Construire la liste des items d'audit
  const items = [
    // Registre
    { cat: 'registre', item: 'Registre des traitements renseigné (≥1 traitement actif)', ok: (traits||[]).length >= 1 },
    { cat: 'registre', item: 'Tous les traitements ont une base légale définie', ok: (traits||[]).every(t => t.base_legale) },
    { cat: 'registre', item: 'Durées de conservation précisées pour chaque traitement', ok: (traits||[]).every(t => t.duree_conservation) },
    { cat: 'registre', item: 'Sous-traitants identifiés pour tous les traitements', ok: (traits||[]).length > 0 && (traits||[]).every(t => (t.sous_traitants||[]).length > 0) },
    // Consentements
    { cat: 'consentements', item: 'Consentement email enregistré', ok: !!(contact?.consent_email || activeConsent.find(c=>c.type_consentement==='email')) },
    { cat: 'consentements', item: 'Consentement marketing tracé', ok: !!activeConsent.find(c=>c.type_consentement==='marketing') },
    { cat: 'consentements', item: 'Aucun consentement récemment retiré sans action', ok: (consent||[]).filter(c=>c.statut==='retiré').length === 0 },
    // Documents
    { cat: 'documents', item: 'Politique de confidentialité présente', ok: typesDoc.has('politique_confidentialite') },
    { cat: 'documents', item: 'Mentions légales présentes', ok: typesDoc.has('mentions_legales') },
    { cat: 'documents', item: 'Procédures internes RGPD documentées', ok: typesDoc.has('procedure_interne') },
    { cat: 'documents', item: 'Contrat de sous-traitance disponible', ok: typesDoc.has('contrat_sous_traitance') },
    { cat: 'documents', item: 'Registre RGPD exporté', ok: typesDoc.has('registre_rgpd') },
    // Demandes
    { cat: 'procedures', item: 'Aucune demande de droit en retard', ok: demandesRetard.length === 0 },
    { cat: 'procedures', item: 'Toutes les demandes ont une échéance définie', ok: (demandes||[]).every(d => d.date_limite) },
    // Violations
    { cat: 'violations', item: 'Aucune violation grave ou critique ouverte', ok: violGraves.length === 0 },
    { cat: 'violations', item: 'Toutes les violations ont des actions correctives', ok: (violations||[]).every(v=>v.actions_correctives) },
    // Profil
    { cat: 'general', item: 'Client avec SIRET renseigné (identité entreprise)', ok: !!(contact?.siret) },
    { cat: 'general', item: 'Contact email présent', ok: !!(contact?.email) },
  ];

  const conforme      = items.filter(i => i.ok);
  const action_requise= items.filter(i => !i.ok);

  // Calcul du score
  const { score, s_traits, s_consent, s_docs, s_st, s_proc, s_audit } = await computeScore(currentContact.id);

  // Mise à jour du score dans la sidebar
  const scoreEl = document.getElementById('sidebar-score');
  if (scoreEl) {
    scoreEl.textContent = score + '%';
    scoreEl.style.color = scoreColor(score);
  }

  el.innerHTML = `
    <!-- Score global -->
    <div class="card" style="margin-bottom:14px;text-align:center">
      <div style="font-family:var(--ff-disp);font-size:3rem;font-weight:800;
        color:${scoreColor(score)};line-height:1;margin-bottom:8px">${score}%</div>
      <div style="margin-bottom:14px">${scoreBadge(score)}</div>

      <!-- Barres de détail -->
      <div style="text-align:left">
        ${[
          ['Registre des traitements', s_traits,  '25%'],
          ['Consentements',            s_consent,  '20%'],
          ['Documents RGPD',           s_docs,     '20%'],
          ['Sous-traitants',           s_st,       '15%'],
          ['Procédures internes',      s_proc,     '10%'],
          ['Audit validé',             s_audit,    '10%'],
        ].map(([lbl, val, poid]) => `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:3px">
              <span style="color:var(--mut-2)">${lbl} <span style="color:var(--mut)">(${poid})</span></span>
              <span style="color:${scoreColor(val)};font-weight:700;font-family:var(--ff-mono)">${val}%</span>
            </div>
            <div class="score-bar-wrap">
              <div class="score-bar" style="width:${val}%;background:${scoreColor(val)}"></div>
            </div>
          </div>`).join('')}
      </div>

      <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="updateAuditTimestamp()">
        ↺ Marquer l'audit comme validé aujourd'hui
      </button>
    </div>

    <!-- Items d'audit -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">— Points de contrôle (${conforme.length}/${items.length} conformes)</span>
      </div>

      ${action_requise.length ? `
        <div style="margin-bottom:12px">
          <div style="font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
            color:var(--alert);margin-bottom:8px;font-family:var(--ff-mono)">
            🔴 Actions requises (${action_requise.length})
          </div>
          ${action_requise.map(i => auditItemHtml(i)).join('')}
        </div>` : ''}

      ${conforme.length ? `
        <div>
          <div style="font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
            color:var(--ok);margin-bottom:8px;font-family:var(--ff-mono)">
            🟢 Conformes (${conforme.length})
          </div>
          ${conforme.map(i => auditItemHtml(i, true)).join('')}
        </div>` : ''}
    </div>`;
}

function auditItemHtml(item, ok = false) {
  const cats = { registre: '📋', consentements: '✅', documents: '📄', procedures: '📩', violations: '🚨', general: '👤' };
  return `
    <div class="audit-item ${ok ? 'conforme' : 'action_requise'}">
      <span class="audit-ico">${ok ? '✅' : '❌'}</span>
      <span class="audit-text">${escHtml(item.item)}</span>
      <span class="audit-status" style="color:${ok ? 'var(--ok)' : 'var(--alert)'}">${cats[item.cat] || ''}</span>
    </div>`;
}

async function updateAuditTimestamp() {
  const { data: { user } } = await supa.auth.getUser();
  const { data: profile } = await supa.from('dpo_client_profiles').select('id').eq('contact_id', currentContact.id).maybeSingle();
  const now = new Date().toISOString();
  let err;
  if (profile) {
    ({ error: err } = await supa.from('dpo_client_profiles').update({ last_audit_at: now, updated_at: now }).eq('contact_id', currentContact.id));
  } else {
    ({ error: err } = await supa.from('dpo_client_profiles').insert({ contact_id: currentContact.id, last_audit_at: now, created_by: user?.id }));
  }
  if (err) { toast('Erreur', 'err'); return; }
  toast('Audit marqué comme validé', 'ok');
  loadAudit();
}
