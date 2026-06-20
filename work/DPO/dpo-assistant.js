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

  const anyActive = [mistral, anthropic].some(c => c?.statut === 'actif' || c?.statut === 'simule');
  const activeConn = [mistral, anthropic].find(c => c?.statut === 'actif' || c?.statut === 'simule');
  const isDemo    = anyActive && activeConn?.statut === 'simule';

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
          ? (isDemo
              ? '<span class="badge" style="background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.3)">⚡ Simulation</span>'
              : `<span class="badge badge-ok">${activeConn.label}</span>`)
          : '<span class="badge badge-gray">Désactivé</span>'}
      </div>
      ${isDemo ? `<div style="font-size:.74rem;color:#a78bfa;font-family:var(--ff-mono);
        padding:5px 10px;margin-bottom:8px;background:rgba(139,92,246,.08);
        border:1px solid rgba(139,92,246,.2);border-radius:6px">
        ⚡ Mode simulation — Réponses exemples, aucun appel IA réel.
      </div>` : ''}
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
        ${anyActive
          ? (isDemo ? '⚡ Mode Démo — Posez une question pour voir une réponse simulée.' : 'Prêt — posez votre question.')
          : 'En attente de configuration…'}
      </div>
    </div>`;
}

const DEMO_RESPONSES = [
  {
    match: ['consentement','consent'],
    reply: `**Consentements RGPD — Points clés**\n\nLe consentement doit être libre, spécifique, éclairé et univoque (Art.7 RGPD). Il doit être aussi facile à retirer qu'à donner.\n\n• Enregistrez la date, la source et la portée de chaque consentement\n• Prévoyez un mécanisme de retrait simple (lien de désabonnement, formulaire)\n• Renouvelez les consentements anciens (> 3 ans) pour les listes email\n\n_[Réponse simulée — connectez un service IA pour des réponses personnalisées]_`
  },
  {
    match: ['droit','effacement','oubli','rectification','portabilité'],
    reply: `**Exercice des droits (Art.15–22 RGPD)**\n\nDélai légal de réponse : 1 mois, prorogeable à 3 mois pour les demandes complexes.\n\n• **Droit d'accès (Art.15)** : fournir une copie des données traitées\n• **Rectification (Art.16)** : corriger les données inexactes sans délai\n• **Effacement (Art.17)** : supprimer si plus de finalité ou retrait du consentement\n• **Portabilité (Art.20)** : exporter en CSV/JSON si traitement automatisé\n\n_[Réponse simulée]_`
  },
  {
    match: ['violation','incident','fuite','breach','cnil'],
    reply: `**Violations de données — Procédure**\n\nNotification CNIL obligatoire sous **72h** si la violation présente un risque pour les droits et libertés (Art.33).\n\n1. Qualifier la violation (confidentialité, intégrité, disponibilité)\n2. Évaluer le risque pour les personnes concernées\n3. Notifier la CNIL via notifications.cnil.fr si risque élevé\n4. Notifier les personnes si risque très élevé (Art.34)\n\n_[Réponse simulée]_`
  },
  {
    match: ['registre','traitement','article 30','art.30'],
    reply: `**Registre des activités de traitement (Art.30)**\n\nObligatoire pour les structures de + de 250 salariés et recommandé pour toutes. À documenter pour chaque traitement :\n\n• Finalité du traitement\n• Catégories de personnes et de données\n• Destinataires (internes + sous-traitants)\n• Durées de conservation\n• Mesures de sécurité techniques et organisationnelles\n\n_[Réponse simulée]_`
  },
  {
    match: [],
    reply: `**Assistant RGPD — Mode Simulation**\n\nJe suis en mode démo. Dans cette interface, je peux vous aider sur :\n\n• Consentements et droits des personnes\n• Registre des traitements (Art.30)\n• Violations de données et notification CNIL\n• Documentation et procédures RGPD\n• Évaluation des risques et conformité\n\nActivez un connecteur IA (Mistral ou Claude) dans les paramètres pour des réponses personnalisées basées sur vos données clients.\n\n_[Réponse simulée]_`
  },
];

async function sendAssistantMessage() {
  const input  = document.getElementById('assistant-input');
  const output = document.getElementById('assistant-output');
  const question = input?.value?.trim();
  if (!question) return;

  const ok = await requireConnector('mistral', 'Assistant RGPD')
    || await requireConnector('anthropic', 'Assistant RGPD');

  if (!ok) {
    if (output) output.innerHTML =
      '<span style="color:var(--alert)">Aucun connecteur IA actif. ' +
      '<a href="/work/connecteurs.html" style="color:var(--gold)">Configurer →</a></span>';
    return;
  }

  // Mode simulation : réponse mockée
  const simMistral   = await isSimulated('mistral');
  const simAnthropic = await isSimulated('anthropic');
  if (simMistral || simAnthropic) {
    output.innerHTML = '<span style="color:var(--mut)">⚡ Simulation en cours…</span>';
    await new Promise(r => setTimeout(r, 900));

    const qLow = question.toLowerCase();
    const entry = DEMO_RESPONSES.find(d => d.match.some(kw => qLow.includes(kw)));
    const reply = (entry || DEMO_RESPONSES[DEMO_RESPONSES.length - 1]).reply;

    output.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <span style="font-size:.72rem;color:var(--mut);font-family:var(--ff-mono)">Vous :</span>
        <span style="font-size:.82rem;color:var(--mut-2)">${escHtml(question)}</span>
      </div>
      <div style="border-top:1px solid var(--line);padding-top:10px">
        <span style="font-size:.68rem;color:#a78bfa;font-family:var(--ff-mono)">⚡ Simulation :</span>
        <div style="font-size:.83rem;color:var(--mut-2);line-height:1.65;margin-top:6px;white-space:pre-line">${escHtml(reply).replace(/\*\*(.*?)\*\*/g,'<strong style="color:#fff">$1</strong>')}</div>
      </div>`;
    input.value = '';
    return;
  }

  // Mode production (connecteur réel) — appel à implémenter
  output.innerHTML =
    '<span style="color:var(--warn)">Connecteur actif — appel API à implémenter lors de l\'activation.</span>';
}
