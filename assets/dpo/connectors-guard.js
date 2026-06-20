/* ============================================================
   S@FE Work — Garde-fou connecteurs
   Aucun appel externe ne peut se faire sans autorisation admin.
   Charger ce script AVANT tout module qui appelle un service.

   Usage :
     const ok = await requireConnector('mistral');
     if (!ok) return; // bloqué, message affiché à l'utilisateur
   ============================================================ */

(function (global) {
  const SUPA_URL = window.SUPABASE_URL  || 'https://qdjmzietysukediqkebg.supabase.co';
  const SUPA_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_8uD3m60n9GfMt2h_GkmB7w_MpdFN5_s';

  let _supa = null;
  function getSupa() {
    if (!_supa && window.supabase) _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    return _supa;
  }

  // Cache en mémoire pour la session (évite N requêtes)
  const _cache = {};

  /**
   * Vérifie si un connecteur est actif.
   * Retourne true si actif, false sinon (et affiche un message).
   * @param {string} key       - service_key (ex: 'mistral', 'stripe')
   * @param {string} [context] - Description de ce qu'on essaie de faire (pour le message)
   */
  async function requireConnector(key, context = '') {
    if (_cache[key] === true) return true;

    const db = getSupa();
    if (!db) {
      _showBlock(key, context, 'Erreur : client Supabase non initialisé.');
      return false;
    }

    const { data, error } = await db
      .from('safe_connectors')
      .select('statut, label')
      .eq('service_key', key)
      .maybeSingle();

    if (error || !data) {
      _showBlock(key, context, `Connecteur "${key}" introuvable dans le catalogue.`);
      return false;
    }

    if (data.statut !== 'actif') {
      _showBlock(key, context, null, data.label, data.statut);
      return false;
    }

    _cache[key] = true;
    return true;
  }

  /**
   * Invalide le cache (utile après activation/désactivation).
   * @param {string} [key] - si omis, vide tout le cache
   */
  function invalidateConnectorCache(key) {
    if (key) delete _cache[key];
    else Object.keys(_cache).forEach(k => delete _cache[k]);
  }

  /**
   * Récupère tous les connecteurs actifs (pour affichage dashboard).
   */
  async function getActiveConnectors() {
    const db = getSupa();
    if (!db) return [];
    const { data } = await db
      .from('safe_connectors')
      .select('service_key, label, cat, ico, statut')
      .eq('statut', 'actif');
    return data || [];
  }

  /* ---- Affichage bloc bloquant ---- */
  function _showBlock(key, context, errorMsg, label, statut) {
    // Si un conteneur de blocage existe dans la page, on l'utilise
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
        <a href="/work/connecteurs.html"
          style="display:inline-block;font-family:var(--ff-disp,sans-serif);font-weight:700;
          font-size:.82rem;padding:8px 18px;border-radius:10px;
          background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#0a1628;text-decoration:none">
          🔌 Configurer dans le centre de connecteurs →
        </a>
      </div>`;

    if (container) {
      container.innerHTML = html;
    } else {
      // Toast de secours si pas de conteneur
      console.warn(`[S@FE Connecteurs] "${key}" non actif. ${context}`);
    }
  }

  // Exposition globale
  global.requireConnector        = requireConnector;
  global.invalidateConnectorCache = invalidateConnectorCache;
  global.getActiveConnectors     = getActiveConnectors;

})(window);
