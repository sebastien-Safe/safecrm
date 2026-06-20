/* ============================================================
   DPO Clients — Assistant RGPD
   Aucun service IA connecté sans autorisation admin explicite.
   Utilise connectors-guard.js pour vérifier avant tout appel.
   ============================================================ */

async function loadAssistant() {
  const el = document.getElementById('assistant-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  // Vérifier le statut réel depuis la base
  const db = window.supa || supa;
  const { data: mistral } = await db.from('safe_connectors')
    .select('statut,label').eq('service_key', 'mistral').maybeSingle();
  const { data: anthropic } = await db.from('safe_connectors')
    .select('statut,label').eq('service_key', 'anthropic').maybeSingle();

  const anyActive = [mistral, anthropic].some(c => c?.statut === 'actif');
  const activeConn = [mistral, anthropic].find(c => c?.statut === 'actif');

  el.innerHTML = `
    <div class="card assistant-card" style="text-align:center;padding:36px 24px">
      <div style="font-size:2.5rem;margin-bottom:10px">🤖</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:6px">
        Assistant RGPD — S@FE Work
      </div>

      <!-- Statut réel -->
      <div style="font-family:var(--ff-mono);font-size:.78rem;
        border:1px solid var(--line);border-radius:var(--r-sm);display:inline-block;
        padding:4px 14px;margin:8px 0 20px">
        Statut :
        <span style="color:${anyActive ? 'var(--ok)' : 'var(--warn)'}">
          ${anyActive ? '🟢 ' + activeConn.label + ' connecté' : '🟡 Non configuré'}
        </span>
      </div>

      <!-- Fonctionnalités -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
        gap:10px;text-align:left;max-width:600px;margin:0 auto 24px">
        ${[
          ['📋','Aide à la rédaction','Politiques, mentions légales, registre'],
          ['🔍','Analyse de risques','Évaluation des traitements et lacunes'],
          ['📩','Réponses aux droits','Modèles de réponses aux demandes'],
          ['⚠️','Alertes de conformité','Détection proactive des non-conformités'],
        ].map(([ico,titre,desc])=>`
          <div style="background:rgba(255,255,255,.03);border:1px solid var(--line);
            border-radius:var(--r-sm);padding:14px 16px;
            opacity:${anyActive?'1':'.55'}">
            <div style="font-size:1.1rem;margin-bottom:6px">${ico}</div>
            <div style="font-size:.82rem;font-weight:600;color:#fff;margin-bottom:3px">${titre}</div>
            <div style="font-size:.74rem;color:var(--mut)">${desc}</div>
          </div>`).join('')}
      </div>

      ${anyActive ? '' : `
        <!-- Bloc sécurité si non configuré -->
        <div style="background:rgba(255,180,0,.06);border:1px solid rgba(255,180,0,.2);
          border-radius:var(--r-sm);padding:14px 18px;max-width:500px;margin:0 auto 20px;text-align:left">
          <div style="font-size:.78rem;font-weight:700;color:var(--gold);margin-bottom:6px;
            font-family:var(--ff-mono)">RÈGLE DE SÉCURITÉ S@FE</div>
          <p style="font-size:.78rem;color:var(--mut-2);margin:0">
            Avant toute activation, le système affiche le service concerné, son utilité,
            son coût, ses limites, les données échangées —
            et demande explicitement l'autorisation administrateur.
          </p>
        </div>
        <a href="/work/connecteurs.html"
          class="btn btn-ghost" style="margin-bottom:10px">
          🔌 Configurer un connecteur IA →
        </a>`}
    </div>

    <!-- Zone de conversation -->
    <div class="card" id="assistant-chat-card"
      style="margin-top:14px${anyActive ? '' : ';opacity:.4;pointer-events:none'}">
      <div class="card-header">
        <span class="card-title">— Interface de conversation</span>
        ${anyActive
          ? `<span class="badge badge-ok">${activeConn.label}</span>`
          : '<span class="badge badge-gray">Désactivé</span>'}
      </div>
      <div style="display:flex;gap:10px;padding:10px 0">
        <input class="form-input" id="assistant-input"
          placeholder="${anyActive ? 'Posez une question RGPD…' : 'Configurez un connecteur IA pour activer'}"
          ${anyActive ? '' : 'disabled'} style="flex:1">
        <button class="btn btn-pri" id="assistant-send"
          onclick="sendAssistantMessage()"
          ${anyActive ? '' : 'disabled'}>Envoyer</button>
      </div>
      <div id="assistant-output" style="background:rgba(255,255,255,.02);border:1px solid var(--line);
        border-radius:var(--r-sm);padding:14px;min-height:80px;
        font-size:.82rem;color:var(--mut);font-style:italic">
        ${anyActive ? 'Prêt — posez votre question.' : 'En attente de configuration…'}
      </div>
    </div>`;
}

async function sendAssistantMessage() {
  const input = document.getElementById('assistant-input');
  const output = document.getElementById('assistant-output');
  const question = input?.value?.trim();
  if (!question) return;

  // Vérification du garde-fou avant tout appel
  const ok = await requireConnector('mistral', 'Envoi d\'une question à l\'assistant RGPD')
    || await requireConnector('anthropic', 'Envoi d\'une question à l\'assistant RGPD');

  if (!ok) {
    if (output) output.innerHTML =
      '<span style="color:var(--alert)">Aucun connecteur IA actif. ' +
      '<a href="/work/connecteurs.html" style="color:var(--gold)">Configurer →</a></span>';
    return;
  }

  // Ici : appel IA à implémenter lors de l'activation du connecteur
  if (output) output.innerHTML =
    '<span style="color:var(--warn)">Connecteur actif mais appel non implémenté.' +
    ' Activez le service depuis le centre de connecteurs.</span>';
}
