// ==========================================================================
// S@FE CRM — Gestion Stripe du module Contrats
// Résiliation d'abonnements et portail client
// Extrait de app.js
// ==========================================================================

// --------------------------------------------------------------------------
// Niveau 1/2 : soumettre une demande de résiliation (sans toucher à Stripe)
// --------------------------------------------------------------------------
async function demanderResiliation(contractId) {
  if (!confirm('Confirmer la demande de résiliation de cet abonnement ?\n\nUn administrateur devra valider cette demande avant tout traitement.')) return;

  const { error } = await sb.from('contracts').update({
    statut: 'Demande de résiliation',
    resiliation_demande_at: new Date().toISOString(),
  }).eq('id', contractId);

  if (error) { alert('Erreur : ' + error.message); return; }

  if (typeof logRgpd === 'function') await logRgpd('demande_resiliation_creee', 'Contrats', {
    entityType: 'contract',
    entityId:   contractId,
    donnees:    'Demande de résiliation',
    criticite:  'Attention',
    resultat:   'Succès',
    details:    { par: state.profile?.prenom || state.user?.email },
  });

  alert('✅ Demande transmise. Un administrateur va traiter votre demande de résiliation.');
  closeContractModal();
  await loadContracts();
  renderContracts();
}

// --------------------------------------------------------------------------
// Admin : valider une résiliation depuis le bandeau dashboard
// --------------------------------------------------------------------------
async function validerResiliation(contractId) {
  const contract = state.contracts.find(c => c.id === contractId);
  if (!contract) { alert('Contrat introuvable.'); return; }
  const contact = state.contacts.find(c => c.id === contract.contact_id);

  const clientNom  = contact?.nom || 'client';
  const refContrat = 'CT-' + contractId.slice(0, 8).toUpperCase();
  const produit    = [contract.type, contract.formule].filter(Boolean).join(' — ');

  // 1. Ouvrir le client mail (prise en compte)
  if (contact?.email) {
    const subject = encodeURIComponent('Confirmation de prise en compte de votre demande de résiliation');
    const body = encodeURIComponent(
      `Bonjour ${clientNom},\n\n` +
      `Nous vous confirmons avoir bien pris en compte votre demande de résiliation concernant votre contrat n°${refContrat}${produit ? ' (' + produit + ')' : ''}.\n\n` +
      `Conformément à nos conditions contractuelles, votre abonnement restera actif jusqu'à la fin de la période de facturation en cours. La résiliation prendra effet à cette échéance.\n\n` +
      `Nous vous remercions pour la confiance que vous nous avez accordée et restons à votre disposition pour toute question complémentaire.\n\n` +
      `Cordialement,\n` +
      `L'équipe S@FE\n` +
      `contact@safe-digitalisation.fr`
    );
    const a = document.createElement('a');
    a.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // 2. Appeler l'Edge Function cancel-subscription
  try {
    const { data: { session } } = await sb.auth.getSession();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/cancel-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ contract_id: contractId, cancelled_by: state.profile?.prenom || state.user?.email || 'Admin' }),
    });
    const result = await resp.json();
    if (!resp.ok) {
      await sb.from('contracts').update({ statut: 'Erreur résiliation' }).eq('id', contractId);
      alert('⚠️ Erreur Stripe : ' + (result.details || result.error || 'inconnue'));
    }
  } catch(e) {
    await sb.from('contracts').update({ statut: 'Erreur résiliation' }).eq('id', contractId);
    alert('⚠️ Erreur réseau : ' + e.message);
  }

  await loadContracts();
  renderContracts();
  if (typeof renderResiliationAlerts === 'function') renderResiliationAlerts();
}

// --------------------------------------------------------------------------
// Admin : rejeter une demande de résiliation
// --------------------------------------------------------------------------
async function rejeterResiliation(contractId) {
  if (!confirm('Rejeter cette demande et remettre le contrat en "Contrat en cours" ?')) return;

  const { error } = await sb.from('contracts').update({
    statut: 'Contrat en cours',
    resiliation_demande_at: null,
  }).eq('id', contractId);

  if (error) { alert('Erreur : ' + error.message); return; }

  if (typeof logRgpd === 'function') await logRgpd('demande_resiliation_rejetee', 'Contrats', {
    entityType: 'contract',
    entityId:   contractId,
    donnees:    'Demande de résiliation',
    criticite:  'Attention',
    resultat:   'Succès',
    details:    { par: state.profile?.prenom || state.user?.email },
  });

  await loadContracts();
  renderContracts();
  if (typeof renderResiliationAlerts === 'function') renderResiliationAlerts();
}

