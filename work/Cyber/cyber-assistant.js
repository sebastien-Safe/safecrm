/* ============================================================
   S@FE Work — Cyber Assistant IA
   Dépend de connectors-guard.js (callIA, getActiveIAConnector,
   requireConnector, isSimulated)
   ============================================================ */

const CYBER_SYSTEM =
  "Tu es un expert en cybersécurité pour TPE/PME françaises, basé sur les référentiels ANSSI et CIS Controls. " +
  "Tu analyses les risques, proposes des plans d'action correctifs, aides à rédiger des rapports d'incidents " +
  "et recommandes des solutions concrètes adaptées aux petites structures (budget limité, peu de ressources IT). " +
  "Réponds en français, de manière structurée, concise et actionnable.";

const CYBER_DEMO_RESPONSES = [
  {
    match: ['phishing','hameçonnage','mail suspect','email suspect'],
    reply: `**Incident Phishing — Procédure de réponse**\n\n1. **Isolation immédiate** : déconnecter le poste du réseau (Wi-Fi + câble)\n2. **Conserver les preuves** : screenshot de l'email + en-têtes (Ctrl+U dans le webmail)\n3. **Évaluer l'impact** : credentials saisis ? Fichiers ouverts ? Liens cliqués ?\n4. **Changer les mots de passe** des comptes potentiellement compromis depuis un autre appareil\n5. **Signaler** : signal-spam.fr + CNIL si données personnelles exposées\n6. **Sensibiliser l'équipe** : alerte immédiate + rappel des bonnes pratiques\n\n_[Réponse simulée — connectez un connecteur IA pour des analyses personnalisées]_`
  },
  {
    match: ['ransomware','rançon','chiffrement','cryptolocker'],
    reply: `**Ransomware — Plan de crise**\n\n⚠️ **Ne jamais payer la rançon** — aucune garantie de récupération.\n\n**Actions immédiates (H+0)**\n• Isoler tous les postes infectés du réseau\n• Couper les partages réseau et NAS\n• Identifier le patient zéro (premier poste infecté)\n\n**Évaluation (H+2)**\n• Identifier la souche (nomoreransom.org)\n• Lister les fichiers et systèmes affectés\n• Vérifier l'état des sauvegardes offline\n\n**Récupération**\n• Restaurer depuis la dernière sauvegarde saine\n• Réinstaller les postes compromis from scratch\n• Déposer plainte : police + ANSSI (si entreprise critique)\n\n_[Réponse simulée]_`
  },
  {
    match: ['mot de passe','password','authentification','mfa','2fa'],
    reply: `**Politique de mots de passe — Recommandations ANSSI**\n\n• **Longueur minimale** : 12 caractères (16+ recommandé)\n• **Complexité** : majuscules, minuscules, chiffres, caractères spéciaux\n• **Unicité** : un mot de passe différent par service\n• **Gestionnaire** : Bitwarden (open-source) ou 1Password pour l'équipe\n• **MFA obligatoire** sur : messagerie, CRM, banque, hébergement\n• **Ne jamais partager** un mot de passe par email ou messagerie\n\nScore de risque actuel sans MFA : **Élevé** — activation recommandée en priorité absolue.\n\n_[Réponse simulée]_`
  },
  {
    match: ['sauvegarde','backup','perte de données'],
    reply: `**Stratégie de sauvegarde — Règle 3-2-1**\n\n• **3** copies des données\n• **2** supports différents (disque local + cloud)\n• **1** copie hors site (offsite ou cloud distant)\n\n**Pour TPE/PME :**\n• Sauvegarde automatique quotidienne (Veeam, Acronis, ou natif Windows Server)\n• Rétention : 7 jours quotidiennes + 4 semaines hebdomadaires\n• Test de restauration mensuel obligatoire\n• Sauvegarde offline (air-gap) pour protection ransomware\n\n**Solutions recommandées :** Backblaze B2 (cloud économique) + disque externe chiffré (VeraCrypt).\n\n_[Réponse simulée]_`
  },
  {
    match: ['audit','score','bilan','évaluation','vulnérabilité'],
    reply: `**Analyse du score de sécurité**\n\nLes 5 axes prioritaires selon le référentiel ANSSI :\n\n1. **Gestion des accès** (IAM) — MFA, principe du moindre privilège\n2. **Mise à jour** — OS, applications, firmware en moins de 30j\n3. **Sauvegarde** — règle 3-2-1, test mensuel\n4. **Sensibilisation** — formation annuelle anti-phishing obligatoire\n5. **Plan de continuité** — PCA/PRA documenté et testé\n\nChaque axe non conforme augmente le risque d'incident de 40% (source ANSSI 2024).\n\n_[Réponse simulée]_`
  },
  {
    match: [],
    reply: `**Assistant Cybersécurité — Mode Simulation**\n\nJe suis en mode démo. Je peux vous aider sur :\n\n• **Incidents** : phishing, ransomware, intrusion, fuite de données\n• **Audit** : analyse des résultats, recommandations ANSSI/CIS\n• **Mots de passe** : politique, MFA, gestionnaires\n• **Sauvegardes** : stratégie 3-2-1, outils recommandés\n• **Plan d'action** : priorisation et budget sécurité TPE\n• **Conformité** : ANSSI, ISO 27001 niveau TPE\n\nActivez un connecteur IA dans les paramètres pour des réponses personnalisées basées sur les données de vos clients.\n\n_[Réponse simulée]_`
  },
];

