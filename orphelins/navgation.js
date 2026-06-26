
// NAVIGATION
// ---------------------------------------------------------
function switchView(view) {
  if (!view) return; // ignore les clics sur des navlink sans data-view (sous-onglets admin)
  $all('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $all('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'admin' && isAdmin()) renderAdmin();
}

// ---------------------------------------------------------
// TABLEAU DE BORD
// ---------------------------------------------------------
function updateDashboardClock() {
  const el = $('#dashboard-clock');
  if (!el) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  el.textContent = `${capitalize(dateStr)} — ${timeStr} (heure de Paris)`;
}

function interactAlert(contractId, contactId, days) {
  // Marquer le palier vu selon les jours restants
  const dismissed = JSON.parse(localStorage.getItem('safe_dismissed_alerts_v2') || '{}');
  if (!dismissed[contractId]) dismissed[contractId] = {};
  if (days <= 3)      dismissed[contractId].seen3 = true;
  else if (days <= 7) dismissed[contractId].seen7 = true;
  localStorage.setItem('safe_dismissed_alerts_v2', JSON.stringify(dismissed));
  // Basculer sur la vue Contacts puis ouvrir la fiche
  if (contactId) {
    switchView('contacts');
    setTimeout(() => openContactModal(contactId), 50);
  }
  renderDashboard();
}

function renderDashboard() {
  const name = state.profile?.prenom || (state.user?.email ? state.user.email.split('@')[0] : 'Utilisateur');
  $('#dashboard-title').textContent = `Tableau de bord de ${name}`;
  updateDashboardClock();

  // Alerte échéances de contrats (en retard ou dans les 15 prochains jours)
  const today = todayISO();
  const limit = new Date();
  limit.setDate(limit.getDate() + 15);
  const limitStr = limit.toISOString().slice(0, 10);
  // Dismissed : { id: { seen7: bool, seen3: bool } }
  const dismissed = JSON.parse(localStorage.getItem('safe_dismissed_alerts_v2') || '{}');
  const dueSoon = state.contracts
    .filter(c => {
      if (!c.date_echeance) return false;
      if (c.date_echeance > limitStr) return false;
      if (['Terminé', 'Résilié'].includes(c.statut)) return false;
      if (c.created_by !== state.user?.id) return false;
      const days = Math.round((new Date(c.date_echeance) - new Date(today)) / 86400000);
      const d = dismissed[c.id] || {};
      // Toujours afficher si en retard
      if (days < 0) return true;
      // Afficher à J-7 (entre 4 et 7 jours) si pas encore vu ce palier
      if (days <= 7 && days > 3 && !d.seen7) return true;
      // Afficher à J-3 (entre 0 et 3 jours) si pas encore vu ce palier
      if (days <= 3 && !d.seen3) return true;
      return false;
    })
    .sort((a, b) => a.date_echeance.localeCompare(b.date_echeance));
  const alertBlock = $('#echeances-alert');
  if (dueSoon.length) {
    alertBlock.style.display = 'block';
    $('#echeances-list').innerHTML = dueSoon.map(c => {
      const days = Math.round((new Date(c.date_echeance) - new Date(today)) / 86400000);
      const when = days < 0 ? `en retard de ${Math.abs(days)} j` : (days === 0 ? "aujourd'hui" : `dans ${days} j`);
      return `
        <div class="mini-item">
          <div>
            <div class="t">${escapeHtml(contactName(c.contact_id))} — ${escapeHtml(c.type)}${c.formule ? ' / ' + escapeHtml(c.formule) : ''}</div>
            <div class="s">Échéance le ${formatDate(c.date_echeance)}</div>
          </div>
          <span class="${days < 0 ? 'overdue' : ''}">${when}</span>
          <button class="btn btn-pri btn-sm" style="margin-left:8px;font-size:.72rem" onclick="interactAlert('${c.id}','${c.contact_id}',${days})">👉 Interagir</button>
        </div>`;
    }).join('');
  } else {
    alertBlock.style.display = 'none';
  }

  const myId = state.user?.id;
  const myContacts  = state.contacts.filter(c => c.created_by === myId);
  const myContracts = state.contracts.filter(c => c.created_by === myId);
  $('#stat-contacts').textContent = myContacts.length;
  $('#stat-clients').textContent = myContacts.filter(c => c.statut === 'Client').length;
  $('#stat-contracts').textContent = myContracts.filter(c => !['Terminé','Résilié'].includes(c.statut)).length;
  $('#stat-tasks-late').textContent = state.tasks.filter(t => isOverdue(t.echeance, t.statut)).length;

  // Tâches à venir / en retard
  const upcoming = state.tasks
    .filter(t => t.statut !== 'Terminé')
    .sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999'))
    .slice(0, 6);
  const upcomingEl = $('#upcoming-tasks-list');
  upcomingEl.innerHTML = upcoming.length ? upcoming.map(t => `
    <div class="mini-item">
      <div>
        <div class="t">${escapeHtml(t.titre)}</div>
        <div class="s">${t.contact_id ? escapeHtml(contactName(t.contact_id)) : ''}</div>
      </div>
      <span class="${isOverdue(t.echeance, t.statut) ? 'overdue' : 's'}">${formatDate(t.echeance)}</span>
    </div>`).join('') : '<p class="empty">Aucune tâche en attente 🎉</p>';

  // Derniers contacts
  const recent = state.contacts.slice(0, 5);
  const recentEl = $('#recent-contacts-list');
  recentEl.innerHTML = recent.length ? recent.map(c => `
    <div class="mini-item">
      <div>
        <div class="t">${escapeHtml(c.nom)}${c.entreprise ? ' — ' + escapeHtml(c.entreprise) : ''}</div>
        <div class="s">${(c.activites || []).join(', ') || '—'}</div>
      </div>
      <span class="badge ${CONTACT_STATUT_BADGE[c.statut] || 'badge-gray'}">${escapeHtml(c.statut)}</span>
    </div>`).join('') : '<p class="empty">Aucun contact pour le moment.</p>';

  // Pop-up des messages non lus (à la première ouverture du dashboard)
  if (!state._messagesShown && state.unreadMessages.length) {
    state._messagesShown = true;
    showIncomingMessagesIfAny();
  }
}

