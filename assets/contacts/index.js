// ==========================================================================
// S@FE CRM — Point d'entrée du module Contacts
// Réexpose les fonctions publiques sur window pour maintenir
// la compatibilité avec app.js et les handlers inline (onclick=...)
// ==========================================================================

// Constantes (contacts.js)
//   CONTACT_STATUT_BADGE, ACTIVITE_BADGE, CONTACT_FIELD_IDS, CONTACT_CONSENT_IDS
//   contactName → déjà globaux (const/function au niveau du script)

// Service Supabase (contacts.service.js)
window.loadContacts             = loadContacts;
window.saveContact              = saveContact;
window.deleteContact            = deleteContact;

// Interface (contacts-ui.js)
window.getFilteredContacts      = getFilteredContacts;
window.renderContacts           = renderContacts;
window.setContactFieldsLocked   = setContactFieldsLocked;
window.canEditContact           = canEditContact;
window.openContactModal         = openContactModal;
window.closeContactModal        = closeContactModal;

// Interactions (contacts-interactions.js)
window.renderInteractions       = renderInteractions;
window.openInteractionModal     = openInteractionModal;
window.closeInteractionModal    = closeInteractionModal;
window.saveInteraction          = saveInteraction;
window.deleteInteraction        = deleteInteraction;
window.openAddInteraction       = openAddInteraction;

// Adresse, RGPD & bandeau profil (contacts-address.js)
window.autoCompleteAdresse         = autoCompleteAdresse;
window.initContactAddressListeners = initContactAddressListeners;
window.checkRgpdExpiry             = checkRgpdExpiry;
window.checkProfilComplet          = checkProfilComplet;

// Transfert (contacts-transfer.js)
window.openTransferModal        = openTransferModal;
window.confirmTransferContact   = confirmTransferContact;
