/* ============================================================
   DPO Clients — Désignation CNIL (lookup open data data.gouv.fr)
   Dataset : Organismes ayant désigné un(e) DPO
   Source  : https://data.gouv.fr/fr/datasets/organismes-ayant-designe-un-e-delegue-e-a-la-protection-des-donnees-dpd-dpo/
   Mise à jour : mensuelle par la CNIL
   ============================================================ */

const CNIL_RESOURCE_ID = 'c5d02b42-1008-4406-83f5-3a81c8b936a3';
const CNIL_API_BASE    = 'https://tabular-api.data.gouv.fr/api/resources/' + CNIL_RESOURCE_ID + '/data/';

async function loadCnil() {
  const el = document.getElementById('cnil-content');
  if (!el || !currentContact) return;

  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  // Extraire le SIREN (9 premiers chiffres du SIRET, sans espaces)
  const siret = (currentContact.siret || '').replace(/\s/g, '');
  const siren = siret.length >= 9 ? siret.slice(0, 9) : null;
  const nomEntreprise = (currentContact.entreprise || '').trim();

  let results = [];
  let searchMode = '';
  let searchValue = '';

  try {
    if (siren) {
      // Recherche prioritaire par SIREN
      searchMode  = 'siren';
      searchValue = siren;
      const url   = CNIL_API_BASE + '?page_size=10&' + encodeURIComponent('SIREN organisme désignant') + '__exact=' + encodeURIComponent(siren);
      const res   = await fetch(url);
      const json  = await res.json();
      results     = json.data || [];
    }

    // Fallback : recherche par nom d'entreprise si SIREN donne rien
    if (results.length === 0 && nomEntreprise) {
      searchMode  = 'nom';
      searchValue = nomEntreprise;
      const url   = CNIL_API_BASE + '?page_size=10&' + encodeURIComponent('Nom organisme désignant') + '__contains=' + encodeURIComponent(nomEntreprise.toUpperCase());
      const res   = await fetch(url);
      const json  = await res.json();
      results     = json.data || [];
    }
  } catch (e) {
    el.innerHTML = `
      <div class="card" style="border-color:rgba(255,77,94,.2)">
        <p style="color:var(--alert);font-size:.9rem">⚠️ Impossible de contacter l'API data.gouv.fr. Vérifiez votre connexion.</p>
      </div>`;
    return;
  }

  el.innerHTML = _renderCnilResult(results, searchMode, searchValue, siren, nomEntreprise);
}

