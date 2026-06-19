// ==========================================================================
// S@FE CRM — Gestion Stripe du module Contrats
// Résiliation d'abonnements et portail client
// Extrait de app.js
// ==========================================================================

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
