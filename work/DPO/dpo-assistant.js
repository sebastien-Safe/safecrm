/* ============================================================
   DPO Clients — Assistant RGPD
   Interface préparée — aucun service IA connecté
   RÈGLE ABSOLUE : NE CONNECTER AUCUN SERVICE
   ============================================================ */

function loadAssistant() {
  const el = document.getElementById('assistant-content');
  if (!el) return;

  el.innerHTML = `
    <div class="card assistant-card" style="text-align:center;padding:40px 24px">
      <div style="font-size:2.5rem;margin-bottom:12px">🤖</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:6px">
        Assistant RGPD — S@FE Work
      </div>
      <div style="font-family:var(--ff-mono);font-size:.78rem;color:var(--mut);
        border:1px solid var(--line);border-radius:var(--r-sm);display:inline-block;
        padding:4px 14px;margin:8px 0 20px">
        Statut : <span style="color:var(--warn)">Non configuré</span>
      </div>
      <p style="font-size:.85rem;color:var(--mut-2);max-width:480px;margin:0 auto 28px">
        L'assistant RGPD vous aidera à rédiger des politiques de confidentialité,
        analyser des risques RGPD, préparer des réponses aux demandes de droits
        et générer des documents conformes.
      </p>

      <!-- Fonctionnalités préparées -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
        gap:10px;text-align:left;max-width:600px;margin:0 auto 28px">
        ${[
          ['📋', 'Aide à la rédaction', 'Politiques, mentions légales, registre'],
          ['🔍', 'Analyse de risques', 'Évaluation des traitements et lacunes'],
          ['📩', 'Réponses aux droits', 'Modèles de réponses aux demandes'],
          ['⚠️', 'Alertes de conformité', 'Détection proactive des non-conformités'],
        ].map(([ico, titre, desc]) => `
          <div style="background:rgba(255,255,255,.03);border:1px solid var(--line);
            border-radius:var(--r-sm);padding:14px 16px">
            <div style="font-size:1.1rem;margin-bottom:6px">${ico}</div>
            <div style="font-size:.82rem;font-weight:600;color:#fff;margin-bottom:3px">${titre}</div>
            <div style="font-size:.74rem;color:var(--mut)">${desc}</div>
          </div>`).join('')}
      </div>

      <!-- Message sécurité -->
      <div style="background:rgba(255,180,0,.06);border:1px solid rgba(255,180,0,.2);
        border-radius:var(--r-sm);padding:14px 18px;max-width:520px;margin:0 auto;text-align:left">
        <div style="font-size:.78rem;font-weight:700;color:var(--gold);margin-bottom:6px;
          font-family:var(--ff-mono)">RÈGLE DE SÉCURITÉ S@FE</div>
        <p style="font-size:.78rem;color:var(--mut-2);margin:0">
          Avant toute activation, le système affichera le service concerné, son utilité,
          son coût éventuel, ses limites, les données échangées — et demandera explicitement
          l'autorisation de l'administrateur.
        </p>
      </div>

      <button class="btn btn-ghost" style="margin-top:24px;cursor:not-allowed;opacity:.5" disabled>
        ⚙️ Configurer l'assistant (admin requis)
      </button>
    </div>

    <!-- Zone de conversation préparée (désactivée) -->
    <div class="card" style="margin-top:14px;opacity:.4;pointer-events:none">
      <div class="card-header">
        <span class="card-title">— Interface de conversation</span>
        <span class="badge badge-gray">Désactivé</span>
      </div>
      <div style="display:flex;gap:10px;padding:10px 0">
        <input class="form-input" placeholder="Posez une question RGPD…" disabled style="flex:1">
        <button class="btn btn-pri" disabled>Envoyer</button>
      </div>
      <div style="background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:var(--r-sm);
        padding:14px;min-height:80px;font-size:.82rem;color:var(--mut);font-style:italic">
        Les réponses de l'assistant apparaîtront ici…
      </div>
    </div>`;
}
