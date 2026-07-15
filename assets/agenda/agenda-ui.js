// ==========================================================================
// S@FE CRM — Module Agenda
// Extrait de assets/app.js
// Dépendances globales : sb, state, $, escapeHtml, formatDate, isOverdue,
//   todayISO, capitalize, showNotif, contactName, openTaskModal, SUPABASE_URL
// ==========================================================================

// ─────────────────────────────────────────────
// AGENDA
// ─────────────────────────────────────────────
const agendaState = { year: 0, month: 0, selectedDay: null, view: 'month', weekMonday: '' };

function renderAgenda() {
  const now = new Date();
  if (!agendaState.year) { agendaState.year = now.getFullYear(); agendaState.month = now.getMonth(); }
  if (!agendaState.weekMonday) {
    const d = new Date(now), dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    agendaState.weekMonday = d.toISOString().slice(0, 10);
  }
  _updateAgendaViewToggle();
  _drawAgendaCalendar();
}

function agendaSetView(v) {
  agendaState.view = v;
  _updateAgendaViewToggle();
  _drawAgendaCalendar();
}

function _updateAgendaViewToggle() {
  ['month', 'week'].forEach(v => {
    const btn = document.getElementById('avbtn-' + v);
    if (btn) btn.classList.toggle('active', agendaState.view === v);
  });
}

function agendaPrev() {
  if (agendaState.view === 'week') {
    const d = new Date(agendaState.weekMonday + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    agendaState.weekMonday = d.toISOString().slice(0, 10);
  } else {
    if (--agendaState.month < 0) { agendaState.month = 11; agendaState.year--; }
  }
  _drawAgendaCalendar();
}

function agendaNext() {
  if (agendaState.view === 'week') {
    const d = new Date(agendaState.weekMonday + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    agendaState.weekMonday = d.toISOString().slice(0, 10);
  } else {
    if (++agendaState.month > 11) { agendaState.month = 0; agendaState.year++; }
  }
  _drawAgendaCalendar();
}

// Rétro-compat (appelé depuis anciens liens éventuels)
function agendaPrevMonth() { agendaState.view = 'month'; agendaPrev(); }
function agendaNextMonth() { agendaState.view = 'month'; agendaNext(); }

function agendaJumpToDate(iso) {
  if (!iso) return;
  const d = new Date(iso + 'T12:00:00');
  agendaState.year = d.getFullYear();
  agendaState.month = d.getMonth();
  agendaState.selectedDay = iso;
  const dow = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow);
  agendaState.weekMonday = mon.toISOString().slice(0, 10);
  _drawAgendaCalendar();
}

function _drawAgendaCalendar() {
  const { year, month, view, weekMonday } = agendaState;
  const todayStr = todayISO();

  // Label de navigation
  const labelEl = $('#agenda-month-label');
  if (labelEl) {
    if (view === 'week' && weekMonday) {
      const mon = new Date(weekMonday + 'T12:00:00');
      const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
      const fmt = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      labelEl.textContent = `${fmt(mon)} – ${fmt(fri)} ${fri.getFullYear()}`;
    } else {
      labelEl.textContent = capitalize(new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
    }
  }

  // Construction de la liste de jours à afficher
  const days = [];
  if (view === 'week' && weekMonday) {
    const mon = new Date(weekMonday + 'T12:00:00');
    for (let i = 0; i < 5; i++) {
      const d = new Date(mon); d.setDate(mon.getDate() + i); days.push(d);
    }
  } else {
    const firstDay = new Date(year, month, 1);
    const startDay = new Date(firstDay);
    const dow = (firstDay.getDay() + 6) % 7;
    startDay.setDate(firstDay.getDate() - dow);
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDay); d.setDate(startDay.getDate() + i); days.push(d);
    }
  }

  // Mise à jour dynamique des en-têtes
  const headersEl = document.getElementById('agenda-headers');
  if (headersEl) {
    const JOURS5 = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
    const JOURS7 = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    if (view === 'week' && weekMonday) {
      const mon = new Date(weekMonday + 'T12:00:00');
      headersEl.className = 'agenda-grid-week';
      headersEl.innerHTML = JOURS5.map((j, i) => {
        const d = new Date(mon); d.setDate(mon.getDate() + i);
        return `<div class="agenda-day-header">${j} ${d.getDate()}</div>`;
      }).join('');
    } else {
      headersEl.className = 'agenda-grid';
      headersEl.innerHTML = JOURS7.map(j => `<div class="agenda-day-header">${j}</div>`).join('');
    }
  }

  // Index des tâches et tournées par date
  const byDate = {};
  (state.tasks || []).forEach(t => {
    const dates = [];
    if (t.rdv_date) dates.push(t.rdv_date);
    else if (t.echeance) dates.push(t.echeance);
    dates.forEach(d => { if (d) { byDate[d] = byDate[d] || []; byDate[d].push(t); } });
  });
  const byDateTournee = {};
  (state.tournees || []).forEach(t => {
    if (t.date_tournee) { byDateTournee[t.date_tournee] = byDateTournee[t.date_tournee] || []; byDateTournee[t.date_tournee].push(t); }
  });

  // Rendu des cellules
  const cellsEl = $('#agenda-cells');
  cellsEl.className = view === 'week' ? 'agenda-grid-week' : 'agenda-grid';
  cellsEl.innerHTML = '';

  days.forEach(d => {
    const iso = d.toISOString().slice(0, 10);
    const isCurrentMonth = view === 'week' ? true : d.getMonth() === month;
    const isToday       = iso === todayStr;
    const isSelected    = iso === agendaState.selectedDay;
    const events        = byDate[iso] || [];
    const tourneesDuJour = byDateTournee[iso] || [];
    const rdvs          = events.filter(t => t.type_tache === 'RDV visio' || t.type_tache === 'RDV terrain');
    const hasEvents     = events.length + tourneesDuJour.length > 0;

    const cell = document.createElement('div');
    cell.className = ['agenda-cell', isToday ? 'today' : '', !isCurrentMonth ? 'other-month' : '', isSelected ? 'selected' : ''].filter(Boolean).join(' ');
    cell.onclick = () => _selectAgendaDay(iso);

    // Emojis conditionnels : 🗺️ uniquement si tournée, 👤 uniquement si RDV
    const icons = [
      ...tourneesDuJour.map(() => `<span title="Tournée terrain">🗺️</span>`),
      ...rdvs.map(() => `<span title="Rendez-vous">👤</span>`),
    ];
    const visibleIcons = icons.slice(0, 4);
    const overflow     = icons.length > 4 ? `<span style="font-size:.55rem;color:var(--mut)">+${icons.length - 4}</span>` : '';
    const emojiBlock   = visibleIcons.length ? `<div class="agenda-cell-emojis">${visibleIcons.join('')}${overflow}</div>` : '';

    // Boutons d'action
    const addBtn = `<button class="agenda-cell-btn" title="Ajouter un RDV" onclick="event.stopPropagation();openTaskModal(null,{type_tache:'RDV terrain',rdv_date:'${iso}'})">➕</button>`;
    const delBtn = hasEvents ? `<button class="agenda-cell-btn" title="Voir / Supprimer" onclick="event.stopPropagation();_selectAgendaDay('${iso}')">➖</button>` : '';

    cell.innerHTML = `<div class="agenda-cell-num">${d.getDate()}</div>${emojiBlock}<div class="agenda-cell-actions">${addBtn}${delBtn}</div>`;
    cellsEl.appendChild(cell);
  });

  // Rouvrir le panneau jour si un jour était sélectionné
  if (agendaState.selectedDay) {
    _renderDayPanel(agendaState.selectedDay, byDate[agendaState.selectedDay] || [], byDateTournee[agendaState.selectedDay] || []);
  }
}

