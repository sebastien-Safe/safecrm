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
  if (!el) return;
  if (!currentContact) {
    el.innerHTML = '<p style="color:var(--mut);padding:20px">Sélectionnez un client pour vérifier sa désignation CNIL.</p>';
    return;
  }

  el.innerHTML = '<div class="loader"><div class="spinner"></div> Interrogation de data.gouv.fr…</div>';

  // Recharger le contact pour avoir le SIRET à jour (peut avoir été saisi après l'ouverture du module)
  const { data: fresh } = await supa.from('contacts')
    .select('id,nom,prenom,entreprise,siret')
    .eq('id', currentContact.id)
    .maybeSingle();
  if (fresh) {
    Object.assign(currentContact, fresh);
    const idx = allContacts.findIndex(c => c.id === currentContact.id);
    if (idx >= 0) allContacts[idx] = { ...allContacts[idx], ...fresh };
  }

  // Extraire le SIREN (ne garder que les chiffres pour tolérer tout format)
  const siret = (currentContact.siret || '').replace(/\D/g, '');
  const siren = siret.length >= 9 ? siret.slice(0, 9) : null;
  const nomEntreprise = (currentContact.entreprise || '').trim();

  // Si ni SIRET ni entreprise : afficher directement le message
  if (!siren && !nomEntreprise) {
    el.innerHTML = _renderCnilResult([], '', '', null, '');
    return;
  }

  let results = [];
  let searchMode = '';
  let searchValue = '';

  try {
    if (siren) {
      searchMode  = 'siren';
      searchValue = siren;
      const url   = CNIL_API_BASE + '?' + encodeURIComponent('SIREN organisme désignant') + '__exact=' + encodeURIComponent(siren) + '&page_size=10';
      const res   = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json  = await res.json();
      results     = json.data || [];
    }

    // Fallback par nom si SIREN ne donne rien
    if (results.length === 0 && nomEntreprise) {
      searchMode  = 'nom';
      searchValue = nomEntreprise;
      const url   = CNIL_API_BASE + '?' + encodeURIComponent('Nom organisme désignant') + '__contains=' + encodeURIComponent(nomEntreprise.toUpperCase()) + '&page_size=10';
      const res   = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json  = await res.json();
      results     = json.data || [];
    }
  } catch (e) {
    console.error('[CNIL lookup]', e);
    el.innerHTML = `
      <div class="card" style="border-color:rgba(255,77,94,.2)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:1.5rem">⚠️</span>
          <strong style="color:#fff">Impossible de contacter l'API data.gouv.fr</strong>
        </div>
        <p style="color:var(--mut);font-size:.85rem;margin-bottom:12px">Erreur : ${escHtml(e.message || String(e))}</p>
        <p style="color:var(--mut);font-size:.82rem">Vérifiez votre connexion internet ou réessayez dans quelques instants.</p>
        <div style="margin-top:14px">
          <button class="btn btn-ghost btn-sm" onclick="loadCnil()">↺ Réessayer</button>
          <a href="https://www.cnil.fr/fr/designation-dpo" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="margin-left:6px">🏛️ Vérifier sur cnil.fr</a>
        </div>
      </div>`;
    return;
  }

  el.innerHTML = _renderCnilResult(results, searchMode, searchValue, siren, nomEntreprise);
}

