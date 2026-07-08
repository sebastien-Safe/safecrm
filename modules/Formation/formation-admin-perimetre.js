/* ═══════════════ Formation DDA — Vue Périmètre ════════════════════════════ */

async function loadPerimetre() {
  await loadAlertesBanner();

  const el = document.getElementById('perimetre-table');
  el.innerHTML = '<div class="empty-state">Chargement…</div>';

  const { data, error } = await sb
    .from('dda_obligations')
    .select('id, annee_civile, heures_requises, heures_realisees, statut, profiles(id, prenom, nom), dda_programmes(nom)')
    .order('annee_civile', { ascending: false });

  if (error) { el.innerHTML = '<div class="empty-state">Erreur de chargement.</div>'; console.error(error); return; }
  if (!data || !data.length) { el.innerHTML = '<div class="empty-state">Aucune obligation assignée pour le moment.</div>'; return; }

  let html = '<table><thead><tr><th>Collaborateur</th><th>Année</th><th>Programme</th><th>Heures</th><th>Statut</th></tr></thead><tbody>';
  data.forEach(o => {
    const pct = Math.min(100, Math.round((o.heures_realisees / o.heures_requises) * 100));
    html += '<tr>' +
      '<td>' + (o.profiles ? (o.profiles.prenom || '') + ' ' + (o.profiles.nom || '') : '—') + '</td>' +
      '<td>' + o.annee_civile + '</td>' +
      '<td>' + (o.dda_programmes?.nom || '—') + '</td>' +
      '<td><div class="jauge"><div class="jauge-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="mono" style="font-size:11.5px;color:var(--ink-soft)">' + Number(o.heures_realisees).toFixed(1) + ' / ' + o.heures_requises + 'h</span></td>' +
      '<td><span class="badge ' + o.statut + '">' + o.statut.replace('_', ' ') + '</span></td>' +
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