async function loadCyberAssistant() {
  const el = document.getElementById('assistant-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  const db = window.supa || supa;
  const keys = ['groq', 'grok', 'anthropic', 'mistral'];
  const results = await Promise.all(
    keys.map(k => db.from('safe_connectors').select('statut,label').eq('service_key', k).maybeSingle())
  );
  const connectors = results.map(r => r.data);
  const activeConn = connectors.find(c => c?.statut === 'actif' || c?.statut === 'simule');
  const anyActive  = !!activeConn;
  const isDemo     = anyActive && activeConn?.statut === 'simule';

  const clientCtx = currentContact
    ? `Client sélectionné : ${currentContact.entreprise || currentContact.nom}. `
    : '';

  el.innerHTML = `
    <div class="card" style="text-align:center;padding:28px 24px;margin-bottom:14px">
      <div style="font-size:2rem;margin-bottom:8px">🛡🤖</div>
      <div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:6px">Assistant Cybersécurité IA</div>
      <div style="font-family:var(--ff-mono);font-size:.78rem;border:1px solid var(--line);
        border-radius:var(--r-sm);display:inline-block;padding:4px 14px;margin-bottom:16px">
        Statut :
        <span style="color:${anyActive ? 'var(--ok)' : 'var(--warn)'}">
          ${anyActive ? '🟢 ' + activeConn.label + (isDemo ? ' (simulation)' : '') : '🟡 Non configuré'}
        </span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
        gap:10px;text-align:left;max-width:640px;margin:0 auto 20px">
        ${[
          ['🔍','Analyse d\'incidents','Phishing, ransomware, intrusion'],
          ['📋','Plan d\'action','Priorisation des mesures correctives'],
          ['🔐','Politique sécurité','MFA, mots de passe, accès'],
          ['💾','Sauvegardes','Stratégie 3-2-1, tests de restauration'],
        ].map(([ico,t,d]) => `
          <div style="background:rgba(255,255,255,.03);border:1px solid var(--line);
            border-radius:var(--r-sm);padding:12px 14px;opacity:${anyActive?'1':'.5'}">
            <div style="font-size:1rem;margin-bottom:4px">${ico}</div>
            <div style="font-size:.82rem;font-weight:600;color:#fff;margin-bottom:2px">${t}</div>
            <div style="font-size:.74rem;color:var(--mut)">${d}</div>
          </div>`).join('')}
      </div>
      ${!anyActive ? `
        <a href="/work/connecteurs.html" class="btn btn-ghost" style="margin-bottom:8px">
          🔌 Configurer un connecteur IA →
        </a>` : ''}
    </div>

    <!-- Zone de conversation -->
    <div class="card" style="${anyActive ? '' : 'opacity:.4;pointer-events:none'}">
      <div class="card-header">
        <span class="card-title">— Interface de conversation</span>
        ${isDemo ? '<span class="badge" style="background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.3)">⚡ Simulation</span>' : ''}
      </div>
      ${isDemo ? '<div style="font-size:.74rem;color:#a78bfa;font-family:var(--ff-mono);padding:5px 10px;margin-bottom:8px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:6px">⚡ Mode simulation — Réponses exemples, aucun appel IA réel.</div>' : ''}
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <select id="cyber-ia-suggest" style="font-size:.8rem;padding:6px 10px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:8px;color:var(--mut-2);flex:0 0 auto">
          <option value="">— Suggestions rapides —</option>
          <option value="Analyse les risques de sécurité prioritaires pour une TPE">Risques prioritaires TPE</option>
          <option value="Que faire en cas d'attaque ransomware ?">Procédure ransomware</option>
          <option value="Quelle politique de mots de passe recommandes-tu ?">Politique mots de passe</option>
          <option value="Comment mettre en place une stratégie de sauvegarde efficace ?">Stratégie sauvegarde</option>
          <option value="Comment sensibiliser les collaborateurs au phishing ?">Formation anti-phishing</option>
          <option value="${clientCtx}Analyse les points faibles de l'audit de sécurité et propose un plan d'action priorisé.">Analyser l'audit client</option>
        </select>
      </div>
      <div style="display:flex;gap:8px">
        <input class="form-input" id="cyber-ia-input"
          placeholder="${anyActive ? 'Posez une question cybersécurité…' : 'Configurez un connecteur IA'}"
          ${anyActive ? '' : 'disabled'} style="flex:1"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendCyberMessage()}">
        <button class="btn btn-pri" id="cyber-ia-send"
          onclick="sendCyberMessage()" ${anyActive ? '' : 'disabled'}>Envoyer</button>
      </div>
      <div id="cyber-ia-output" style="margin-top:12px;background:rgba(255,255,255,.02);
        border:1px solid var(--line);border-radius:var(--r-sm);padding:14px;min-height:80px;
        font-size:.82rem;color:var(--mut);font-style:italic">
        ${anyActive ? (isDemo ? '⚡ Mode Démo — Posez une question.' : 'Prêt — posez votre question.') : 'En attente de configuration…'}
      </div>
    </div>`;

  // Pré-remplir depuis le select
  document.getElementById('cyber-ia-suggest')?.addEventListener('change', function() {
    if (this.value) {
      const inp = document.getElementById('cyber-ia-input');
      if (inp) { inp.value = this.value; this.value = ''; inp.focus(); }
    }
  });
}

async function sendCyberMessage() {
  const input   = document.getElementById('cyber-ia-input');
  const output  = document.getElementById('cyber-ia-output');
  const question = input?.value?.trim();
  if (!question || !output) return;

  const activeKey = await getActiveIAConnector();
  if (!activeKey) {
    output.innerHTML = '<span style="color:var(--alert)">Aucun connecteur IA actif. <a href="/work/connecteurs.html" style="color:var(--gold)">Configurer →</a></span>';
    return;
  }

  // Mode simulation
  if (await isSimulated(activeKey)) {
    output.innerHTML = '<span style="color:var(--mut)">⚡ Simulation en cours…</span>';
    await new Promise(r => setTimeout(r, 800));
    const qLow  = question.toLowerCase();
    const entry = CYBER_DEMO_RESPONSES.find(d => d.match.some(kw => qLow.includes(kw)));
    const reply = (entry || CYBER_DEMO_RESPONSES[CYBER_DEMO_RESPONSES.length - 1]).reply;
    _renderCyberReply(question, reply, '⚡ Simulation');
    input.value = '';
    return;
  }

  // Mode production
  output.innerHTML = '<span style="color:var(--mut)">⏳ Analyse en cours…</span>';
  input.disabled = true;
  document.getElementById('cyber-ia-send').disabled = true;

  try {
    const clientCtx = currentContact
      ? `Contexte client : "${currentContact.entreprise || currentContact.nom}". `
      : '';

    const reply = await callIA({
      serviceKey: activeKey,
      system: CYBER_SYSTEM,
      messages: [{ role: 'user', content: clientCtx + question }],
    });
    _renderCyberReply(question, reply, activeKey);
    input.value = '';
  } catch (err) {
    output.innerHTML = `<span style="color:var(--alert)">Erreur : ${escHtml(String(err.message || err))}</span>`;
  } finally {
    input.disabled = false;
    document.getElementById('cyber-ia-send').disabled = false;
    input.focus();
  }
}

function _renderCyberReply(question, reply, provider) {
  const output = document.getElementById('cyber-ia-output');
  if (!output) return;
  output.style.fontStyle = 'normal';
  output.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <span style="font-size:.72rem;color:var(--mut);font-family:var(--ff-mono)">Vous :</span>
      <span style="font-size:.82rem;color:var(--mut-2)">${escHtml(question)}</span>
    </div>
    <div style="border-top:1px solid var(--line);padding-top:10px">
      <span style="font-size:.68rem;color:var(--ok);font-family:var(--ff-mono)">🤖 ${escHtml(provider)} :</span>
      <div style="font-size:.83rem;color:var(--mut-2);line-height:1.65;margin-top:6px;white-space:pre-line">${escHtml(reply).replace(/\*\*(.*?)\*\*/g,'<strong style="color:#fff">$1</strong>')}</div>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px">
      <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(${JSON.stringify(reply)}).then(()=>toast('Copié ✓'))">📋 Copier</button>
    </div>`;
}
