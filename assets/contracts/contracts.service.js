// ==========================================================================
// S@FE CRM — Service Contrats (accès Supabase)
// Extrait de app.js
// ==========================================================================

async function loadContracts() {
  const { data, error } = await sb.from('contracts').select('*, stripe_subscription_id, resilié_at').order('created_at', { ascending: false });
  if (error) return alert('Erreur chargement contrats : ' + error.message);
  state.contracts = data || [];
}

// Mapping statut contrat → colonne kanban (ordre croissant du funnel)
const _KANBAN_COL_ORDER = ['prospect','devis_envoye','signe','en_cours','livre','resilie'];
const _STATUT_TO_KANBAN = {
  'En attente de signature': 'devis_envoye',
  'Envoyé':                  'devis_envoye',
  'Contrat en cours':        'en_cours',
  'Terminé':                 'livre',
  'Résilié':                 'resilie',
  'Demande de résiliation':  'resilie',
};

async function _advanceKanban(contact_id, targetCol) {
  const contact = state.contacts.find(c => c.id === contact_id);
  if (!contact) return;
  const currentIdx = _KANBAN_COL_ORDER.indexOf(contact.kanban_col || 'prospect');
  const targetIdx  = _KANBAN_COL_ORDER.indexOf(targetCol);
  // Avancer uniquement (jamais reculer), sauf pour la résiliation qui est toujours prioritaire
  if (targetCol !== 'resilie' && targetIdx <= currentIdx) return;
  await sb.from('contacts').update({ kanban_col: targetCol }).eq('id', contact_id);
  contact.kanban_col = targetCol;
}

async function saveContract() {
  const id = $('#ct-id').value;
  const contact_id = $('#ct-contact').value;
  const type = getEffectiveContractType();
  if (!contact_id || !type) { alert('Le contact et le produit sont obligatoires.'); return; }
  if (!id) {
    const _ct = state.contacts?.find(c => c.id === contact_id);
    if (_ct?.a_completer) {
      alert('⚠️ Cette fiche est marquée "À compléter".\n\nFinalisez les informations du contact (nom complet, email, téléphone, consentements) avant de créer un contrat.');
      return;
    }
  }
  const montant = $('#ct-montant').value;
  const formuleSel = $('#ct-formule-select').value;
  const formule = formuleSel === FORMULE_CUSTOM
    ? ($('#ct-formule-custom').value.trim() || null)
    : formuleSel;
  const remise = $('#ct-remise-check').checked ? (Number($('#ct-remise').value) || 0) : 0;
  const fraisMep = $('#ct-frais-mise-en-place')?.value;
  const engagement = $('#ct-engagement-mois')?.value;
  const payload = {
    contact_id,
    type,
    formule,
    montant: montant === '' ? null : Number(montant),
    remise,
    recurrence: $('#ct-recurrence').value,
    date_debut: $('#ct-date-debut').value || null,
    date_echeance: $('#ct-date-echeance').value || null,
    statut: $('#ct-statut').value || 'En attente de signature',
    notes: $('#ct-notes').value.trim() || null,
  };
  // Colonnes ajoutées en v13 — on ne les envoie que si elles existent dans le HTML ET en base
  if (fraisMep !== undefined) payload.frais_mise_en_place = fraisMep === '' ? null : Number(fraisMep);
  if (engagement !== undefined) payload.engagement_mois = engagement === '' ? null : Number(engagement);
  // Si la case Résilier est cochée → afficher confirmation AVANT de sauvegarder
  if ($('#ct-resilier')?.checked && id) {
    window._pendingResilierContractId = id;
    window._pendingResilierPayload    = payload;
    document.getElementById('resilier-contract-id').value = id;
    document.getElementById('resilier-modal').classList.add('show');
    return;
  }

  let savedId = id;
  let error;
  if (id) {
    ({ error } = await sb.from('contracts').update(payload).eq('id', id));
  } else {
    let data;
    ({ data, error } = await sb.from('contracts').insert({ ...payload, created_by: state.user.id }).select('id').single());
    if (data) savedId = data.id;
  }
  if (error) {
    if (typeof logRgpd === 'function') await logRgpd(id ? 'contrat_modifie' : 'contrat_cree', 'Contrats', {
      entityType: 'contract', entityId: id || null,
      donnees: 'type prestation, montant, échéances, statut',
      criticite: 'Attention', resultat: 'Erreur',
      details: { erreur: error.message, type, contact_id },
    });
    return alert('Erreur : ' + error.message);
  }
  if (typeof logRgpd === 'function') await logRgpd(id ? 'contrat_modifie' : 'contrat_cree', 'Contrats', {
    entityType: 'contract', entityId: savedId || null,
    donnees: 'type prestation, formule, montant, récurrence, échéances',
    criticite: id ? 'Attention' : 'Info',
    details: { type, formule: payload.formule || null, montant: payload.montant, contact_id },
  });

  closeContractModal();
  await loadAll();

  // Auto-avancement kanban uniquement à la création (INSERT)
  // Pour un contrat existant (UPDATE), la carte pipeline ne bouge que via l'envoi explicite du devis
  if (!id) {
    const targetCol = _STATUT_TO_KANBAN[payload.statut];
    if (targetCol) await _advanceKanban(contact_id, targetCol);
  }

  // Recharger le pipeline si la vue est active
  if (typeof initPipeline === 'function' && document.getElementById('view-pipeline')?.classList.contains('active')) {
    await initPipeline();
  }

  // Toast avec accès direct "Envoyer au client"
  if (typeof showCrmToast === 'function' && savedId) {
    const canSend = !['Résilié','Terminé'].includes(payload.statut);
    showCrmToast(
      `<span>✅ Contrat enregistré</span>` +
      (canSend
        ? `<button onclick="openContractModal('${savedId}');this.closest('div[style]').remove()" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;white-space:nowrap;font-size:.82rem">📧 Envoyer au client</button>`
        : '')
    );
  }
}

async function deleteContract() {
  const id = $('#ct-id').value;
  if (!id) return;
  const contract = state.contracts.find(c => c.id === id);
  if (!confirm('Supprimer ce contrat ?')) return;
  const { error } = await sb.from('contracts').delete().eq('id', id);
  if (error) return alert('Erreur : ' + error.message);
  if (typeof logRgpd === 'function') await logRgpd('contrat_supprime', 'Contrats', {
    entityType: 'contract', entityId: id,
    donnees: 'toutes les données du contrat',
    criticite: 'Critique',
    details: { type: contract?.type || null, contact_id: contract?.contact_id || null, montant: contract?.montant || null },
  });
  closeContractModal();
  await loadAll();
}
