/* ============================================================
   S@FE Work — SEO Assistant IA
   Dépend de connectors-guard.js (callIA, getActiveIAConnector,
   isSimulated)
   ============================================================ */

// Contexte de la dernière réponse (pour l'envoi email)
let _seoLastQuestion = '';
let _seoLastReply    = '';

const SEO_SYSTEM =
  "Tu es un expert en référencement local (SEO local) pour TPE/PME françaises. " +
  "Tu maîtrises Google Business Profile, la recherche de mots-clés locaux, l'optimisation on-page, " +
  "la création de contenu SEO et les techniques de netlinking local. " +
  "Tu fournis des recommandations concrètes, applicables rapidement avec peu de ressources. " +
  "Réponds en français, de manière structurée et actionnable, en citant des exemples concrets.";

const SEO_DEMO_RESPONSES = [
  {
    match: ['google business','fiche google','gmb','gmp'],
    reply: `**Optimisation Google Business Profile — Points clés**\n\n1. **Complétion du profil** : Nom exact, catégorie principale + secondaires, description 750 caractères avec mots-clés\n2. **Photos** : 10+ photos (façade, intérieur, équipe, produits) — MAJ mensuelle\n3. **Avis clients** : Répondre à 100% des avis dans les 48h. Solliciter activement après chaque prestation\n4. **Posts GMB** : 1 post/semaine minimum (offre, actualité, événement)\n5. **Questions/Réponses** : Créer vous-même les Q&A avec mots-clés cibles\n6. **Attributs** : Cocher tous les attributs pertinents (accessibilité, paiement, services)\n\n_[Réponse simulée — connectez un connecteur IA pour des analyses personnalisées]_`
  },
  {
    match: ['mot','clé','keyword','position','ranking'],
    reply: `**Stratégie Mots-clés Locaux — Méthode**\n\n**Structure cible :**\n• Page d'accueil : "[métier] + [ville principale]"\n• Pages services : "[service] + [ville]" (une page par service)\n• Pages locales : "[métier] + [commune/quartier]"\n\n**Outils gratuits :**\n• Google Search Console (positions réelles)\n• Google Autocomplete + "People Also Ask"\n• Answer The Public (questions fréquentes)\n• Ubersuggest (version gratuite)\n\n**Volumes cibles TPE :** 50–500 recherches/mois — concurrence faible, conversion élevée.\n\n_[Réponse simulée]_`
  },
  {
    match: ['contenu','article','blog','rédaction','texte'],
    reply: `**Plan de contenu SEO local — Template**\n\n**Structure d'un article optimisé :**\n• Titre H1 : mot-clé principal (50–60 caractères)\n• Introduction : mot-clé dans les 100 premiers mots\n• Sous-titres H2/H3 : variations du mot-clé + questions\n• Longueur : 800–1500 mots pour du contenu local\n• CTA : "Contactez-nous à [ville]" avec lien\n• Balise title (60 car.) + meta description (160 car.)\n\n**Fréquence recommandée :** 2 articles/mois minimum pour construire l'autorité.\n\n_[Réponse simulée]_`
  },
  {
    match: ['audit','analyse','erreur','problème','score'],
    reply: `**Audit SEO Rapide — Checklist 10 points**\n\n✅ **Technique**\n• HTTPS actif\n• Vitesse page mobile < 3s (PageSpeed Insights)\n• Responsive design\n• Sitemap.xml + robots.txt\n\n✅ **On-Page**\n• Balise title unique par page\n• Meta description unique\n• Structure H1 > H2 > H3 cohérente\n• Images avec attribut alt\n\n✅ **Local**\n• NAP (Nom, Adresse, Téléphone) cohérent partout\n• Google Business Profile complet et vérifié\n\n_[Réponse simulée]_`
  },
  {
    match: ['backlink','lien','netlinking','autorité','domain'],
    reply: `**Netlinking Local — Stratégie TPE**\n\n**Sources prioritaires (gratuites) :**\n• Annuaires locaux : Pages Jaunes, Yelp, Kompass\n• Chambres de commerce et métiers de la région\n• Presse locale et blogs spécialisés\n• Partenaires et fournisseurs (échange de liens)\n• Associations professionnelles du secteur\n\n**Règles :**\n• Privilégier la qualité vs la quantité\n• Liens dofollow depuis des sites DA > 20\n• Textes d'ancre variés (pas toujours le même mot-clé)\n• 5–10 liens/mois = croissance naturelle\n\n_[Réponse simulée]_`
  },
  {
    match: [],
    reply: `**Assistant SEO — Mode Simulation**\n\nJe suis en mode démo. Je peux vous aider sur :\n\n• **Google Business Profile** : optimisation, posts, avis\n• **Mots-clés locaux** : recherche, ciblage, structure\n• **Contenu SEO** : articles, pages services, templates\n• **Audit technique** : vitesse, mobile, balises\n• **Netlinking local** : sources de liens, stratégie\n• **Rapports** : métriques à suivre, outils gratuits\n\nActivez un connecteur IA dans les paramètres pour des recommandations personnalisées basées sur les données de vos clients.\n\n_[Réponse simulée]_`
  },
];

