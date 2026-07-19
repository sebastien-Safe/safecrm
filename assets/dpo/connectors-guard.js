/* ============================================================
   S@FE Work — Garde-fou connecteurs v2
   - Aucun appel externe sans autorisation admin explicite.
   - Statuts valides : "actif" (production) | "simule" (demo, aucun appel réel)
   ============================================================ */

(function (global) {
  const SUPA_URL = window.SUPABASE_URL  || 'https://qdjmzietysukediqkebg.supabase.co';
  const SUPA_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_8uD3m60n9GfMt2h_GkmB7w_MpdFN5_s';

  let _supa = null;
  function getSupa() {
    if (!_supa && window.supabase) _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    return _supa;
  }

  // Cache session (évite N requêtes)
  const _cache = {};   // key → 'actif' | 'simule' | false

  /**
   * Vérifie si un connecteur est utilisable (actif ou simulé).
   * @returns {boolean} true si ok, false si bloqué
   */
  async function requireConnector(key, context = '') {
    if (_cache[key] === 'actif' || _cache[key] === 'simule') return true;

    const db = getSupa();
    if (!db) { _showBlock(key, context, 'Client Supabase non initialisé.'); return false; }

    const { data, error } = await db.from('safe_connectors')
      .select('statut, label').eq('service_key', key).maybeSingle();

    if (error || !data) { _showBlock(key, context, `Connecteur "${key}" introuvable.`); return false; }

    if (data.statut === 'actif' || data.statut === 'simule') {
      _cache[key] = data.statut;
      return true;
    }

    _showBlock(key, context, null, data.label, data.statut);
    return false;
  }

  /**
   * Retourne true si le connecteur est en mode simulation (pas de vrai appel).
   */
  async function isSimulated(key) {
    if (_cache[key]) return _cache[key] === 'simule';
    const db = getSupa();
    if (!db) return false;
    const { data } = await db.from('safe_connectors').select('statut').eq('service_key', key).maybeSingle();
    if (data) _cache[key] = data.statut === 'actif' || data.statut === 'simule' ? data.statut : false;
    return data?.statut === 'simule';
  }

  function invalidateConnectorCache(key) {
    if (key) delete _cache[key];
    else Object.keys(_cache).forEach(k => delete _cache[k]);
  }

  async function getActiveConnectors() {
    const db = getSupa();
    if (!db) return [];
    const { data } = await db.from('safe_connectors')
      .select('service_key, label, cat, ico, statut')
      .in('statut', ['actif', 'simule']);
    return data || [];
  }

  /* ---- Bloc bloquant ---- */
  function _showBlock(key, context, errorMsg, label, statut) {
    const container = document.getElementById('connector-block-' + key)
      || document.getElementById('connector-block');

    const statusLabel = {
      non_configure: 'Non configuré',
      configure:     'Configuré (non activé)',
      desactive:     'Désactivé',
    }[statut] || statut || 'Inconnu';

    const html = `
      <div style="background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.25);
        border-radius:10px;padding:16px 18px;text-align:center">
        <div style="font-size:1.5rem;margin-bottom:8px">🔌</div>
        <div style="font-family:var(--ff-disp,sans-serif);font-weight:700;color:#fff;margin-bottom:6px">
          ${errorMsg || `Connecteur "${label || key}" requis`}
        </div>
        ${!errorMsg ? `<div style="font-family:var(--ff-mono,monospace);font-size:.74rem;
          color:rgba(245,158,11,.8);margin-bottom:10px">Statut actuel : ${statusLabel}</div>` : ''}
        ${context ? `<div style="font-size:.8rem;color:rgba(255,255,255,.45);margin-bottom:12px">${context}</div>` : ''}
        <a href="/modules/connecteurs.html"
          style="display:inline-block;font-family:var(--ff-disp,sans-serif);font-weight:700;
          font-size:.82rem;padding:8px 18px;border-radius:10px;
          background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#0a1628;text-decoration:none">
          🔌 Configurer dans le centre de connecteurs →
        </a>
      </div>`;

    if (container) {
      container.innerHTML = html;
    } else {
      console.warn(`[S@FE Connecteurs] "${key}" non actif. ${context}`);
    }
  }

  // ── Ordre de priorité IA ─────────────────────────────────────────────────
  const IA_PRIORITY = ["anthropic", "grok"];

  /**
   * Retourne la service_key du premier connecteur IA actif (ou simulé).
   * Ordre : anthropic > grok
   * @returns {string|null}
   */
  async function getActiveIAConnector() {
    const db = getSupa();
    if (!db) return null;
    const { data } = await db.from("safe_connectors")
      .select("service_key, statut")
      .in("service_key", IA_PRIORITY)
      .in("statut", ["actif", "simule"]);
    if (!data?.length) return null;
    for (const key of IA_PRIORITY) {
      const found = data.find(r => r.service_key === key);
      if (found) return found.service_key;
    }
    return null;
  }

  /**
   * Appelle l'Edge Function call-ia avec les messages fournis.
   * Gère l'auth JWT automatiquement.
   * @param {{ serviceKey?: string, system?: string, messages: {role:string,content:string}[] }} opts
   * @returns {Promise<string>} La réponse textuelle du modèle
   */
  async function callIA({ serviceKey, system = "", messages = [] } = {}) {
    const db = getSupa();
    if (!db) throw new Error("Client Supabase non initialisé");

    const { data: { session } } = await db.auth.getSession();
    if (!session) throw new Error("Non authentifié");

    const res = await fetch(`${SUPA_URL}/functions/v1/call-ia`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ service_key: serviceKey, system, messages }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Erreur ${res.status}`);
    }

    const data = await res.json();
    return data.reply || "";
  }

  global.requireConnector         = requireConnector;
  global.isSimulated              = isSimulated;
  global.invalidateConnectorCache = invalidateConnectorCache;
  global.getActiveConnectors      = getActiveConnectors;
  global.getActiveIAConnector     = getActiveIAConnector;
  global.callIA                   = callIA;

})(window);
