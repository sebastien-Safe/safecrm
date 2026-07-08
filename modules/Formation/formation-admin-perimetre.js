/* ═══════════════ Formation DDA — Vue Périmètre ════════════════════════════ */

async function loadPerimetre() {
  await loadAlertesBanner();

  const el = document.getElementById('perimetre-table');
  el.innerHTML = '<div class="empty-state">Chargement…</div>';

  const { data, error } = await sb
    .from('dda_obligations')
    .select('id, programme_id, annee_civile, heures_requises, heures_realisees, statut, profiles(id, prenom, nom), dda_programmes(nom)')
    .order('annee_civile', { ascending: false });

  if (error) { el.innerHTML = '<div class="empty-state">Erreur de chargement.</div>'; console.error(error); return; }
  if (!data || !data.length) { el.innerHTML = '<div class="empty-state">Aucune obligation assignée pour le moment.</div>'; return; }

  let html = '<table><thead><tr><th>Collaborateur</th><th>Année</th><th>Programme</th><th>Heures</th><th>Statut</th><th></th></tr></thead><tbody>';
  data.forEach(o => {
    const pct = Math.min(100, Math.round((o.heures_realisees / o.heures_requises) * 100));
    html += '<tr>' +
      '<td>' + (o.profiles ? (o.profiles.prenom || '') + ' ' + (o.profiles.nom || '') : '—') + '</td>' +
      '<td>' + o.annee_civile + '</td>' +
      '<td>' + (o.dda_programmes?.nom || '—') + '</td>' +
      '<td><div class="jauge"><div class="jauge-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="mono" style="font-size:11.5px;color:var(--ink-soft)">' + Number(o.heures_realisees).toFixed(1) + ' / ' + o.heures_requises + 'h</span></td>' +
      '<td><span class="badge ' + o.statut + '">' + o.statut.replace('_', ' ') + '</span></td>' +
      '<td><button class="icon-btn" title="Voir le détail" data-obligation="' + o.id + '" onclick="openDetailModal(this.dataset.obligation)">👀</button></td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

async function loadAlertesBanner() {
  const block = document.getElementById('alertes-block');
  const { data, error } = await sb
    .from('notifications')
    .select('id, titre, message, created_at, read_at')
    .eq('user_id', AdminState.currentUser.id)
    .eq('type', 'dda_alert')
    .is('read_at', null)
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) { block.innerHTML = ''; return; }

  block.innerHTML = '<div class="callout"><span class="tag">' + data.length + ' alerte(s) d\'échéance non lue(s)</span>' +
    data.map(n => '<p style="margin:4px 0;">' + n.message + '</p>').join('') +
    '<button class="btn ghost" id="btn-marquer-lues" style="margin-top:8px;">Marquer comme lues</button></div>';

  document.getElementById('btn-marquer-lues').onclick = async () => {
    await sb.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', AdminState.currentUser.id).eq('type', 'dda_alert').is('read_at', null);
    loadAlertesBanner();
  };
}

function fmtMinSecAdmin(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

async function openDetailModal(obligationId) {
  const overlay = document.getElementById('detail-modal');
  const content = document.getElementById('detail-modal-content');
  content.innerHTML = '<div class="empty-state">Chargement…</div>';
  overlay.classList.add('show');

  const { data: obligation, error: obligationErr } = await sb
    .from('dda_obligations')
    .select('id, annee_civile, heures_requises, heures_realisees, statut, profiles(prenom, nom), dda_programmes(nom, contenu)')
    .eq('id', obligationId)
    .single();

  if (obligationErr || !obligation) {
    content.innerHTML = '<div class="empty-state">Erreur de chargement du détail.</div>';
    console.error(obligationErr);
    return;
  }

  const { data: sessions } = await sb
    .from('dda_sessions').select('id')
    .eq('obligation_id', obligationId).eq('modalite', 'e_learning');
  const sessionIds = (sessions || []).map(s => s.id);

  let progressByUnit = {};
  if (sessionIds.length) {
    const { data: progress } = await sb
      .from('dda_progression_unites')
      .select('unite_id, temps_passe_sec, duree_minimale_min, unite_validee, quiz_score, completed_at')
      .in('session_id', sessionIds);
    (progress || []).forEach(p => { progressByUnit[p.unite_id] = p; });
  }

  const sections = (obligation.dda_programmes?.contenu?.sections || []).filter(s => s.kind === 'lesson' || s.kind === 'evaluation');
  const nom = (obligation.profiles?.prenom || '') + ' ' + (obligation.profiles?.nom || '');

  let rows = sections.map(s => {
    const p = progressByUnit[s.id];
    const validee = !!(p && p.unite_validee);
    const tempsLabel = p ? fmtMinSecAdmin(p.temps_passe_sec) + ' / ' + s.duree_minimale_min + ' min' : '0:00 / ' + s.duree_minimale_min + ' min';
    const scoreLabel = s.kind === 'evaluation'
      ? (p && p.quiz_score !== null && p.quiz_score !== undefined ? p.quiz_score + '%' : 'non passé')
      : null;
    return '<div class="unit-row">' +
      '<span class="titre">' + (validee ? '<span class="unit-check">✅</span> ' : '<span class="unit-check">⬜</span> ') + s.tab + '</span>' +
      '<span class="meta">' + tempsLabel + (scoreLabel ? ' · QCM ' + scoreLabel : '') + '</span>' +
      '</div>';
  }).join('');

  if (!rows) rows = '<div class="empty-state">Aucun contenu e-learning suivi pour ce programme.</div>';

  content.innerHTML =
    '<h3>' + nom + '</h3>' +
    '<p style="color:var(--ink-soft);font-size:13px;margin:0 0 16px;">' +
      obligation.dda_programmes?.nom + ' — ' + obligation.annee_civile + ' — ' +
      Number(obligation.heures_realisees).toFixed(1) + ' / ' + obligation.heures_requises + 'h — ' +
      '<span class="badge ' + obligation.statut + '">' + obligation.statut.replace('_', ' ') + '</span>' +
    '</p>' +
    rows;
}

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('detail-modal');
  document.getElementById('detail-modal-close').onclick = () => overlay.classList.remove('show');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') overlay.classList.remove('show'); });
});
