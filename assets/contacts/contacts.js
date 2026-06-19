// ==========================================================================
// S@FE CRM — Constantes et utilitaires du module Contacts
// Extrait de app.js
// ==========================================================================

const CONTACT_STATUT_BADGE = { 'Prospect': 'badge-blue', 'Client': 'badge-green', 'Inactif': 'badge-gray' };
const ACTIVITE_BADGE = { 'Digitalisation': 'badge-blue', 'RGPD': 'badge-gold', 'Assurance': 'badge-green', 'Autre': 'badge-gray' };

const CONTACT_FIELD_IDS = ['c-nom', 'c-entreprise', 'c-email', 'c-telephone', 'c-adresse', 'c-code-postal-ville', 'c-forme-juridique', 'c-siret', 'c-notes'];
const CONTACT_CONSENT_IDS = ['c-consent-telephone', 'c-consent-email', 'c-consent-courrier'];

function contactName(id) {
  const c = state.contacts.find(c => c.id === id);
  if (!c) return '—';
  return c.entreprise ? `${c.nom} (${c.entreprise})` : c.nom;
}