async function loadSeoAssistant() {
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
    ? `Client : ${currentContact.entreprise || currentContact.nom}. `
    : '';

  el.innerHTML = `
    <div class="card" style="text-align:center;padding:28px 24px;margin-bottom:14px">
      <div style="font-size:2rem;margin-bottom:8px">🔍🤖</div>
      <div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:6px">Assistant SEO Local IA</div>
      <div style="font-family:var(--ff-mono);font-size:.78rem;border:1px solid var(--line);
        border-radius:var(--r-sm);display:inline-block;padding:4px 14px;margin-bottom:16px">
        Statut :
        <span style="color:${anyActive ? 'var(--ok)' : 'var(--warn)'}">
          ${anyActive ? '🟢 ' + activeConn.label + (isDemo ? ' (simulation)' : '') : '🟡 Non configuré'}
        </span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
        gap:10px;text-align:left;max-width:640px;margin:0 auto 20px">
        ${[
          ['🗺','Google Business','Optimisation fiche et avis'],
          ['🔑','Mots-clés locaux','Ciblage et stratégie de contenu'],
          ['✍️','Rédaction SEO','Articles et pages optimisées'],
          ['📊','Analyse audit','Interprétation et recommandations'],
        ].map(([ico,t,d]) => `
          <div style="background:rgba(255,255,255,.03);border:1px solid var(--line);
            border-radius:var(--r-sm);padding:12px 14px;opacity:${anyActive?'1':'.5'}">
            <div style="font-size:1rem;margin-bottom:4px">${ico}</div>
            <div style="font-size:.82rem;font-weight:600;color:#fff;margin-bottom:2px">${t}</div>
            <div style="font-size:.74rem;color:var(--mut)">${d}</div>
          </div>`).join('')}
      </div>
      ${!anyActive ? `
        <a href="/work/connecteurs.html" class="btn btn-ghost">🔌 Configurer un connecteur IA →</a>` : ''}
    </div>

    <!-- Zone de conversation -->
    <div class="card" style="${anyActive ? '' : 'opacity:.4;pointer-events:none'}">
      <div class="card-header">
        <span class="card-title">— Interface de conversation</span>
        ${isDemo ? '<span class="badge" style="background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.3)">⚡ Simulation</span>' : ''}
      </div>
      ${isDemo ? '<div style="font-size:.74rem;color:#a78bfa;font-family:var(--ff-mono);padding:5px 10px;margin-bottom:8px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:6px">⚡ Mode simulation — Réponses exemples, aucun appel IA réel.</div>' : ''}
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <select id="seo-ia-suggest" style="font-size:.8rem;padding:6px 10px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:8px;color:var(--mut-2);flex:0 0 auto">
          <option value="">— Suggestions rapides —</option>
          <option value="Génère 10 mots-clés locaux prioritaires pour ce type de client">10 mots-clés prioritaires</option>
          <option value="Comment optimiser une fiche Google Business Profile ?">Optimiser Google Business</option>
          <option value="Rédige un article SEO sur les services de ce client pour sa ville principale">Rédiger un article SEO</option>
          <option value="Quels sont les 5 erreurs SEO les plus courantes pour les TPE ?">Erreurs SEO fréquentes</option>
          <option value="Comment obtenir des liens entrants locaux sans budget ?">Netlinking gratuit local</option>
          <option value="${clientCtx}Analyse les résultats de l'audit SEO et propose un plan d'action priorisé sur 3 mois.">Analyser l'audit client</option>
        </select>
      </div>
      <div style="display:flex;gap:8px">
        <input class="form-input" id="seo-ia-input"
          placeholder="${anyActive ? 'Posez une question SEO local…' : 'Configurez un connecteur IA'}"
          ${anyActive ? '' : 'disabled'} style="flex:1"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendSeoMessage()}">
        <button class="btn btn-pri" id="seo-ia-send"
          onclick="sendSeoMessage()" ${anyActive ? '' : 'disabled'}>Envoyer</button>
      </div>
      <div id="seo-ia-output" style="margin-top:12px;background:rgba(255,255,255,.02);
        border:1px solid var(--line);border-radius:var(--r-sm);padding:14px;min-height:80px;
        font-size:.82rem;color:var(--mut);font-style:italic">
        ${anyActive ? (isDemo ? '⚡ Mode Démo — Posez une question.' : 'Prêt — posez votre question SEO.') : 'En attente de configuration…'}
      </div>
    </div>`;

  document.getElementById('seo-ia-suggest')?.addEventListener('change', function() {
    if (this.value) {
      const inp = document.getElementById('seo-ia-input');
      if (inp) { inp.value = this.value; this.value = ''; inp.focus(); }
    }
  });
}

