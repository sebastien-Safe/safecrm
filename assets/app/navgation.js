
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

