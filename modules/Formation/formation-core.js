/* ═══════════════ Formation DDA — core (auth, données partagées) ═══════════ */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FormationState = {
  currentUser: null,
  annee: new Date().getFullYear(),
  obligation: null,
  programme: null,
  sessionId: null,
  progressionByUnit: {},   // unite_id -> {temps_passe_sec, unite_validee, quiz_score}
  sections: [],
  currentIndex: 0,
};

async function initFormation(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/'; return; }
  FormationState.currentUser = session.user;

  const { data: obligation, error: obligationErr } = await sb
    .from('dda_obligations')
    .select('id, heures_requises, heures_realisees, statut, annee_civile, programme_id, dda_programmes(id, nom, contenu)')
    .eq('collaborateur_id', FormationState.currentUser.id)
    .eq('annee_civile', FormationState.annee)
    .maybeSingle();

  if (obligationErr || !obligation) {
    renderNoProgramme();
    return;
  }

  FormationState.obligation = obligation;
  FormationState.programme = obligation.dda_programmes;
  FormationState.sections = (obligation.dda_programmes?.contenu?.sections) || [];

  const { data: sessionId, error: startErr } = await sb.rpc('dda_start_session', { p_annee: FormationState.annee });
  if (startErr) {
    console.error('dda_start_session', startErr);
    renderNoProgramme();
    return;
  }
  FormationState.sessionId = sessionId;

  await loadProgression();
  renderParcours();
}

async function loadProgression(){
  const { data, error } = await sb
    .from('dda_progression_unites')
    .select('unite_id, temps_passe_sec, duree_minimale_min, unite_validee, quiz_score')
    .eq('session_id', FormationState.sessionId);
  if (error) { console.error('loadProgression', error); return; }
  FormationState.progressionByUnit = {};
  (data || []).forEach(row => { FormationState.progressionByUnit[row.unite_id] = row; });
}

function renderNoProgramme(){
  const panel = document.getElementById('panel');
  if (panel) {
    panel.innerHTML = '<div class="empty-state"><h2>Aucun programme assigné</h2><p>Aucune formation continue DDA ne vous a été assignée pour ' + FormationState.annee + '. Contactez votre formateur interne.</p></div>';
  }
  const footer = document.getElementById('footer-nav');
  if (footer) footer.style.display = 'none';
}
