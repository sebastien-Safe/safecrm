/* ============================================================
   DPO Client — Intégration CRM (modal contact)
   Injecte la barre de score RGPD dans la fiche contact
   Aucun service externe — lecture seule sur Supabase
   ============================================================ */

(function () {
  const SUPA_URL = window._SUPA_URL || 'https://qdjmzietysukediqkebg.supabase.co';
  const SUPA_KEY = window._SUPA_KEY || 'sb_publishable_8uD3m60n9GfMt2h_GkmB7w_MpdFN5_s';
  let _supa = null;

  function getSupa() {
    if (!_supa && window.supabase) {
      _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    }
    return _supa;
  }

  function scoreColor(s) {
    if (s >= 80) return '#22c55e';
    if (s >= 50) return '#f59e0b';
    return '#ef4444';
  }

  async function loadDpoSection(contactId) {
    const el = document.getElementById('contact-dpo-section');
    if (!el) return;
    const db = getSupa();
    if (!db) { el.innerHTML = ''; return; }

    const { data: profile } = await db
      .from('dpo_client_profiles')
      .select('score_global,last_audit_at')
      .eq('contact_id', contactId)
      .maybeSingle();

    const score = profile?.score_global ?? null;
    const lastAudit = profile?.last_audit_at;

    el.innerHTML = `
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
            color:rgba(255,255,255,.35);font-family:var(--ff-mono)">Score RGPD</span>
          <a href="/work/DPO/module-dpo-clients.html#${contactId}"
            style="font-size:.72rem;color:var(--gold);text-decoration:none;
            font-family:var(--ff-mono);opacity:.8"
            target="_blank" rel="noopener">⚖️ Ouvrir DPO →</a>
        </div>
        ${score !== null ? `
          <div style="display:flex;align-items:center;gap:10px">
            <div style="flex:1;height:7px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${score}%;background:${scoreColor(score)};border-radius:4px;
                transition:width .5s ease"></div>
            </div>
            <span style="font-family:var(--ff-mono);font-size:.82rem;font-weight:700;
              color:${scoreColor(score)};min-width:36px;text-align:right">${score}%</span>
          </div>
          ${lastAudit ? `<div style="font-size:.7rem;color:rgba(255,255,255,.3);margin-top:4px;
            font-family:var(--ff-mono)">Dernier audit : ${new Date(lastAudit).toLocaleDateString('fr-FR')}</div>` : ''}
        ` : `
          <div style="font-size:.76rem;color:rgba(255,255,255,.3);font-family:var(--ff-mono);font-style:italic">
            Aucun suivi DPO — <a href="/work/DPO/module-dpo-clients.html"
              style="color:var(--gold);text-decoration:none" target="_blank">Démarrer →</a>
          </div>`}
      </div>`;
  }

  /* Monkey-patch openContactModal sans modifier index.html côté JS */
  function patchContactModal() {
    const origOpen = window.openContactModal;
    if (!origOpen) return;
    window.openContactModal = function (contact, ...args) {
      origOpen.call(this, contact, ...args);
      if (contact?.id) {
        setTimeout(() => loadDpoSection(contact.id), 120);
      }
    };
  }

  /* Observer : attend que le modal contact soit dans le DOM */
  function waitAndPatch() {
    if (window.openContactModal) {
      patchContactModal();
      return;
    }
    const obs = new MutationObserver(() => {
      if (window.openContactModal) {
        obs.disconnect();
        patchContactModal();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndPatch);
  } else {
    waitAndPatch();
  }
})();
