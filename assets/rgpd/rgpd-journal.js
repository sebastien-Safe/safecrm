// ==========================================================================
// S@FE CRM — Journal RGPD
// Traçabilité complète des opérations sur données personnelles
// ==========================================================================

// ============================================================
// logRgpd() — helper global de journalisation
// Appelé depuis contacts, contrats, interactions, profil, exports
// ============================================================
async function logRgpd(action, module, opts = {}) {
  if (typeof sb === 'undefined' || !state?.user) return;

  const role = state.profile?.role === 'super_admin'       ? 'Super Admin'
    : state.profile?.is_admin                               ? 'Administrateur'
    : state.profile?.role === 'resp-equipe'                 ? 'Responsable équipe'
    : state.profile?.role === 'collab-assurances'           ? 'Collaborateur Assurances'
    : 'Utilisateur';

  try {
    await sb.from('audit_logs').insert({
      user_id:             state.user.id,
      user_role:           role,
      action,
      module,
      entity_type:         opts.entityType || null,
      entity_id:           opts.entityId   || null,
      donnees_concernees:  opts.donnees    || null,
      criticite:           opts.criticite  || 'Info',
      resultat:            opts.resultat   || 'Succès',
      details: {
        user_nom: state.profile
          ? `${state.profile.prenom || ''} ${state.profile.nom || ''}`.trim()
          : null,
        ...(opts.details || {}),
      },
    });
  } catch (e) {
    console.warn('[RGPD Journal]', e);
  }
}

// ============================================================
// Dictionnaires
// ============================================================
const JOURNAL_ACTION_LABELS = {
  contact_cree:                  'Création contact',
  contact_cree_web:              'Création contact (formulaire web)',
  contact_modifie:               'Modification contact',
  contact_supprime:              'Suppression contact',
  contrat_cree:                  'Création contrat',
  contrat_modifie:               'Modification contrat',
  contrat_supprime:              'Suppression contrat',
  interaction_creee:             'Nouvel échange',
  interaction_modifiee:          'Modification échange',
  interaction_supprimee:         'Suppression échange',
  profil_modifie:                'Modification profil',
  export_registre_pdf:           'Export registre RGPD (PDF)',
  export_bordereau_commission:   'Export bordereau commission',
  export_journal_csv:            'Export journal RGPD (CSV)',
  export_journal_pdf:            'Export journal RGPD (PDF)',
  export_journal_excel:          'Export journal RGPD (Excel)',
  paiement_confirme:             'Paiement confirmé',
  paiement_echoue:               'Échec paiement',
  paiement_recouvre:             'Paiement recouvré',
  renouvellement_confirme:       'Renouvellement Stripe',
  demande_resiliation_creee:     'Demande de résiliation',
  demande_resiliation_rejetee:   'Demande résiliation rejetée',
  resiliation_validee:           'Résiliation validée',
  resiliation_confirmee_stripe:  'Résiliation confirmée (Stripe)',
  resiliation_erreur_stripe:     'Erreur résiliation Stripe',
  resiliation_timeout_48h:       'Alerte résiliation 48h',
  resiliation_programmee_stripe: 'Résiliation programmée (Stripe)',
  resiliation_annulee_stripe:    'Résiliation annulée (Stripe)',
  resiliation_effective_stripe:  'Résiliation effective (Stripe)',
  // Actions RGPD — ajoutées session 2026-06
  transfert_contact:             'Transfert contact',
  role_utilisateur_modifie:      'Modification rôle utilisateur',
  utilisateur_supprime:          'Suppression compte utilisateur',
  utilisateur_bloque:            'Accès utilisateur révoqué',
  utilisateur_debloque:          'Accès utilisateur restauré',
  mandat_signe:                  'Signature mandat DCI',
  clause_confidentialite_signee: 'Signature clause de confidentialité',
  pj_uploadee:                   'Pièce jointe déposée',
  pj_supprimee:                  'Pièce jointe supprimée',
  pdf_contrat_genere:            'Bon de commande généré (PDF)',
  mot_de_passe_reinitialise:     'Réinitialisation mot de passe',
  mot_de_passe_modifie:          'Modification mot de passe',
  fournisseur_modifie:           'Registre fournisseurs modifié',
  incident_nis2_declare:         'Incident NIS2 déclaré',
  incident_nis2_anssi_notifie:   'Notification ANSSI enregistrée',
  export_portabilite_contact:    'Export portabilité données (RGPD art. 20)',
  purge_donnees_perimees:        'Purge données périmées (RGPD art. 5)',
  js_error:                      'Erreur JavaScript capturée (monitoring)',
  // Dossiers victimes 17Cyber — ajoutées session 2026-07
  victim_lead_cree:              'Dossier victime 17Cyber créé',
  victim_devis_genere:           'Devis victime 17Cyber généré',
  victim_rapport_genere:         'Rapport victime 17Cyber généré',
  victim_etape_modifiee:         'Étape pipeline victime modifiée',
  victim_paiement_confirme:      'Paiement victime 17Cyber confirmé',
  victim_dossier_cloture:        'Dossier victime 17Cyber clôturé',
  victim_donnees_purgees:        'Purge RGPD dossier victime (données/documents)',
  // Demandes d'exercice des droits (contacts internes) — ajoutées session 2026-07
  demande_droit_creee:           'Demande de droit créée',
  demande_droit_modifiee:        'Demande de droit modifiée',
  opposition_enregistree:        'Opposition enregistrée (RGPD KO)',
};

const JOURNAL_CRITICITE_CLASS = {
  Info:      'badge-blue',
  Attention: 'badge-orange',
  Critique:  'badge-red',
};

// ============================================================
// État interne du journal
// ============================================================
let _journalData     = [];
let _journalProfiles = {};