function _renderCnilResult(results, searchMode, searchValue, siren, nomEntreprise) {
  const clientName = currentContact
    ? ([currentContact.nom, currentContact.prenom].filter(Boolean).join(' ') || currentContact.entreprise || '—')
    : '—';

  // En-tête info
  const searchInfo = searchMode === 'siren'
    ? `par SIREN <strong>${searchValue}</strong>`
    : searchMode === 'nom'
    ? `par nom d'entreprise <strong>${escHtml(searchValue)}</strong> (aucun SIRET renseigné)`
    : `<span style="color:var(--alert)">Aucun SIRET ni nom d'entreprise renseigné sur ce contact</span>`;

  const badge = results.length > 0
    ? `<span style="background:rgba(34,197,94,.12);color:var(--ok);border:1px solid rgba(34,197,94,.25);padding:3px 12px;border-radius:999px;font-size:.78rem;font-weight:700">✅ ${results.length} désignation(s) trouvée(s)</span>`
    : `<span style="background:rgba(255,77,94,.08);color:var(--alert);border:1px solid rgba(255,77,94,.2);padding:3px 12px;border-radius:999px;font-size:.78rem;font-weight:700">❌ Aucune désignation DPO trouvée</span>`;

  let html = `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div>
          <div style="font-size:.72rem;color:var(--mut);font-family:var(--ff-mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Recherche CNIL open data</div>
          <div style="font-size:.9rem;color:var(--tx)">Client : <strong>${escHtml(clientName)}</strong> — ${searchInfo}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${badge}
          <button class="btn btn-ghost btn-sm" onclick="loadCnil()">↺ Actualiser</button>
        </div>
      </div>
      <div style="font-size:.72rem;color:var(--mut);font-family:var(--ff-mono)">
        Source : CNIL via data.gouv.fr · Mise à jour mensuelle ·
        <a href="https://www.data.gouv.fr/datasets/organismes-ayant-designe-un-e-delegue-e-a-la-protection-des-donnees-dpd-dpo/"
           target="_blank" rel="noopener" style="color:var(--accent)">Voir le dataset</a>
      </div>
    </div>`;

  if (results.length === 0) {
    html += `
      <div class="card">
        <div style="text-align:center;padding:32px 20px">
          <div style="font-size:2.5rem;margin-bottom:12px">🏛️</div>
          <div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:8px">Aucune désignation DPO enregistrée</div>
          <div style="font-size:.85rem;color:var(--mut);max-width:480px;margin:0 auto 20px">
            Cet organisme n'apparaît pas dans le registre CNIL des DPO désignés.
            La désignation d'un DPO peut être obligatoire selon l'Art.37 du RGPD.
          </div>
          <a href="https://www.cnil.fr/fr/designation-dpo" target="_blank" rel="noopener" class="btn btn-pri" style="font-size:.82rem">
            🏛️ Désigner un DPO sur cnil.fr →
          </a>
        </div>
      </div>`;
    return html;
  }

  // Afficher les résultats
  html += '<div style="display:flex;flex-direction:column;gap:12px">';
  results.forEach(r => {
    const typeDpo   = r['Type de DPO'] || '—';
    const dateDesig = r['Date de la désignation'] ? new Date(r['Date de la désignation']).toLocaleDateString('fr-FR') : '—';
    const email     = r['Moyen contact DPO email'] || null;
    const tel       = r['Moyen contact DPO téléphone'] || null;
    const url       = r['Moyen contact DPO url'] || null;
    const adresse   = [
      r['Moyen contact DPO adresse postale'],
      r['Moyen contact DPO code postal'],
      r['Moyen contact DPO ville'],
    ].filter(Boolean).join(' ');

    // Organisme désigné (DPO externe)
    const orgDesigne = r['Nom organisme désigné'];
    const sirenDesig = r['SIREN organisme désigné'];

    html += `
      <div class="card" style="border-color:rgba(34,197,94,.2)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">
          <div>
            <div style="font-size:.68rem;color:var(--mut);font-family:var(--ff-mono);text-transform:uppercase;letter-spacing:.08em">Désignation enregistrée</div>
            <div style="font-size:1rem;font-weight:700;color:#fff;margin-top:2px">${escHtml(r['Nom organisme désignant'] || '—')}</div>
            <div style="font-size:.8rem;color:var(--mut);margin-top:2px">
              SIREN ${escHtml(r['SIREN organisme désignant'] || '—')} ·
              ${escHtml(r['Ville organisme désignant'] || '')}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <span style="background:rgba(34,197,94,.1);color:var(--ok);border:1px solid rgba(34,197,94,.2);padding:2px 10px;border-radius:999px;font-size:.72rem;font-weight:700">✅ DPO désigné</span>
            <div style="font-size:.72rem;color:var(--mut);font-family:var(--ff-mono);margin-top:6px">Depuis le ${escHtml(dateDesig)}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
          <div style="background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:var(--r-sm);padding:10px 14px">
            <div style="font-size:.65rem;color:var(--mut);font-family:var(--ff-mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Type de DPO</div>
            <div style="font-size:.88rem;color:#fff">${escHtml(typeDpo)}</div>
            ${orgDesigne ? `<div style="font-size:.78rem;color:var(--mut);margin-top:3px">${escHtml(orgDesigne)}${sirenDesig ? ' · SIREN ' + escHtml(sirenDesig) : ''}</div>` : ''}
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:var(--r-sm);padding:10px 14px">
            <div style="font-size:.65rem;color:var(--mut);font-family:var(--ff-mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Contact DPO</div>
            ${email ? `<div style="font-size:.82rem;margin-bottom:4px">📧 <a href="mailto:${escHtml(email)}" style="color:var(--accent)">${escHtml(email)}</a></div>` : ''}
            ${tel   ? `<div style="font-size:.82rem;margin-bottom:4px">📞 <a href="tel:${escHtml(tel)}" style="color:var(--accent)">${escHtml(tel)}</a></div>` : ''}
            ${url   ? `<div style="font-size:.82rem;margin-bottom:4px">🌐 <a href="${escHtml(url)}" target="_blank" rel="noopener" style="color:var(--accent)">Formulaire en ligne</a></div>` : ''}
            ${adresse ? `<div style="font-size:.78rem;color:var(--mut)">${escHtml(adresse)}</div>` : ''}
            ${!email && !tel && !url ? `<div style="font-size:.82rem;color:var(--mut)">Non communiqué</div>` : ''}
          </div>
        </div>

        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          ${email ? `<a href="mailto:${escHtml(email)}" class="btn btn-ghost btn-sm">📧 Contacter le DPO</a>` : ''}
          <a href="https://www.cnil.fr/fr/designation-dpo" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">🏛️ Modifier sur cnil.fr</a>
        </div>
      </div>`;
  });
  html += '</div>';

  // Note légale bas de page
  html += `
    <div style="margin-top:16px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.15);border-radius:var(--r-sm);padding:12px 16px;font-size:.78rem;color:var(--mut);line-height:1.6">
      <strong style="color:var(--tx)">ℹ️ Obligations Art.37 RGPD</strong> — La désignation d'un DPO est obligatoire pour les autorités publiques,
      les organismes traitant à grande échelle des données sensibles, et ceux dont l'activité principale consiste en un suivi régulier et systématique
      des personnes. · Pour modifier une désignation :
      <a href="https://www.cnil.fr/fr/designation-dpo" target="_blank" rel="noopener" style="color:var(--accent)">cnil.fr/fr/designation-dpo</a>
    </div>`;

  return html;
}