// =========================================================
// ONGLET RÉSULTATS (admin) — blocs cliquables + détail + bordereau
// =========================================================

function renderResultats() {
  const grid = $('#resultats-team-grid');
  if (!grid) return;
  $('#resultats-team-view').style.display = '';
  $('#resultats-detail-view').style.display = 'none';
  const allUsers = Object.values(state.profilesById)
    .sort((a, b) => (a.prenom || '').localeCompare(b.prenom || ''));
  renderTeamGauges(grid, allUsers, { clickable: true });
}

function openResultatsDetail(userId) {
  const u = state.profilesById[userId];
  if (!u) return;
  $('#resultats-team-view').style.display = 'none';
  $('#resultats-detail-view').style.display = '';
  $('#resultats-detail-name').textContent = u.prenom || u.email || '—';

  // Jauges individuelles
  const gaugesEl = $('#resultats-detail-gauges');
  const contacts = computeObjectifValue({ metric_type: 'nouveaux_contacts' }, userId);
  const ca = computeObjectifValue({ metric_type: 'ca_genere' }, userId);
  const comm = computeMonthlyCommission(userId);
  const tContacts = getObjectifTarget(userId, 'nouveaux_contacts');
  const tCa = getObjectifTarget(userId, 'ca_genere');
  const tComm = getObjectifTarget(userId, 'commissions');
  gaugesEl.innerHTML = [
    { label: 'Entrées en contact', val: contacts, tgt: tContacts, unit: '' },
    { label: 'CA généré', val: ca, tgt: tCa, unit: '€' },
    { label: 'Commissions', val: comm, tgt: tComm, unit: '€' },
  ].map(g => {
    const pct = g.tgt > 0 ? Math.min(100, (g.val / g.tgt) * 100) : (g.val > 0 ? 100 : 0);
    return `<div class="gauge-card">
      <div class="gauge-wrap">${gaugeSvg(pct)}</div>
      <h4>${escapeHtml(g.label)}</h4>
      <p class="mut">${g.unit === '€' ? formatMoney(g.val) : g.val} / ${g.unit === '€' ? formatMoney(g.tgt) : g.tgt}</p>
    </div>`;
  }).join('');

  // Contrats du mois en cours (nouvelles affaires)
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const newContracts = state.contracts.filter(c =>
    c.created_by === userId &&
    c.date_debut &&
    new Date(c.date_debut + 'T00:00:00') >= startMonth &&
    new Date(c.date_debut + 'T00:00:00') <= endMonth &&
    ['Contrat en cours', 'Envoyé', 'En attente de signature'].includes(c.statut)
  );
  const newTbody = $('#resultats-detail-new-table tbody');
  newTbody.innerHTML = newContracts.length ? newContracts.map(c => {
    const contact = state.contacts.find(x => x.id === c.contact_id);
    const preset = (FORMULE_PRESETS[c.type] || []).find(f => f.label === c.formule);
    const commSig = preset?.comm_signature_fix || (preset?.comm_signature_pct ? Math.round(Number(c.montant || 0) * preset.comm_signature_pct * 100) / 100 : 0);
    return `<tr>
      <td>${escapeHtml(contact?.nom || '—')}</td>
      <td>${getContractIcon(c.type) + ' ' + getContractIcon(c.type) + ' ' + getContractIcon(c.type) + ' ' + escapeHtml(c.type || '—')}</td>
      <td>${escapeHtml(c.formule || '—')}</td>
      <td class="num">${formatMoney(c.montant)}</td>
      <td class="num">${formatMoney(c.frais_mise_en_place || 0)}</td>
      <td class="num">${formatMoney(c.remise || 0)}</td>
      <td class="num" style="color:#f59e0b;font-weight:600">${formatMoney(commSig)}</td>
      <td class="nowrap">${formatDate(c.date_debut)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="empty">Aucune nouvelle affaire ce mois-ci</td></tr>';

  // Abonnements récurrents actifs
  const recurContracts = state.contracts.filter(c =>
    c.created_by === userId &&
    c.recurrence === 'Mensuel' &&
    ['Contrat en cours'].includes(c.statut)
  );
  const recTbody = $('#resultats-detail-recurrent-table tbody');
  recTbody.innerHTML = recurContracts.length ? recurContracts.map(c => {
    const contact = state.contacts.find(x => x.id === c.contact_id);
    const preset = (FORMULE_PRESETS[c.type] || []).find(f => f.label === c.formule);
    const commRec = preset?.comm_recurrent_pct ? Math.round(Number(c.montant || 0) * preset.comm_recurrent_pct * 100) / 100 : 0;
    return `<tr>
      <td>${escapeHtml(contact?.nom || '—')}</td>
      <td>${escapeHtml(c.type || '—')}</td>
      <td>${escapeHtml(c.formule || '—')}</td>
      <td class="num">${formatMoney(c.montant)}/mois</td>
      <td class="num" style="color:#f59e0b;font-weight:600">${formatMoney(commRec)}/mois</td>
      <td class="nowrap">${formatDate(c.date_debut)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" class="empty">Aucun abonnement récurrent actif</td></tr>';

  // Stocker l'userId pour le bordereau
  state._resultatsUserId = userId;
}

function getObjectifTarget(userId, metricType) {
  const o = state.objectifs.find(o => o.user_id === userId && o.metric_type === metricType);
  return o ? computeObjectifTarget(o) : 0;
}
function generateBordereauCommission() {
  const userId = state._resultatsUserId;
  const u = state.profilesById[userId];
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!u || !jsPDF) { alert('Données insuffisantes ou jsPDF non chargé.'); return; }

  const now = new Date();
  const moisLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 190;
  let y = 15;

  // === EN-TÊTE ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(10, 22, 40);
  doc.text('BORDEREAU DE COMMISSION', 15, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text('S@FE Digitalisation — ' + moisLabel, 15, y);
  y += 6;
  doc.text('Commercial : ' + (u.prenom || '—'), 15, y);
  if (u.denomination) { y += 5; doc.text('Société : ' + u.denomination, 15, y); }
  if (u.siret) { y += 5; doc.text('SIRET : ' + u.siret, 15, y); }
  if (u.tva) { y += 5; doc.text('TVA : ' + u.tva, 15, y); }
  if (u.adresse_pro) { y += 5; doc.text('Adresse : ' + u.adresse_pro, 15, y); }
  y += 5;
  doc.text('Généré le : ' + now.toLocaleDateString('fr-FR'), 15, y);
  y += 4;
  doc.setDrawColor(200); doc.line(15, y, 195, y); y += 6;

  // === SECTION 1 : NOUVELLES AFFAIRES DU MOIS ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(10, 22, 40);
  doc.text('1. Commissions à la signature (mois en cours)', 15, y);
  y += 8;

  var startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  var newC = state.contracts.filter(function(c) {
    return c.created_by === userId && c.date_debut &&
      new Date(c.date_debut) >= startMonth && new Date(c.date_debut) <= endMonth &&
      ['Contrat en cours', 'Envoyé', 'En attente de signature'].includes(c.statut);
  });

  // En-tête tableau
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 245);
  doc.rect(15, y - 3.5, W, 5, 'F');
  var cols1 = [15, 50, 82, 110, 133, 153, 175];
  var heads1 = ['Contact', 'Prestation', 'Formule', 'Montant HT', 'MeP HT', 'Remise', 'Commission'];
  heads1.forEach(function(h, i) { doc.text(h, cols1[i], y); });
  y += 6;

  doc.setFont('helvetica', 'normal');
  var totalSig = 0;
  newC.forEach(function(c) {
    if (y > 270) { doc.addPage(); y = 20; }
    var contact = state.contacts.find(function(x) { return x.id === c.contact_id; });
    var preset = (FORMULE_PRESETS[c.type] || []).find(function(f) { return f.label === c.formule; });
    var commSig = (preset && preset.comm_signature_fix) || ((preset && preset.comm_signature_pct) ? Math.round(Number(c.montant || 0) * preset.comm_signature_pct * 100) / 100 : 0);
    totalSig += commSig;
    doc.text(((contact && contact.nom) || '—').slice(0, 20), cols1[0], y);
    doc.text((c.type || '—').slice(0, 18), cols1[1], y);
    doc.text((c.formule || '—').slice(0, 16), cols1[2], y);
    doc.text(formatMoney(c.montant), cols1[3], y);
    doc.text(formatMoney(c.frais_mise_en_place || 0), cols1[4], y);
    doc.text(formatMoney(c.remise || 0), cols1[5], y);
    doc.setTextColor(37, 99, 235);
    doc.text(formatMoney(commSig), cols1[6], y);
    doc.setTextColor(80, 80, 80);
    y += 5;
  });
  if (!newC.length) { doc.text('Aucune nouvelle affaire ce mois-ci.', 15, y); y += 5; }
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(10, 22, 40);
  doc.text('Sous-total commissions signature HT : ' + formatMoney(totalSig), 15, y);
  y += 10;

  // === SECTION 2 : RÉCURRENT ===
  doc.setFontSize(12);
  doc.text('2. Commissions récurrentes (abonnements actifs)', 15, y);
  y += 8;

  var recC = state.contracts.filter(function(c) {
    return c.created_by === userId && c.recurrence === 'Mensuel' && c.statut === 'Contrat en cours';
  });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 245);
  doc.rect(15, y - 3.5, W, 5, 'F');
  var cols2 = [15, 50, 82, 115, 145, 175];
  var heads2 = ['Contact', 'Prestation', 'Formule', 'Mensuel HT', 'Commission/mois', 'Depuis'];
  heads2.forEach(function(h, i) { doc.text(h, cols2[i], y); });
  y += 6;

  doc.setFont('helvetica', 'normal');
  var totalRec = 0;
  recC.forEach(function(c) {
    if (y > 270) { doc.addPage(); y = 20; }
    var contact = state.contacts.find(function(x) { return x.id === c.contact_id; });
    var preset = (FORMULE_PRESETS[c.type] || []).find(function(f) { return f.label === c.formule; });
    var commRec = (preset && preset.comm_recurrent_pct) ? Math.round(Number(c.montant || 0) * preset.comm_recurrent_pct * 100) / 100 : 0;
    totalRec += commRec;
    doc.text(((contact && contact.nom) || '—').slice(0, 20), cols2[0], y);
    doc.text((c.type || '—').slice(0, 18), cols2[1], y);
    doc.text((c.formule || '—').slice(0, 16), cols2[2], y);
    doc.text(formatMoney(c.montant) + '/mois', cols2[3], y);
    doc.setTextColor(37, 99, 235);
    doc.text(formatMoney(commRec) + '/mois', cols2[4], y);
    doc.setTextColor(80, 80, 80);
    doc.text(formatDate(c.date_debut), cols2[5], y);
    y += 5;
  });
  if (!recC.length) { doc.text('Aucun abonnement récurrent actif.', 15, y); y += 5; }
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(10, 22, 40);
  doc.text('Sous-total commissions récurrentes HT : ' + formatMoney(totalRec) + ' /mois', 15, y);
  y += 12;

  // === TOTAL TTC ===
  var totalHT = totalSig + totalRec;
  var totalTVA = Math.round(totalHT * 0.2 * 100) / 100;
  var totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;

  doc.setFontSize(11);
  doc.setTextColor(10, 22, 40);
  doc.text('Total commissions HT : ' + formatMoney(totalHT), 15, y);
  y += 6;
  doc.text('TVA 20 % : ' + formatMoney(totalTVA), 15, y);
  y += 6;
  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235);
  doc.text('TOTAL TTC À VERSER : ' + formatMoney(totalTTC), 15, y);
  y += 10;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Versement dans les 15 jours suivant la clôture du mois.', 15, y);
  y += 4;
  doc.text('Barème : SAFEDIRCOM-2026-V1 — En vigueur au 12 juin 2026.', 15, y);

  // === FOOTER ===
  var pages = doc.internal.getNumberOfPages();
  for (var p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('S@FE Digitalisation — SIRET 104 699 558 00011 — Document confidentiel', 15, 290);
    doc.text('Page ' + p + '/' + pages, 190, 290, { align: 'right' });
  }

  var filename = 'Bordereau_Commission_' + (u.prenom || 'user').replace(/\s+/g, '_') + '_' + moisLabel.replace(/\s+/g, '_') + '.pdf';
  doc.save(filename);
}