// ============================================================
// Sous-onglets RGPD — navigation dans le panel registre
// ============================================================
function initRgpdSubTabs() {
  document.querySelectorAll('[data-rgpd-tab]').forEach(btn => {
    if (!btn._rgpdBound) {
      btn.addEventListener('click', () => switchRgpdSubTab(btn.dataset.rgpdTab));
      btn._rgpdBound = true;
    }
  });
  switchRgpdSubTab((typeof state !== 'undefined' && state._rgpdSubTab) || 'registre-traitements');
}

function switchRgpdSubTab(tab) {
  if (typeof state !== 'undefined') state._rgpdSubTab = tab;
  document.querySelectorAll('[data-rgpd-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.rgpdTab === tab));
  ['registre-traitements', 'journal-rgpd', 'demandes-droits', 'rapports-conformite'].forEach(t => {
    const el = document.getElementById('rgpd-panel-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'journal-rgpd')        renderJournalRGPD();
  if (tab === 'demandes-droits')     renderDemandesDroits();
  if (tab === 'rapports-conformite') renderRapportsConformite();
}

// ============================================================
// Override de renderRegistreRGPD (app.js) pour injecter les sous-onglets
// Note : on utilise window.renderRegistreRGPD = ... (pas une déclaration function)
// pour éviter le hoisting qui referait pointer _renderRegistreOriginal vers
// la nouvelle fonction elle-même (récursion infinie).
// ============================================================
const _renderRegistreOriginal = typeof renderRegistreRGPD === 'function' ? renderRegistreRGPD : function () {};
window.renderRegistreRGPD = function renderRegistreRGPD() {
  _renderRegistreOriginal();
  initRgpdSubTabs();
};

// ============================================================
// Journal RGPD — rendu principal
// ============================================================
function renderJournalRGPD() {
  const container = document.getElementById('journal-rgpd-container');
  if (!container) return;

  if (container.dataset.initialized === '1') {
    applyJournalFilters();
    return;
  }
  container.dataset.initialized = '1';

  container.innerHTML = `
    <div class="panel-block">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px">
        <div>
          <h3 style="margin:0">Journal RGPD</h3>
          <p class="mut" style="margin-top:5px;font-size:.85rem">
            Traçabilité immuable de toutes les opérations sur données personnelles (Article 30 RGPD).<br>
            Les entrées ne peuvent être ni modifiées ni supprimées.
          </p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-out btn-sm" onclick="exportJournalCSV()">📊 CSV</button>
          <button class="btn btn-out btn-sm" onclick="exportJournalExcel()">📗 Excel</button>
          <button class="btn btn-out btn-sm" onclick="exportJournalPDF()">📄 PDF</button>
          <button class="btn btn-out btn-sm" onclick="printJournalRGPD()">🖨️ Imprimer</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:8px;margin-bottom:12px">
        <input  type="text" id="journal-search"
                class="form-control" placeholder="Recherche…"
                oninput="applyJournalFilters()">
        <select id="journal-filter-module" class="form-control" onchange="applyJournalFilters()">
          <option value="">Tous les modules</option>
          <option value="Contacts">Contacts</option>
          <option value="Contrats">Contrats</option>
          <option value="Profil">Profil</option>
          <option value="RGPD">RGPD</option>
          <option value="Stripe">Stripe</option>
        </select>
        <select id="journal-filter-criticite" class="form-control" onchange="applyJournalFilters()">
          <option value="">Toutes criticités</option>
          <option value="Info">Info</option>
          <option value="Attention">Attention</option>
          <option value="Critique">Critique</option>
        </select>
        <input  type="date" id="journal-filter-date-debut"
                class="form-control" title="Depuis"
                onchange="applyJournalFilters()">
        <input  type="date" id="journal-filter-date-fin"
                class="form-control" title="Jusqu'au"
                onchange="applyJournalFilters()">
        <select id="journal-filter-resultat" class="form-control" onchange="applyJournalFilters()">
          <option value="">Tous résultats</option>
          <option value="Succès">Succès</option>
          <option value="Erreur">Erreur</option>
        </select>
      </div>

      <div id="journal-count-bar" class="mut" style="font-size:.8rem;margin-bottom:8px"></div>

      <div class="scrollx">
        <table class="tbl" id="journal-table">
          <thead><tr>
            <th>Date / Heure</th>
            <th>Utilisateur</th>
            <th>Rôle</th>
            <th>Module</th>
            <th>Action</th>
            <th>Données concernées</th>
            <th>Résultat</th>
            <th>Criticité</th>
            <th>Référence</th>
          </tr></thead>
          <tbody id="journal-tbody">
            <tr><td colspan="9" class="empty">Chargement…</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  loadJournalRGPD();
}

async function loadJournalRGPD() {
  const { data, error } = await sb.from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    const tbody = document.getElementById('journal-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="empty" style="color:#dc2626">Erreur : ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  _journalData = data || [];

  const userIds = [...new Set(_journalData.map(e => e.user_id).filter(Boolean))];
  if (userIds.length) {
    const { data: profiles } = await sb.from('profiles')
      .select('id, prenom, nom, email')
      .in('id', userIds);
    _journalProfiles = {};
    (profiles || []).forEach(p => { _journalProfiles[p.id] = p; });
  }

  applyJournalFilters();
}

function _nomUtilisateur(e) {
  const p = _journalProfiles[e.user_id];
  return e.details?.user_nom
    || (p ? `${p.prenom || ''} ${p.nom || ''}`.trim() || p.email : null)
    || (e.user_id ? e.user_id.slice(0, 8) : 'Système');
}

function applyJournalFilters() {
  const search   = (document.getElementById('journal-search')?.value || '').toLowerCase();
  const module   = document.getElementById('journal-filter-module')?.value   || '';
  const crit     = document.getElementById('journal-filter-criticite')?.value || '';
  const dDebut   = document.getElementById('journal-filter-date-debut')?.value || '';
  const dFin     = document.getElementById('journal-filter-date-fin')?.value   || '';
  const resultat = document.getElementById('journal-filter-resultat')?.value   || '';

  const filtered = _journalData.filter(e => {
    if (module   && e.module    !== module)   return false;
    if (crit     && e.criticite !== crit)     return false;
    if (resultat && e.resultat  !== resultat) return false;
    if (dDebut   && e.created_at < dDebut)   return false;
    if (dFin     && e.created_at.slice(0, 10) > dFin) return false;
    if (search) {
      const haystack = [
        e.action, e.module, e.donnees_concernees, e.resultat,
        e.entity_type, e.entity_id, e.user_role,
        _nomUtilisateur(e),
        JSON.stringify(e.details || {}),
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const bar = document.getElementById('journal-count-bar');
  if (bar) bar.textContent = `${filtered.length} entrée${filtered.length !== 1 ? 's' : ''} — total journal : ${_journalData.length} — non modifiable.`;

  renderJournalTable(filtered);
}

function renderJournalTable(logs) {
  const tbody = document.getElementById('journal-tbody');
  if (!tbody) return;

  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">Aucune entrée trouvée.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.slice(0, 500).map(e => {
    const nom    = _nomUtilisateur(e);
    const action = JOURNAL_ACTION_LABELS[e.action] || e.action;
    const crit   = e.criticite || 'Info';
    const res    = e.resultat  || 'Succès';
    const ref    = e.entity_id
      ? (e.entity_type === 'contract' ? 'CT-' : 'C-') + e.entity_id.slice(0, 8).toUpperCase()
      : '—';
    const dt     = e.created_at ? new Date(e.created_at).toLocaleString('fr-FR') : '—';

    return `<tr style="cursor:pointer" onclick="openJournalDetail('${e.id}')">
      <td class="nowrap" style="font-size:.78rem">${dt}</td>
      <td>${escapeHtml(nom)}</td>
      <td><span class="badge badge-gray" style="font-size:.72rem">${escapeHtml(e.user_role || '—')}</span></td>
      <td style="font-size:.82rem">${escapeHtml(e.module || e.entity_type || '—')}</td>
      <td style="font-size:.82rem">${escapeHtml(action)}</td>
      <td style="font-size:.78rem;color:var(--muted)">${escapeHtml(e.donnees_concernees || '—')}</td>
      <td><span class="badge ${res === 'Erreur' ? 'badge-red' : 'badge-green'}" style="font-size:.72rem">${escapeHtml(res)}</span></td>
      <td><span class="badge ${JOURNAL_CRITICITE_CLASS[crit] || 'badge-blue'}" style="font-size:.72rem">${escapeHtml(crit)}</span></td>
      <td style="font-size:.75rem">${escapeHtml(ref)}</td>
    </tr>`;
  }).join('');

  if (logs.length > 500) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="9" class="empty" style="color:#d97706">Affichage limité à 500 entrées. Utilisez les filtres ou exportez en CSV pour obtenir la liste complète.</td>`;
    tbody.appendChild(tr);
  }
}

function openJournalDetail(id) {
  const e = _journalData.find(x => x.id === id);
  if (!e) return;

  const nom    = _nomUtilisateur(e);
  const dt     = e.created_at ? new Date(e.created_at).toLocaleString('fr-FR') : '—';
  const action = JOURNAL_ACTION_LABELS[e.action] || e.action;
  const crit   = e.criticite || 'Info';
  const res    = e.resultat  || 'Succès';

  const rows = [
    ['Date / Heure',       dt],
    ['Utilisateur',        nom],
    ['Rôle',               e.user_role || '—'],
    ['Action',             action],
    ['Module',             e.module || e.entity_type || '—'],
    ['Données concernées', e.donnees_concernees || '—'],
    ['Résultat',           `<span class="badge ${res === 'Erreur' ? 'badge-red' : 'badge-green'}">${escapeHtml(res)}</span>`],
    ['Criticité',          `<span class="badge ${JOURNAL_CRITICITE_CLASS[crit] || 'badge-blue'}">${escapeHtml(crit)}</span>`],
    ['Référence entité',   e.entity_id ? `${e.entity_type || ''} — ${e.entity_id}` : '—'],
    ['Adresse IP',         e.ip_address || '—'],
    ['ID entrée',          e.id],
  ];

  let modal = document.getElementById('journal-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id        = 'journal-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:580px">
        <div class="modal-header">
          <span>Détail de l'entrée RGPD</span>
          <button class="modal-close" onclick="document.getElementById('journal-detail-modal').classList.remove('show')">✕</button>
        </div>
        <div class="modal-body" id="jd-body"></div>
      </div>`;
    document.body.appendChild(modal);
  }

  const detailsHtml = e.details && Object.keys(e.details).length
    ? `<pre style="background:var(--bg-alt,#f5f5f5);border-radius:6px;padding:10px;font-size:.73rem;overflow:auto;max-height:160px">${escapeHtml(JSON.stringify(e.details, null, 2))}</pre>`
    : '<p class="mut" style="font-size:.85rem">—</p>';

  document.getElementById('jd-body').innerHTML = `
    <table class="tbl" style="font-size:.84rem;margin-bottom:14px">
      ${rows.map(([k, v]) => `
        <tr>
          <th style="white-space:nowrap;padding:6px 10px;font-weight:600">${escapeHtml(k)}</th>
          <td style="padding:6px 10px">${v.includes('<') ? v : escapeHtml(v)}</td>
        </tr>`).join('')}
    </table>
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:4px"><b>Détails techniques :</b></div>
    ${detailsHtml}
    <p class="mut" style="font-size:.72rem;margin-top:10px">Cette entrée est immuable conformément à l'Article 30 RGPD.</p>`;

  modal.classList.add('show');
}

// ============================================================
// Utilitaires d'export
// ============================================================
function _getFilteredJournal() {
  const search   = (document.getElementById('journal-search')?.value || '').toLowerCase();
  const module   = document.getElementById('journal-filter-module')?.value    || '';
  const crit     = document.getElementById('journal-filter-criticite')?.value || '';
  const dDebut   = document.getElementById('journal-filter-date-debut')?.value || '';
  const dFin     = document.getElementById('journal-filter-date-fin')?.value   || '';
  const resultat = document.getElementById('journal-filter-resultat')?.value   || '';

  return _journalData.filter(e => {
    if (module   && e.module    !== module)   return false;
    if (crit     && e.criticite !== crit)     return false;
    if (resultat && e.resultat  !== resultat) return false;
    if (dDebut   && e.created_at < dDebut)   return false;
    if (dFin     && e.created_at.slice(0, 10) > dFin) return false;
    if (search) {
      const h = [e.action, e.module, e.donnees_concernees, e.resultat,
        e.entity_type, e.entity_id, e.user_role, _nomUtilisateur(e),
        JSON.stringify(e.details || {})].join(' ').toLowerCase();
      if (!h.includes(search)) return false;
    }
    return true;
  });
}

function _journalToRows(logs) {
  const headers = ['Date/Heure','Utilisateur','Rôle','Module','Action','Données concernées','Résultat','Criticité','Référence','IP','Détails'];
  const data = logs.map(e => [
    new Date(e.created_at).toLocaleString('fr-FR'),
    _nomUtilisateur(e),
    e.user_role || '',
    e.module || e.entity_type || '',
    JOURNAL_ACTION_LABELS[e.action] || e.action,
    e.donnees_concernees || '',
    e.resultat || 'Succès',
    e.criticite || 'Info',
    e.entity_id ? `${e.entity_type || ''}-${e.entity_id.slice(0, 8)}` : '',
    e.ip_address || '',
    JSON.stringify(e.details || {}),
  ]);
  return [headers, ...data];
}

function exportJournalCSV() {
  const logs = _getFilteredJournal();
  const rows = _journalToRows(logs);
  const csv  = '﻿' + rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')
  ).join('\n');
  const a    = document.createElement('a');
  a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `journal-rgpd-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  logRgpd('export_journal_csv', 'RGPD', { criticite: 'Critique', donnees: 'Journal RGPD complet', details: { count: logs.length } });
}

function exportJournalExcel() {
  const logs = _getFilteredJournal();
  const rows = _journalToRows(logs);
  const th   = rows[0].map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const trs  = rows.slice(1).map(r =>
    '<tr>' + r.map(v => `<td>${escapeHtml(String(v))}</td>`).join('') + '</tr>'
  ).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="UTF-8">
    <style>th{background:#1a1a2e;color:#fff;font-weight:bold}td,th{border:1px solid #ccc;padding:4px 8px}tr:nth-child(even)td{background:#f5f7fa}</style>
    </head><body>
    <h3>Journal RGPD — S@FE CRM — ${new Date().toLocaleDateString('fr-FR')}</h3>
    <table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
    </body></html>`;
  const a = document.createElement('a');
  a.href  = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent(html);
  a.download = `journal-rgpd-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  logRgpd('export_journal_excel', 'RGPD', { criticite: 'Critique', donnees: 'Journal RGPD complet', details: { count: logs.length } });
}

function exportJournalPDF() {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) { alert('jsPDF non disponible.'); return; }
  const logs = _getFilteredJournal();
  const doc  = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const W    = 277;
  let y      = 15;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(10, 22, 40);
  doc.text('Journal RGPD — S@FE CRM', 10, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
  doc.text(`Édité le ${new Date().toLocaleString('fr-FR')} — ${logs.length} entrées — Document immuable`, 10, y); y += 8;

  const cols = ['Date/Heure','Utilisateur','Rôle','Module','Action','Données','Résultat','Criticité','Réf.'];
  const cw   = [35, 30, 22, 22, 42, 34, 20, 18, 24];
  let x = 10;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.setFillColor(10, 22, 40); doc.setTextColor(255, 255, 255);
  doc.rect(10, y - 1, W, 6, 'F');
  cols.forEach((c, i) => { doc.text(c, x + 1, y + 3); x += cw[i]; });
  y += 7;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(30, 30, 30);

  logs.slice(0, 500).forEach((e, idx) => {
    if (y > 188) { doc.addPage(); y = 15; }
    if (idx % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(10, y - 1, W, 5.5, 'F');
    }
    const nom    = _nomUtilisateur(e).slice(0, 22);
    const action = (JOURNAL_ACTION_LABELS[e.action] || e.action).slice(0, 40);
    const ref    = e.entity_id ? (e.entity_type || '').slice(0, 4) + '-' + e.entity_id.slice(0, 6) : '';
    const vals   = [
      new Date(e.created_at).toLocaleString('fr-FR'),
      nom,
      (e.user_role || '').slice(0, 18),
      (e.module || e.entity_type || '').slice(0, 18),
      action,
      (e.donnees_concernees || '').slice(0, 30),
      (e.resultat || 'Succès').slice(0, 15),
      (e.criticite || 'Info').slice(0, 12),
      ref,
    ];
    x = 10;
    vals.forEach((v, i) => { doc.text(String(v), x + 1, y + 3, { maxWidth: cw[i] - 2 }); x += cw[i]; });
    y += 5.5;
  });

  doc.save(`journal-rgpd-${new Date().toISOString().slice(0, 10)}.pdf`);
  logRgpd('export_journal_pdf', 'RGPD', { criticite: 'Critique', donnees: 'Journal RGPD complet', details: { count: logs.length } });
}

function printJournalRGPD() {
  const logs = _getFilteredJournal();
  const rows = _journalToRows(logs);
  const th   = rows[0].map(h => `<th>${h}</th>`).join('');
  const trs  = rows.slice(1).map(r =>
    '<tr>' + r.map(v => `<td>${String(v).replace(/</g, '&lt;')}</td>`).join('') + '</tr>'
  ).join('');
  const w = window.open('', '_blank');
  if (!w) { alert('Autorisez les popups pour imprimer.'); return; }
  w.document.write(`<!DOCTYPE html><html lang="fr">
    <head><meta charset="UTF-8"><title>Journal RGPD</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:10px;margin:20px}
      h2{font-size:14px;margin-bottom:4px}
      p{font-size:9px;color:#666;margin-bottom:12px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ccc;padding:3px 5px}
      th{background:#1a1a2e;color:#fff}
      tr:nth-child(even) td{background:#f5f7fa}
      @media print{@page{size:landscape;margin:10mm}}
    </style></head>
    <body>
      <h2>Journal RGPD — S@FE CRM</h2>
      <p>Édité le ${new Date().toLocaleString('fr-FR')} — ${logs.length} entrées — Document immuable (Article 30 RGPD)</p>
      <table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
      <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
  w.document.close();
}

// ============================================================
// Demandes d'exercice des droits (Articles 15-22 RGPD)
// Contacts internes connus du CRM S@FE (distinct du module DPO clients,
// qui gère des demandeurs externes non présents dans ce CRM).
// ============================================================
const RGPD_DROITS_INTERNES = [
  { key: 'accès',         label: "Droit d'accès (Art.15)",                    icon: '🔍' },
  { key: 'rectification', label: 'Rectification (Art.16)',                    icon: '✏️' },
  { key: 'suppression',   label: 'Effacement ("droit à l\'oubli") (Art.17)',  icon: '🗑️' },
  { key: 'portabilité',   label: 'Portabilité (Art.20)',                      icon: '📤' },
  { key: 'opposition',    label: 'Opposition (Art.21)',                       icon: '🚫' },
  { key: 'limitation',    label: 'Limitation (Art.18)',                       icon: '⏸️' },
];

let _demandesDroitsData = [];

function renderDemandesDroits() {
  const c = document.getElementById('demandes-droits-container');
  if (!c || c.dataset.initialized === '1') { loadDemandesDroitsTable(); return; }
  c.dataset.initialized = '1';
  c.innerHTML = `
    <div class="panel-block">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px">
        <div>
          <h3 style="margin:0">Demandes d'exercice des droits</h3>
          <p class="mut" style="margin-top:5px;font-size:.85rem">Articles 15 à 22 RGPD — droit d'accès, de rectification, d'effacement, de portabilité et d'opposition, pour les contacts connus du CRM.</p>
        </div>
        <button class="btn btn-gold btn-sm" onclick="openDemandeDroitModal()">+ Nouvelle demande</button>
      </div>
      <div class="scrollx">
        <table class="tbl">
          <thead><tr>
            <th>Date de réception</th>
            <th>Contact</th>
            <th>Type de droit</th>
            <th>Statut</th>
            <th>Délai légal restant</th>
          </tr></thead>
          <tbody id="demandes-droits-tbody"><tr><td colspan="5" class="empty">Chargement…</td></tr></tbody>
        </table>
      </div>
      <div style="margin-top:16px;padding:12px 16px;background:#fef9c3;border-left:3px solid #d97706;border-radius:6px">
        <p style="margin:0;font-size:.83rem"><b>⏱️ Rappel légal :</b> vous disposez d'<b>1 mois</b> pour répondre à toute demande d'exercice des droits (Articles 12 et 19 RGPD). Ce délai peut être prorogé de 2 mois supplémentaires en cas de complexité.</p>
      </div>
    </div>`;
  loadDemandesDroitsTable();
}

async function loadDemandesDroitsTable() {
  const tbody = document.getElementById('demandes-droits-tbody');
  if (!tbody) return;
  const { data, error } = await sb.from('rgpd_demandes_droits')
    .select('*, contacts(nom, prenom, entreprise, email, rgpd_ko)')
    .order('date_demande', { ascending: false });
  if (error) { tbody.innerHTML = `<tr><td colspan="5" class="empty">Erreur : ${escapeHtml(error.message)}</td></tr>`; return; }

  _demandesDroitsData = data || [];
  if (!_demandesDroitsData.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Aucune demande enregistrée.</td></tr>';
    return;
  }

  const now = new Date();
  const statutBadge = { 'Reçue': 'badge-blue', 'En cours': 'badge-orange', 'Traitée': 'badge-green', 'Refusée': 'badge-red' };
  tbody.innerHTML = _demandesDroitsData.map(d => {
    const droit = RGPD_DROITS_INTERNES.find(x => x.key === d.type_droit) || { icon: '📩', label: d.type_droit };
    const contact = d.contacts;
    const dl = d.date_limite ? new Date(d.date_limite) : null;
    const diff = dl ? Math.ceil((dl - now) / 86400000) : null;
    const dlBadge = dl
      ? (diff < 0 ? `<span class="badge badge-red">⚠ Dépassé de ${Math.abs(diff)}j</span>`
        : diff <= 7 ? `<span class="badge badge-orange">⏱ J-${diff}</span>`
        : `<span class="badge badge-green">⏱ J-${diff}</span>`)
      : '—';
    return `
      <tr style="cursor:pointer" onclick="openDemandeDroitModal('${d.id}')">
        <td>${formatDate(d.date_demande)}</td>
        <td>${escapeHtml(contact?.nom || '—')} ${escapeHtml(contact?.prenom || '')}${contact?.entreprise ? ' — ' + escapeHtml(contact.entreprise) : ''}</td>
        <td>${droit.icon} ${escapeHtml(droit.label)}</td>
        <td><span class="badge ${statutBadge[d.statut] || 'badge-gray'}">${escapeHtml(d.statut || 'Reçue')}</span></td>
        <td>${dlBadge}</td>
      </tr>`;
  }).join('');
}

function openDemandeDroitModal(id = null) {
  document.getElementById('rd-id').value = id || '';
  document.getElementById('demande-droit-title').textContent = id ? 'Modifier la demande' : 'Nouvelle demande de droit';
  document.getElementById('rd-delete-btn').style.display = id ? '' : 'none';
  document.getElementById('rd-statut-field').classList.toggle('is-hidden', !id);

  const contactSelect = document.getElementById('rd-contact');
  const contacts = [...(state.contacts || [])].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  contactSelect.innerHTML = contacts.map(c =>
    `<option value="${c.id}">${escapeHtml(c.nom)} ${escapeHtml(c.prenom || '')}${c.entreprise ? ' — ' + escapeHtml(c.entreprise) : ''}</option>`
  ).join('');

  document.getElementById('rd-type').innerHTML = RGPD_DROITS_INTERNES.map(r =>
    `<option value="${r.key}">${r.icon} ${escapeHtml(r.label)}</option>`
  ).join('');

  const existing = id ? _demandesDroitsData.find(d => d.id === id) : null;
  document.getElementById('rd-date').value = existing?.date_demande || todayISO();
  document.getElementById('rd-desc').value  = existing?.description || '';
  if (existing) {
    contactSelect.value = existing.contact_id;
    document.getElementById('rd-type').value = existing.type_droit;
    document.getElementById('rd-statut').value = existing.statut || 'Reçue';
  }

  renderRdAutomationButton();
  document.getElementById('rd-contact').onchange = renderRdAutomationButton;
  document.getElementById('rd-type').onchange = renderRdAutomationButton;

  document.getElementById('demande-droit-modal').classList.add('show');
}

function closeDemandeDroitModal() {
  document.getElementById('demande-droit-modal').classList.remove('show');
}

function renderRdAutomationButton() {
  const type = document.getElementById('rd-type').value;
  const contactId = document.getElementById('rd-contact').value;
  const zone = document.getElementById('rd-automation');
  const contact = (state.contacts || []).find(c => c.id === contactId);

  if (type === 'accès') {
    zone.innerHTML = `<button class="btn btn-out btn-sm" type="button" onclick="rdGenererPdfAcces()">🔍 Générer le PDF de ses données</button>`;
  } else if (type === 'opposition') {
    const dejaKo = contact?.rgpd_ko;
    zone.innerHTML = dejaKo
      ? `<p class="mut" style="font-size:.8rem">🚫 Ce contact est déjà en opposition (RGPD KO) — fiche verrouillée.</p>`
      : `<button class="btn btn-out btn-sm" type="button" onclick="rdEnregistrerOpposition()">🚫 Enregistrer l'opposition &amp; générer l'accusé</button>`;
  } else {
    zone.innerHTML = '';
  }
}

async function saveDemandeDroit() {
  const id = document.getElementById('rd-id').value || null;
  const contactId = document.getElementById('rd-contact').value;
  if (!contactId) { showCrmToast?.('❌ Sélectionnez un contact'); return; }
  const dateDemande = document.getElementById('rd-date').value || todayISO();

  const payload = {
    contact_id: contactId,
    type_droit: document.getElementById('rd-type').value,
    date_demande: dateDemande,
    date_limite: id ? undefined : new Date(new Date(dateDemande).getTime() + 30 * 86400000).toISOString().slice(0, 10),
    statut: id ? document.getElementById('rd-statut').value : 'Reçue',
    description: document.getElementById('rd-desc').value.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (payload.date_limite === undefined) delete payload.date_limite;

  const { error } = id
    ? await sb.from('rgpd_demandes_droits').update(payload).eq('id', id)
    : await sb.from('rgpd_demandes_droits').insert({ ...payload, created_by: state.user.id });

  if (error) { showCrmToast?.('❌ Erreur : ' + error.message); return; }

  if (typeof logRgpd === 'function') {
    await logRgpd(id ? 'demande_droit_modifiee' : 'demande_droit_creee', 'RGPD', {
      criticite: 'Attention', donnees: payload.type_droit, resultat: 'Succès',
      details: { contact_id: contactId },
    });
  }

  closeDemandeDroitModal();
  showCrmToast?.(id ? '✅ Demande mise à jour' : '✅ Demande enregistrée');
  loadDemandesDroitsTable();
}

async function deleteDemandeDroit() {
  const id = document.getElementById('rd-id').value;
  if (!id || !confirm('Supprimer cette demande ?')) return;
  const { error } = await sb.from('rgpd_demandes_droits').delete().eq('id', id);
  if (error) { showCrmToast?.('❌ Erreur : ' + error.message); return; }
  closeDemandeDroitModal();
  showCrmToast?.('✅ Demande supprimée');
  loadDemandesDroitsTable();
}

async function _rdMarquerTraitee(id, reponse) {
  await sb.from('rgpd_demandes_droits').update({
    statut: 'Traitée',
    reponse,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
}

// ── Automatisation Art.15 — Droit d'accès : PDF réel des données du contact ──
async function rdGenererPdfAcces() {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) { showCrmToast?.('❌ jsPDF non disponible'); return; }
  const contactId = document.getElementById('rd-contact').value;
  const contact = (state.contacts || []).find(c => c.id === contactId);
  if (!contact) return;

  const [{ data: contrats }, { data: taches }, { data: interactions }] = await Promise.all([
    sb.from('contracts').select('type, formule, montant, recurrence, statut, date_debut, date_echeance').eq('contact_id', contactId),
    sb.from('tasks').select('titre, statut, priorite, echeance').eq('contact_id', contactId),
    sb.from('interactions').select('type, date, objet, contenu').eq('contact_id', contactId),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  const line = (txt, size = 9, bold = false) => {
    if (y > 275) { doc.addPage(); y = 18; }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(String(txt), 14, y);
    y += size >= 12 ? 7 : 5;
  };

  line('Export de vos données personnelles — Droit d\'accès (Art.15 RGPD)', 13, true);
  line(`Généré le ${new Date().toLocaleDateString('fr-FR')} par S@FE SAS`, 8);
  y += 3;
  line('Identité', 11, true);
  line(`${contact.nom || ''} ${contact.prenom || ''}`);
  if (contact.entreprise) line(`Entreprise : ${contact.entreprise}`);
  if (contact.email) line(`E-mail : ${contact.email}`);
  if (contact.telephone) line(`Téléphone : ${contact.telephone}`);
  if (contact.adresse) line(`Adresse : ${contact.adresse} ${contact.code_postal_ville || ''}`);
  y += 3;

  line(`Contrats (${contrats?.length || 0})`, 11, true);
  (contrats || []).forEach(c => line(`• ${c.type || ''} ${c.formule || ''} — ${c.statut || ''} — ${c.montant ? c.montant + ' €' : ''}`));
  y += 3;

  line(`Tâches (${taches?.length || 0})`, 11, true);
  (taches || []).forEach(t => line(`• ${t.titre} — ${t.statut || ''}${t.echeance ? ' — éch. ' + t.echeance : ''}`));
  y += 3;

  line(`Échanges (${interactions?.length || 0})`, 11, true);
  (interactions || []).forEach(i => line(`• ${i.date || ''} — ${i.objet || i.type || ''}`));

  doc.save(`donnees-personnelles-${(contact.nom || 'contact').replace(/[^a-z0-9]/gi, '_')}-${todayISO()}.pdf`);

  const id = document.getElementById('rd-id').value;
  if (id) await _rdMarquerTraitee(id, 'PDF de données personnelles généré et remis au demandeur (Art.15 RGPD).');

  if (typeof logRgpd === 'function') {
    await logRgpd('export_portabilite_contact', 'RGPD', {
      criticite: 'Attention', donnees: 'Contrats, tâches, échanges', resultat: 'Succès',
      details: { contact_id: contactId, article: 'Art.15 RGPD — Droit d\'accès' },
    });
  }

  showCrmToast?.('✅ PDF généré' + (id ? ' — demande marquée Traitée' : ''));
  closeDemandeDroitModal();
  loadDemandesDroitsTable();
}

// ── Automatisation Art.21 — Droit d'opposition : verrouillage + accusé PDF ──
async function rdEnregistrerOpposition() {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) { showCrmToast?.('❌ jsPDF non disponible'); return; }
  const contactId = document.getElementById('rd-contact').value;
  const contact = (state.contacts || []).find(c => c.id === contactId);
  if (!contact) return;
  if (!confirm(`Enregistrer l'opposition de ${contact.nom} ? Sa fiche sera verrouillée et exclue des relances/prospection.`)) return;

  const { error } = await sb.from('contacts').update({ rgpd_ko: true }).eq('id', contactId);
  if (error) { showCrmToast?.('❌ Erreur : ' + error.message); return; }
  contact.rgpd_ko = true;
  if (typeof renderContacts === 'function') renderContacts();

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Accusé de réception — Droit d\'opposition (Art.21 RGPD)', 14, y); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 14, y); y += 6;
  doc.text(`Concernant : ${contact.nom || ''} ${contact.prenom || ''}${contact.entreprise ? ' — ' + contact.entreprise : ''}`, 14, y); y += 10;
  const txt = `Nous accusons réception de votre demande d'opposition au traitement de vos données personnelles.\n\nConformément à l'article 21 du RGPD, le traitement de vos données à des fins de prospection et de relance commerciale a été immédiatement interrompu. Votre fiche a été verrouillée dans notre système d'information.\n\nLes données déjà nécessaires à l'exécution de nos obligations légales et contractuelles en cours restent conservées conformément à nos durées de conservation légales.\n\nPour toute question, contactez-nous à contact@safe-digitalisation.fr.`;
  doc.text(doc.splitTextToSize(txt, 180), 14, y);
  doc.save(`accuse-opposition-${(contact.nom || 'contact').replace(/[^a-z0-9]/gi, '_')}-${todayISO()}.pdf`);

  const id = document.getElementById('rd-id').value;
  if (id) await _rdMarquerTraitee(id, 'Opposition enregistrée : traitement stoppé (RGPD KO), accusé de réception remis (Art.21 RGPD).');

  if (typeof logRgpd === 'function') {
    await logRgpd('opposition_enregistree', 'RGPD', {
      criticite: 'Critique', donnees: 'Opposition au traitement', resultat: 'Succès',
      details: { contact_id: contactId, article: 'Art.21 RGPD — Droit d\'opposition', action: 'rgpd_ko = true' },
    });
  }

  showCrmToast?.('✅ Opposition enregistrée, fiche verrouillée' + (id ? ' — demande marquée Traitée' : ''));
  closeDemandeDroitModal();
  loadDemandesDroitsTable();
}

// ============================================================
// Rapports de conformité (auto-générés)
// ============================================================
async function renderRapportsConformite() {
  const c = document.getElementById('rapports-conformite-container');
  if (!c) return;

  c.innerHTML = '<div class="panel-block"><p class="empty">Génération du rapport en cours…</p></div>';

  if (!_journalData.length) await loadJournalRGPD();

  const now      = new Date();
  const seuil30  = new Date(now - 30 * 86400000).toISOString();
  const logs30   = _journalData.filter(e => e.created_at >= seuil30);
  const contacts  = (typeof state !== 'undefined' && state.contacts)  || [];
  const contracts = (typeof state !== 'undefined' && state.contracts) || [];

  const stats = {
    totalJournal:   _journalData.length,
    dernieres30j:   logs30.length,
    critique:       _journalData.filter(e => e.criticite === 'Critique').length,
    erreurs:        _journalData.filter(e => e.resultat === 'Erreur').length,
    suppressions:   _journalData.filter(e => (e.action || '').includes('supprim')).length,
    exports:        _journalData.filter(e => (e.action || '').startsWith('export_')).length,
    contactsTotal:  contacts.length,
    rgpdKo:         contacts.filter(c => c.rgpd_ko).length,
    consentOk:      contacts.filter(c => c.consent_email || c.consent_telephone || c.consent_courrier).length,
    contratsActifs: contracts.filter(c => c.statut === 'Contrat en cours').length,
  };

  const pctConsent = stats.contactsTotal
    ? Math.round((stats.consentOk / stats.contactsTotal) * 100)
    : 100;
  const pctRgpdKo  = stats.contactsTotal
    ? Math.round(((stats.contactsTotal - stats.rgpdKo) / stats.contactsTotal) * 100)
    : 100;

  const score = Math.round(
    (stats.totalJournal > 0     ? 100 : 0) * 0.25 +
    pctRgpdKo                              * 0.35 +
    pctConsent                             * 0.25 +
    (stats.erreurs < 5          ? 100 : Math.max(0, 100 - stats.erreurs * 5)) * 0.15
  );
  const scoreColor = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';

  const checks = [
    [stats.totalJournal > 0,                         'Journal RGPD actif et alimenté'],
    [stats.rgpdKo === 0,                             'Aucun contact en statut RGPD KO'],
    [stats.erreurs < 5,                              'Moins de 5 erreurs journalisées'],
    [pctConsent >= 80,                               `${pctConsent}% des contacts avec consentement enregistré`],
    [stats.contratsActifs > 0,                       `${stats.contratsActifs} contrat(s) en cours`],
    [stats.exports > 0 || stats.dernieres30j > 0,    'Journal actif sur les 30 derniers jours'],
  ];

  const kpis = [
    ['Total journal',           stats.totalJournal,  '📋', ''],
    ['30 derniers jours',       stats.dernieres30j,  '📅', ''],
    ['Opérations critiques',    stats.critique,       '🔴', stats.critique > 20 ? 'Attention' : ''],
    ['Erreurs journalisées',    stats.erreurs,        '⚠️', stats.erreurs > 0 ? 'À vérifier' : ''],
    ['Suppressions données',    stats.suppressions,   '🗑️', ''],
    ['Exports réalisés',        stats.exports,        '📤', ''],
    ['Contacts RGPD KO',        stats.rgpdKo,         stats.rgpdKo > 0 ? '🚨' : '✅', stats.rgpdKo > 0 ? 'À régulariser' : ''],
    ['Consentements',           `${stats.consentOk}/${stats.contactsTotal}`, '✅', ''],
  ];

  c.innerHTML = `
    <div class="panel-block">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px">
        <div>
          <h3 style="margin:0">Rapport de conformité RGPD</h3>
          <p class="mut" style="margin-top:5px;font-size:.85rem">Généré automatiquement le ${now.toLocaleString('fr-FR')}</p>
        </div>
        <div style="text-align:center;background:${scoreColor}18;border:2px solid ${scoreColor};border-radius:12px;padding:14px 22px">
          <div style="font-size:2.2rem;font-weight:800;color:${scoreColor};line-height:1">${score}%</div>
          <div style="font-size:.72rem;color:${scoreColor};font-weight:600;margin-top:3px">Score conformité</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:10px;margin-bottom:20px">
        ${kpis.map(([label, val, icon, alerte]) => `
          <div style="background:var(--bg-alt,#f8fafc);border-radius:10px;padding:14px;text-align:center${alerte ? ';border:1px solid #f59e0b' : ''}">
            <div style="font-size:1.5rem">${icon}</div>
            <div style="font-size:1.5rem;font-weight:700;margin:4px 0">${val}</div>
            <div style="font-size:.73rem;color:var(--muted)">${label}</div>
            ${alerte ? `<div style="font-size:.7rem;color:#d97706;margin-top:4px;font-weight:600">${alerte}</div>` : ''}
          </div>`).join('')}
      </div>

      <div style="border-left:3px solid ${scoreColor};padding:12px 16px;border-radius:0 6px 6px 0;background:${scoreColor}08">
        <h4 style="margin:0 0 10px">Points de contrôle</h4>
        ${checks.map(([ok, label]) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:.84rem">
            <span style="color:${ok ? '#16a34a' : '#dc2626'};font-size:1rem;flex-shrink:0">${ok ? '✅' : '❌'}</span>
            <span>${label}</span>
          </div>`).join('')}
      </div>

      <p class="mut" style="font-size:.75rem;margin-top:14px">Ce rapport est généré à partir des données disponibles dans le CRM. Il ne remplace pas une analyse juridique complète de conformité RGPD.</p>
    </div>`;
}