function _renderDayPanel(iso, events, tourneesDuJour = []) {
  const panel = $('#agenda-day-panel');
  const title = $('#agenda-day-title');
  const list  = $('#agenda-day-list');

  const label = new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  title.textContent = capitalize(label);

  let html = '';

  // ── Blocs tournée ────────────────────────────────────────────────────────────
  tourneesDuJour.forEach(tr => {
    const etapes = (tr.etapes || []);
    const conflits = events.filter(t => t.type_tache === 'RDV visio' || t.type_tache === 'RDV terrain');
    const alerte = conflits.length
      ? `<div style="margin:8px 0;padding:8px 12px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.35);border-radius:8px;font-size:.78rem;color:#f59e0b">
           ⚠️ <strong>${conflits.length} RDV déjà programmé${conflits.length > 1 ? 's' : ''} ce jour.</strong>
           Vérifiez les horaires avant de partir.
           ${conflits.map(c => {
             const contact = c.contact_id ? state.contacts.find(x => x.id === c.contact_id) : null;
             const lieu = c.rdv_lieu || (contact ? [contact.adresse, contact.code_postal, contact.ville].filter(Boolean).join(', ') : '');
             return `<div style="margin-top:4px;padding-left:10px;border-left:2px solid #f59e0b">
               ${escapeHtml(c.titre)}${c.rdv_heure ? ' · ' + c.rdv_heure.slice(0,5) : ''}${lieu ? ' · 📍 ' + escapeHtml(lieu) : ''}
             </div>`;
           }).join('')}
         </div>` : '';

    const etapesHtml = etapes.map((e, i) => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="font-family:monospace;font-size:.72rem;color:#f59e0b;min-width:28px;padding-top:1px">${e.heure_estimee ? e.heure_estimee.slice(0,5) : ('0'+(i+1)).slice(-2)+'h'}</span>
        <div style="flex:1">
          <div style="font-size:.83rem;color:#fff;font-weight:600">${escapeHtml(e.label)}</div>
          ${e.adresse ? `<div style="font-size:.72rem;color:var(--mut)">📍 ${escapeHtml(e.adresse)}</div>` : ''}
          <div style="font-size:.65rem;color:var(--mut-2);font-family:monospace">${e.source === 'google_places' ? '🌍 Google Places' : e.source === 'sirene' ? '⚡ SIRENE' : '👤 CRM'}</div>
        </div>
      </div>`).join('');

    html += `<div style="margin-bottom:14px;padding:14px 16px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.25);border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:.82rem;font-weight:700;color:#f59e0b">🗺️ Tournée terrain</span>
        <span style="font-size:.72rem;color:var(--mut)">${tr.heure_depart ? tr.heure_depart.slice(0,5) : ''} · ${tr.nb_etapes || etapes.length} étape${(tr.nb_etapes || etapes.length) > 1 ? 's' : ''} · ${tr.distance_totale_km ? tr.distance_totale_km + ' km' : ''}</span>
      </div>
      ${tr.adresse_depart ? `<div style="font-size:.75rem;color:var(--mut);margin-bottom:8px">📍 Départ : ${escapeHtml(tr.adresse_depart)}</div>` : ''}
      ${alerte}
      ${etapesHtml || '<div style="font-size:.78rem;color:var(--mut)">Aucune étape enregistrée.</div>'}
      ${tr.score_co2_kg ? `<div style="margin-top:8px;font-size:.7rem;color:var(--mut);font-family:monospace">🌱 ${parseFloat(tr.score_co2_kg).toFixed(2)} kg CO₂ estimés (ADEME 2024)</div>` : ''}
    </div>`;
  });

  if (!events.length && !tourneesDuJour.length) {
    list.innerHTML = `<p style="color:var(--mut);font-size:.85rem">Aucun événement ce jour.</p>
      <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="openTaskModal(null,{type_tache:'RDV terrain',rdv_date:'${iso}'})">📅 Programmer un RDV</button>`;
  } else {
    html += events.map(t => {
      const isRdv   = t.type_tache === 'RDV visio' || t.type_tache === 'RDV terrain';
      const late    = isOverdue(t.echeance || t.rdv_date, t.statut);
      const cls     = late ? 'overdue' : isRdv ? 'rdv' : 'task';
      const meta    = [t.type_tache, t.rdv_heure ? t.rdv_heure.slice(0,5) : null, t.rdv_lieu].filter(Boolean).join(' · ');

      const contact = t.contact_id ? state.contacts.find(c => c.id === t.contact_id) : null;
      const lieu    = t.rdv_lieu || (contact ? [contact.adresse, contact.code_postal, contact.ville].filter(Boolean).join(', ') : '');
      const mapsUrl = t.type_tache === 'RDV terrain' && lieu
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lieu)}&travelmode=driving`
        : null;

      const contactCard = contact ? `
        <div style="margin:6px 0 4px;padding:8px 10px;background:rgba(255,255,255,.05);border-radius:6px;font-size:.78rem;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center">
          <span>👤 <strong>${escapeHtml(contact.nom)}${contact.entreprise ? ' — ' + escapeHtml(contact.entreprise) : ''}</strong></span>
          ${contact.telephone ? `<a href="tel:${escapeHtml(contact.telephone)}" onclick="event.stopPropagation()" style="color:var(--accent)">📞 ${escapeHtml(contact.telephone)}</a>` : ''}
          ${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}" onclick="event.stopPropagation()" style="color:var(--accent)">✉️ ${escapeHtml(contact.email)}</a>` : ''}
          ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:#f59e0b;font-weight:600">🗺️ Itinéraire</a>` : ''}
        </div>` : '';

      return `<div class="agenda-ev-item" onclick="openTaskModal('${t.id}')">
        <div class="agenda-ev-dot ${cls}"></div>
        <div style="flex:1">
          <div class="agenda-ev-title">${escapeHtml(t.titre)}</div>
          ${meta ? `<div class="agenda-ev-meta">${escapeHtml(meta)}</div>` : ''}
          ${contactCard}
        </div>
        ${!contact && mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="btn btn-out btn-sm" style="padding:3px 9px;font-size:.75rem;align-self:center;white-space:nowrap">🗺️ Itinéraire</a>` : ''}
      </div>`;
    }).join('');
    html += `<button class="btn btn-out btn-sm" style="margin-top:12px;width:100%" onclick="openTaskModal(null,{type_tache:'RDV terrain',rdv_date:'${iso}'})">+ Programmer un RDV ce jour</button>`;
    list.innerHTML = html;
  }
  panel.style.display = 'block';
  if (window.innerWidth <= 600) {
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}

function _selectAgendaDay(iso) {
  agendaState.selectedDay = iso;
  _drawAgendaCalendar();
}

async function copyIcalUrl() {
  const uid = state.user?.id;
  if (!uid) return;
  // Récupérer le token ICS personnel depuis le profil (colonne ics_token)
  const { data: profile } = await sb.from('profiles').select('ics_token').eq('id', uid).single();
  if (!profile?.ics_token) { alert('Impossible de récupérer le token agenda.'); return; }
  const url = `${SUPABASE_URL}/functions/v1/agenda-ics?uid=${uid}&tok=${profile.ics_token}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = $('#btn-ical-subscribe');
    const orig = btn.textContent;
    btn.textContent = '✅ URL copiée !';
    setTimeout(() => btn.textContent = orig, 2500);
  });
}

// ==========================================================================
// AGENDA — RÉGLAGES : LIEN DE RÉSERVATION GOOGLE CALENDAR
// ==========================================================================
// Chaque commercial dispose désormais de son propre agenda Google avec
// créneaux de RDV (fonctionnalité "Rendez-vous" de Google Calendar). On ne
// stocke que l'URL publique de sa page de planification (générée par
// Google), et on la relaie telle quelle dans le lien de réservation partagé
// — cette URL est prévue pour être publique, aucun token/backend requis.

const GOOGLE_BOOKING_URL_RE = /^https:\/\/calendar\.google\.com\/calendar\/appointments\/schedules\//;

function _extractGoogleBookingUrl(raw) {
  const value = (raw || '').trim();
  if (GOOGLE_BOOKING_URL_RE.test(value)) return value;
  // Tolère un collage du snippet <script> complet fourni par Google : on
  // extrait la valeur du paramètre url: '...'
  const match = value.match(/url:\s*'([^']+)'/) || value.match(/url:\s*"([^"]+)"/);
  if (match && GOOGLE_BOOKING_URL_RE.test(match[1])) return match[1];
  return null;
}

async function openAgendaSettings() {
  const modal = $('#modal-agenda-settings');
  modal.classList.remove('is-hidden');

  const uid = state.user?.id;
  if (!uid) return;

  const { data: profile } = await sb.from('profiles').select('google_booking_url, prenom').eq('id', uid).single();

  $('#agenda-gcal-input').value = profile?.google_booking_url || '';
  _renderBookingShareUrl(profile?.google_booking_url, profile?.prenom);
}

function _renderBookingShareUrl(googleUrl, prenom) {
  const display = $('#booking-url-display');
  if (!googleUrl) {
    display.value = 'Renseignez votre lien Google Calendar ci-dessus, puis enregistrez.';
    return;
  }
  const shareUrl = `${window.location.origin}/booking.html?gcal=${encodeURIComponent(googleUrl)}&nom=${encodeURIComponent(prenom || '')}`;
  display.value = shareUrl;
}

function closeAgendaSettings() {
  $('#modal-agenda-settings').classList.add('is-hidden');
}

async function saveGoogleBookingUrl() {
  const uid = state.user?.id;
  if (!uid) return;

  const errorEl = $('#agenda-gcal-error');
  errorEl.classList.add('is-hidden');

  const raw = $('#agenda-gcal-input').value;
  const url = _extractGoogleBookingUrl(raw);
  if (!url) {
    errorEl.textContent = "Lien Google Calendar invalide. Collez l'URL commençant par https://calendar.google.com/calendar/appointments/schedules/… (ou le snippet d'intégration fourni par Google).";
    errorEl.classList.remove('is-hidden');
    return;
  }

  const { error } = await sb.from('profiles').update({ google_booking_url: url }).eq('id', uid);
  if (error) { alert('Erreur lors de la sauvegarde.'); return; }

  $('#agenda-gcal-input').value = url;
  _renderBookingShareUrl(url, state.profilesById?.[uid]?.prenom);
  showNotif('Lien de réservation enregistré ✓', 'success');
}

function copyBookingUrl() {
  const url = $('#booking-url-display').value;
  if (!url || !url.startsWith('http')) return;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector('#modal-agenda-settings .btn-out');
    const orig = btn.textContent; btn.textContent = '✅ Copié !';
    setTimeout(() => btn.textContent = orig, 2000);
  });
}
