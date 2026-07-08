/* ═══════════════ Formation DDA — Espace formateur (core) ══════════════════ */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AdminState = {
  currentUser: null,
  collaborateurs: [],
};

async function initFormationAdmin() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/'; return; }
  AdminState.currentUser = session.user;

  const { data: profile } = await sb.from('profiles').select('is_formateur').eq('id', session.user.id).maybeSingle();
  if (!profile?.is_formateur) { window.location.href = '/'; return; }

  const { data: collabs } = await sb.from('profiles').select('id, prenom, nom').order('nom');
  AdminState.collaborateurs = collabs || [];

  loadPerimetre();
}

function collabLabel(c) {
  return (c.prenom || '') + ' ' + (c.nom || '') || c.id;
}

function fillCollabSelect(selectEl) {
  selectEl.innerHTML = AdminState.collaborateurs
    .map(c => `<option value="${c.id}">${collabLabel(c)}</option>`)
    .join('');
}