async function sendSeoMessage() {
  const input    = document.getElementById('seo-ia-input');
  const output   = document.getElementById('seo-ia-output');
  const question = input?.value?.trim();
  if (!question || !output) return;

  const activeKey = await getActiveIAConnector();
  if (!activeKey) {
    output.innerHTML = '<span style="color:var(--alert)">Aucun connecteur IA actif. <a href="/work/connecteurs.html" style="color:var(--gold)">Configurer →</a></span>';
    return;
  }

  if (await isSimulated(activeKey)) {
    output.innerHTML = '<span style="color:var(--mut)">⚡ Simulation en cours…</span>';
    await new Promise(r => setTimeout(r, 800));
    const qLow  = question.toLowerCase();
    const entry = SEO_DEMO_RESPONSES.find(d => d.match.some(kw => qLow.includes(kw)));
    const reply = (entry || SEO_DEMO_RESPONSES[SEO_DEMO_RESPONSES.length - 1]).reply;
    _renderSeoReply(question, reply, '⚡ Simulation');
    input.value = '';
    return;
  }

  output.innerHTML = '<span style="color:var(--mut)">⏳ Analyse en cours…</span>';
  input.disabled = true;
  document.getElementById('seo-ia-send').disabled = true;

  try {
    const clientCtx = currentContact
      ? `Contexte client : "${currentContact.entreprise || currentContact.nom}", secteur : "${currentContact.activites || 'non précisé'}". `
      : '';

    const reply = await callIA({
      serviceKey: activeKey,
      system: SEO_SYSTEM,
      messages: [{ role: 'user', content: clientCtx + question }],
    });
    _renderSeoReply(question, reply, activeKey);
    input.value = '';
  } catch (err) {
    output.innerHTML = `<span style="color:var(--alert)">Erreur : ${escHtml(String(err.message || err))}</span>`;
  } finally {
    input.disabled = false;
    document.getElementById('seo-ia-send').disabled = false;
    input.focus();
  }
}