// --------------------------------------------------------------------------
// Admin : relancer la synchronisation Stripe pour un contrat en erreur
// --------------------------------------------------------------------------
async function resynchroResiliation(contractId) {
  if (!confirm('Relancer la synchronisation Stripe pour ce contrat ?')) return;

  try {
    const { data: { session } } = await sb.auth.getSession();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/cancel-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ contract_id: contractId, cancelled_by: state.profile?.prenom || state.user?.email || 'Admin', resync: true }),
    });
    const result = await resp.json();
    if (!resp.ok) {
      alert('⚠️ Erreur Stripe : ' + (result.details || result.error || 'inconnue'));
    } else {
      alert('✅ Synchronisation effectuée. Statut mis à jour.');
    }
  } catch(e) {
    alert('⚠️ Erreur réseau : ' + e.message);
  }

  await loadContracts();
  renderContracts();
  if (typeof renderResiliationAlerts === 'function') renderResiliationAlerts();
}

function openResilierModal(contractId) {
  document.getElementById('resilier-contract-id').value = contractId;
  document.getElementById('resilier-modal').classList.add('show');
}

function closeResilierModal() {
  document.getElementById('resilier-modal').classList.remove('show');
}

async function confirmResilierAbonnement() {
  const contractId = document.getElementById('resilier-contract-id').value;
  const btn = document.getElementById('resilier-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Résiliation en cours…';

  try {
    // 1. Sauvegarder d'abord les modifications du contrat si payload en attente
    if (window._pendingResilierPayload && window._pendingResilierContractId === contractId) {
      const { error: saveErr } = await sb.from('contracts').update(window._pendingResilierPayload).eq('id', contractId);
      if (saveErr) throw new Error(saveErr.message);
      window._pendingResilierPayload    = null;
      window._pendingResilierContractId = null;
    }

    const contract = state.contracts.find(c => c.id === contractId) || { id: contractId };
    // Recharger pour avoir les données à jour
    await loadContracts();
    const contractFresh = state.contracts.find(c => c.id === contractId);

    if (contractFresh?.stripe_subscription_id && !contractFresh?.resilié_at) {
      // Abonnement Stripe actif → appel Edge Function
      const { data: { session } } = await sb.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ contract_id: contractId, cancelled_by: state.profile?.prenom || state.user?.email || 'Admin' }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.details || result.error || 'Erreur inconnue');
      const msg = result.period_end
        ? `✅ Résiliation enregistrée. L'abonnement se terminera le ${formatDate(result.period_end)}.`
        : '✅ Résiliation enregistrée. Le client ne sera plus débité à la prochaine échéance.';
      alert(msg);
      _sendResiliationEmail(contractId, result.period_end || null);
    } else {
      // Pas d'abonnement Stripe → résiliation directe dans Supabase
      const { error } = await sb.from('contracts').update({
        statut: 'Terminé',
        resilié_at: new Date().toISOString(),
      }).eq('id', contractId);
      if (error) throw new Error(error.message);
      if (contract?.contact_id) {
        await sb.from('interactions').insert({
          contact_id: contractFresh.contact_id,
          created_by: state.user.id,
          type: 'Autre',
          date: new Date().toISOString().slice(0,10),
          objet: 'Résiliation contrat',
          contenu: 'Contrat résilié manuellement par l\'administrateur.',
          suite_a_donner: null,
        });
      }
      alert('✅ Contrat résilié.');
      _sendResiliationEmail(contractId, new Date().toISOString());
    }

    closeResilierModal();
    await loadContracts();
    await loadInteractions();
    renderContracts();
  } catch(e) {
    alert('Erreur : ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmer la résiliation';
  }
}

async function _sendResiliationEmail(contractId, dateFin) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    await fetch(`${SUPABASE_URL}/functions/v1/send-crm-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ type: 'resiliation', contract_id: contractId, date_fin: dateFin }),
    });
  } catch (e) { console.warn('Email résiliation non envoyé :', e); }
}

// ==========================================================================
// PORTAIL CLIENT STRIPE
// ==========================================================================

async function openCustomerPortal(contractId) {
  const btn = document.getElementById('contract-portal-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Génération du lien…'; }

  try {
    const { data: { session } } = await sb.auth.getSession();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ contract_id: contractId }),
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result.details || result.error || 'Erreur inconnue');

    // Copier le lien dans le presse-papier
    await navigator.clipboard.writeText(result.url);
    alert('✅ Lien copié dans le presse-papier !\n\nEnvoyez-le au client par email :\n' + result.url);
  } catch(e) {
    alert('Erreur : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Portail client'; }
  }
}
