// ==========================================================================
// S@FE CRM — Point d'entrée du module Contrats
// Réexpose les fonctions publiques sur window pour maintenir
// la compatibilité avec app.js et les handlers inline (onclick=...)
// ==========================================================================

// Utilitaires et constantes (contracts.js)
//   CONTRACT_STATUT_BADGE, CONTRACT_ICONS, getContractIcon,
//   FORMULE_PRESETS, FORMULE_CUSTOM, COMMISSION_FALLBACK, contractLabel
//   → déjà globaux (déclarés avec const/function au niveau du script)

// Formules et calculs (contracts-formulas.js)
window.populateFormuleSelect      = populateFormuleSelect;
window.onFormuleChange            = onFormuleChange;
window.updateNetDisplay           = updateNetDisplay;
window.autoCalcEcheance           = autoCalcEcheance;
window.onContractTypeChange       = onContractTypeChange;
window.updateContractTypeIcon     = updateContractTypeIcon;
window.toggleRemise               = toggleRemise;

// Service Supabase (contracts.service.js)
window.loadContracts              = loadContracts;
window.saveContract               = saveContract;
window.deleteContract             = deleteContract;

// Interface (contracts-ui.js)
window.getFilteredContracts       = getFilteredContracts;
window.renderContracts            = renderContracts;
window.populateContactSelects     = populateContactSelects;
window.populateContractSelects    = populateContractSelects;
window.openContractModal          = openContractModal;
window.closeContractModal         = closeContractModal;

// PDF et commande (contracts-pdf.js)
//   window.ContractPDF déjà exposé par contracts-pdf.js
window.sendOrderLink              = sendOrderLink;
window.generateContractPDF        = generateContractPDF;

// Stripe (contracts-stripe.js)
window.openResilierModal          = openResilierModal;
window.closeResilierModal         = closeResilierModal;
window.confirmResilierAbonnement  = confirmResilierAbonnement;
window.openCustomerPortal         = openCustomerPortal;

// Notifications (contracts-notifications.js)
window.loadNotifContracts         = loadNotifContracts;
window.marquerNotifLue            = marquerNotifLue;
window.marquerToutesLues          = marquerToutesLues;