function _renderSeoReply(question, reply, provider) {
  _seoLastQuestion = question;
  _seoLastReply    = reply;

  const output = document.getElementById('seo-ia-output');
  if (!output) return;
  output.style.fontStyle = 'normal';

  const isSimu    = provider === '⚡ Simulation';
  const color     = isSimu ? '#a78bfa' : 'var(--ok)';
  const hasClient = currentContact?.email;

  output.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <span style="font-size:.72rem;color:var(--mut);font-family:var(--ff-mono)">Vous :</span>
      <span style="font-size:.82rem;color:var(--mut-2)">${escHtml(question)}</span>
    </div>
    <div style="border-top:1px solid var(--line);padding-top:10px">
      <span style="font-size:.68rem;color:${color};font-family:var(--ff-mono)">🤖 ${escHtml(provider)} :</span>
      <div style="font-size:.83rem;color:var(--mut-2);line-height:1.65;margin-top:6px;white-space:pre-line">${escHtml(reply).replace(/\*\*(.*?)\*\*/g,'<strong style="color:#fff">$1</strong>')}</div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm"
        onclick="navigator.clipboard.writeText(_seoLastReply).then(()=>toast('Copié ✓'))">
        📋 Copier
      </button>
      ${hasClient
        ? `<button class="btn btn-ghost btn-sm" onclick="sendRapportSeo()">
            ✉️ Envoyer au client
           </button>`
        : `<span style="font-size:.74rem;color:var(--mut);align-self:center">
             (sélectionnez un client pour envoyer le rapport)
           </span>`}
    </div>`;
}

// ── Envoi du rapport SEO par email ────────────────────────────────────
function sendRapportSeo() {
  if (!currentContact) { toast('Aucun client sélectionné', 'warn'); return; }
  if (!currentContact.email) { toast('Ce client n\'a pas d\'email renseigné', 'warn'); return; }

  const clientNom = currentContact.entreprise
    || `${currentContact.prenom || ''} ${currentContact.nom || ''}`.trim()
    || 'Client';
  const objet = `Rapport SEO — ${_seoLastQuestion.substring(0, 70)}${_seoLastQuestion.length > 70 ? '…' : ''}`;

  openModal('Envoyer le rapport SEO au client', `
    <div class="field">
      <label>Destinataire</label>
      <div style="padding:9px 12px;background:rgba(255,255,255,.04);border:1px solid var(--line);
        border-radius:var(--r-sm);font-size:.85rem;color:var(--mut-2)">
        ${escHtml(clientNom)} — <span style="color:var(--mut)">${escHtml(currentContact.email)}</span>
      </div>
    </div>
    <div class="field">
      <label>Objet</label>
      <input id="seo-rap-objet" type="text" value="${escHtml(objet)}" placeholder="Rapport SEO — …">
    </div>
    <div class="field">
      <label>Contenu <span style="font-size:.74rem;color:var(--mut);font-weight:400">(modifiable avant envoi)</span></label>
      <textarea id="seo-rap-contenu" rows="10" style="resize:vertical;font-size:.8rem;line-height:1.55;font-family:var(--ff-mono)">${escHtml(_seoLastReply)}</textarea>
    </div>`,
  `<button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
   <button class="btn btn-pri" id="seo-rap-send-btn" onclick="_envoyerRapportSeo()">✉️ Envoyer</button>`);
}

async function _envoyerRapportSeo() {
  const objet   = document.getElementById('seo-rap-objet')?.value?.trim();
  const contenu = document.getElementById('seo-rap-contenu')?.value?.trim();
  if (!objet || !contenu) { toast('Complétez l\'objet et le contenu', 'warn'); return; }

  const btn = document.getElementById('seo-rap-send-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }

  try {
    const { error } = await (window.supa || supa).functions.invoke('send-crm-email', {
      body: {
        type:       'rapport_seo',
        contact_id: currentContact.id,
        objet,
        contenu,
      },
    });

    if (error) throw new Error(error.message || 'Erreur réseau');

    closeModal();
    const dest = currentContact.entreprise || currentContact.nom || currentContact.email;
    toast(`Rapport SEO envoyé à ${dest} ✓`);
  } catch (err) {
    toast('Erreur envoi : ' + (err.message || err), 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✉️ Envoyer'; }
  }
}