async function loadAdminUsers() {
  const { data, error } = await sb.rpc('admin_list_users');
  if (error) {
    alert("Erreur de chargement des utilisateurs : " + error.message);
    state.adminUsers = [];
    return;
  }
  state.adminUsers = data || [];
}

function renderAdminUsers() {
  const tbody = $('#admin-users-table tbody');
  if (!state.adminUsers.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Aucun utilisateur.</td></tr>';
    return;
  }
  const now = new Date();
  const roleLabels = {
    'super_admin': '⚡ Super Admin',
    'admin_candy': '🍬 Admin C@NDY',
    'dci':         '🤝 DCI',
    'user':        '👤 Utilisateur',
  };
  tbody.innerHTML = state.adminUsers.map(u => {
    const banned  = u.banned_until && new Date(u.banned_until) > now;
    const isSelf  = u.id === state.user.id;
    const role    = u.role || (u.is_admin ? 'admin_candy' : 'user');
    const roleLbl = roleLabels[role] || '👤 Utilisateur';
    const profil  = u.profil_complet ? '🟢' : '🔴';
    const revoc   = u.profil_revocation_flag ? ' <span class="badge badge-red" style="font-size:.62rem">⚠ Révocation</span>' : '';
    return `
      <tr class="${banned ? 'row-banned' : ''}">
        <td>${escapeHtml(u.prenom || '—')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td><span class="badge badge-gray" style="font-size:.72rem">${roleLbl}</span></td>
        <td style="text-align:center;font-size:1.1rem" title="${u.profil_complet ? 'Profil complet' : 'Profil incomplet'}">${profil}${revoc}</td>
        <td>${banned ? '<span class="badge badge-red">Révoqué</span>' : '<span class="badge badge-green">Actif</span>'}</td>
        <td class="nowrap mut" style="font-size:.82rem">${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
        <td class="actions">
          <button class="btn btn-out btn-sm" onclick="openEditUserModal('${u.id}')" ${isSelf ? 'disabled' : ''} title="Modifier">✏️ Modifier</button>
          <button class="btn btn-out btn-sm" data-admin-message="${u.id}" ${isSelf ? 'disabled' : ''}>Message</button>
          <button class="btn btn-out btn-sm" data-admin-toggle-admin="${u.id}" ${isSelf ? 'disabled title="Vous ne pouvez pas modifier votre propre rôle"' : ''}>${u.is_admin ? 'Révoquer admin' : 'Rendre admin'}</button>
          <button class="btn btn-danger btn-sm" data-admin-delete="${u.id}" ${isSelf ? 'disabled title="Vous ne pouvez pas supprimer votre propre compte"' : ''}>Supprimer</button>
        </td>
      </tr>`;
  }).join('');
}