function _renderCnilResult(results, searchMode, searchValue, siren, nomEntreprise) {
  const clientName = currentContact
    ? ([currentContact.nom, currentContact.prenom].filter(Boolean).join(' ') || currentContact.entreprise || '—')
    : '—';

  const searchInfo = searchMode === 'siren'
    ? `par SIREN <strong style="color:#fff">${escHtml(searchValue)}</strong>`
    : searchMode === 'nom'
    ? `par nom <strong style="color:#fff">${escHtml(searchValue)}</strong> <span style="color:var(--mut)">(pas de SIRET sur ce contact)</span>`
    : `<span style="color:var(--alert)">⚠️ Aucun SIRET ni raison sociale renseigné — renseignez-les dans la fiche contact du CRM</span>`;

  const badge = results.length > 0
    ? `<span style="background:rgba(34,197,94,.12);color:var(--ok);border:1px solid rgba(34,197,94,.25);padding:3px 12px;border-radius:999px;font-size:.78rem;font-weight:700">✅ ${results.length} désignation(s) trouvée(s)</span>`
    : searchMode
      ? `<span style="background:rgba(255,77,94,.08);color:var(--alert);border:1px solid rgba(255,77,94,.2);padding:3px 12px;border-radius:999px;font-size:.78rem;font-weight:700">❌ Aucune désignation DPO trouvée</span>`
      : '';

  let html = `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px">
        <div>
          <div style="font-size:.68rem;color:var(--mut);font-family:var(--ff-mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Recherche CNIL open data</div>
          <div style="font-size:.88rem;color:var(--mut-2)">Client : <strong style="color:#fff">${escHtml(clientName)}</strong></div>
          <div style="font-size:.82rem;color:var(--mut);margin-top:3px">Recherche ${searchInfo}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0">
          ${badge}
          <button class="btn btn-ghost btn-sm" onclick="loadCnil()">↺ Actualiser</button>
        </div>
      </div>
      <div style="font-size:.7rem;color:var(--mut);font-family:var(--ff-mono)">
        Source : CNIL via
        <a href="https://www.data.gouv.fr/datasets/organismes-ayant-designe-un-e-delegue-e-a-la-protection-des-donnees-dpd-dpo/"
           target="_blank" rel="noopener" style="color:var(--accent)">data.gouv.fr</a>
        · Mise à jour mensuelle
      </div>
    </div>`;

  if (!searchMode) {
    // Pas de SIRET ni entreprise : afficher un guide
    html += `
      <div class="card" style="border-color:rgba(245,158,11,.2);text-align:center;padding:32px 20px">
        <div style="font-size:2rem;margin-bottom:10px">📋</div>
        <div style="font-size:.95rem;font-weight:700;color:#fff;margin-bottom:8px">Informations manquantes sur ce contact</div>
        <div style="font-size:.83rem;color:var(--mut);max-width:440px;margin:0 auto">
          Pour interroger le registre CNIL, renseignez le <strong style="color:#fff">SIRET</strong>
          ou la <strong style="color:#fff">raison sociale</strong> du client dans sa fiche contact du CRM.
        </div>
      </div>`;
    return html;
  }

  if (results.length === 0) {
    html += `
      <div class="card" style="text-align:center;padding:32px 20px">
        <div style="font-size:2.5rem;margin-bottom:12px">🏛️</div>
        <div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:8px">Aucune désignation DPO enregistrée auprès de la CNIL</div>
        <div style="font-size:.83rem;color:var(--mut);max-width:480px;margin:0 auto 20px">
          Cet organisme n'apparaît pas dans le registre CNIL. La désignation peut être obligatoire
          selon l'Art.37 RGPD (autorités publiques, traitements à grande échelle, données sensibles).
        </div>
        <a href="https://www.cnil.fr/fr/designation-dpo" target="_blank" rel="noopener" class="btn btn-pri" style="font-size:.82rem">
          🏛️ Désigner un DPO sur cnil.fr →
        </a>
      </div>`;
    return html;
  }

  html += '<div style="display:flex;flex-direction:column;gap:12px">';
  results.forEach(r => {
    const typeDpo   = r['Type de DPO'] || '—';
    const dateDesig = r['Date de la désignation']
      ? new Date(r['Date de la désignation']).toLocaleDateString('fr-FR') : '—';
    const email     = r['Moyen contact DPO email'] || null;
    const tel       = r['Moyen contact DPO téléphone'] || null;
    const urlDpo    = r['Moyen contact DPO url'] || null;
    const adresse   = [
      r['Moyen contact DPO adresse postale'],
      r['Moyen contact DPO code postal'],
      r['Moyen contact DPO ville'],
    ].filter(Boolean).join(' ');
    const orgDesigne = r['Nom organisme désigné'];
    const sirenDesig = r['SIREN organisme désigné'];

    html += `
      <div class="card" style="border-color:rgba(34,197,94,.2)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">
          <div>
            <div style="font-size:.65rem;color:var(--mut);font-family:var(--ff-mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Organisme désignant</div>
            <div style="font-size:1rem;font-weight:700;color:#fff">${escHtml(r['Nom organisme désignant'] || '—')}</div>
            <div style="font-size:.78rem;color:var(--mut);margin-top:2px">
              SIREN ${escHtml(r['SIREN organisme désignant'] || '—')}
              ${r['Ville organisme désignant'] ? ' · ' + escHtml(r['Ville organisme désignant']) : ''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <span style="background:rgba(34,197,94,.1);color:var(--ok);border:1px solid rgba(34,197,94,.2);padding:2px 10px;border-radius:999px;font-size:.72rem;font-weight:700">✅ DPO désigné</span>
            <div style="font-size:.7rem;color:var(--mut);font-family:var(--ff-mono);margin-top:6px">Depuis le ${escHtml(dateDesig)}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:12px">
          <div style="background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:8px;padding:10px 14px">
            <div style="font-size:.62rem;color:var(--mut);font-family:var(--ff-mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Type de DPO</div>
            <div style="font-size:.85rem;color:#fff">${escHtml(typeDpo)}</div>
            ${orgDesigne ? `<div style="font-size:.76rem;color:var(--mut);margin-top:3px">${escHtml(orgDesigne)}${sirenDesig ? ' · SIREN ' + escHtml(sirenDesig) : ''}</div>` : ''}
          </div>
          <div style="background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:8px;padding:10px 14px">
            <div style="font-size:.62rem;color:var(--mut);font-family:var(--ff-mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Contact DPO</div>
            ${email ? `<div style="font-size:.82rem;margin-bottom:3px">📧 <a href="mailto:${escHtml(email)}" style="color:var(--accent)">${escHtml(email)}</a></div>` : ''}
            ${tel   ? `<div style="font-size:.82rem;margin-bottom:3px">📞 <a href="tel:${escHtml(tel)}" style="color:var(--accent)">${escHtml(tel)}</a></div>` : ''}
            ${urlDpo ? `<div style="font-size:.82rem;margin-bottom:3px">🌐 <a href="${escHtml(urlDpo)}" target="_blank" rel="noopener" style="color:var(--accent)">Formulaire contact</a></div>` : ''}
            ${adresse ? `<div style="font-size:.76rem;color:var(--mut);margin-top:3px">${escHtml(adresse)}</div>` : ''}
            ${!email && !tel && !urlDpo ? `<div style="font-size:.82rem;color:var(--mut)">Non communiqué</div>` : ''}
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${email ? `<a href="mailto:${escHtml(email)}" class="btn btn-ghost btn-sm">📧 Contacter le DPO</a>` : ''}
          <a href="https://www.cnil.fr/fr/designation-dpo" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">🏛️ Modifier sur cnil.fr</a>
        </div>
      </div>`;
  });
  html += '</div>';

  html += `
    <div style="margin-top:16px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.15);border-radius:8px;padding:12px 16px;font-size:.78rem;color:var(--mut);line-height:1.6">
      <strong style="color:#fff">ℹ️ Art.37 RGPD</strong> — La désignation DPO est obligatoire pour les autorités publiques,
      les organismes traitant à grande échelle des données sensibles (santé, biométrie…) ou effectuant
      un suivi systématique des personnes.
      <a href="https://www.cnil.fr/fr/designation-dpo" target="_blank" rel="noopener" style="color:var(--accent);margin-left:4px">En savoir plus →</a>
    </div>`;

  return html;
}
