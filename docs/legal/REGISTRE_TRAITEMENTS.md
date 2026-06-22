# REGISTRE DES TRAITEMENTS
## S@FE CRM — Conformité RGPD Art. 30

**Entreprise:** S@FE SASU
**SIRET:** 104 699 558 00011
**DPO:** Sébastien Alonso (dpo@safe-digitalisation.fr)
**Dernière mise à jour:** 2026-06-22
**Certification cible:** Art. 42 RGPD / CNIL

---

## T1 : GESTION CONTACTS ET CONTRATS COMMERCIAUX

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Gestion CRM clients et prospects |
| **Finalité légale** | Exécution contrats commerciaux, devis, assurance |
| **Base légale** | Art. 6(1)b RGPD (exécution contrat) + Art. 6(1)c (obligation légale comptabilité/assurance) |
| **Données personnelles** | Email, téléphone, nom, prénom, entreprise, fonction, adresse, SIRET, historique actions |
| **Catégories rétention** | Prospects : 3 ans / Clients actifs : 5 ans post-contrat |
| **Destinataires** | Brokers internes, DPO, auditeurs externes |
| **Sous-traitants** | Supabase (hébergement), Stripe (paiements), Brevo (emails) |
| **Transferts tiers** | Aucun (données restent EU) |
| **Droits concernés** | DSAR (Art. 15), rectification (Art. 16), suppression (Art. 17), portabilité (Art. 20) |
| **Sécurité** | RLS Supabase, TLS 1.2+, authentification OTP |
| **Chiffrement** | TLS transit, repos via Supabase (AES-256) |

---

## T2 : SIGNATURES ÉLECTRONIQUES ET AUDIT

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Signatures numériques et preuve contractuelle |
| **Finalité légale** | Preuve contractuelle, conformité réglementaire assurance |
| **Base légale** | Art. 6(1)b (contrat) + Art. 6(1)c (obligation légale assurance/RGPD) |
| **Données personnelles** | OTP (24h), SHA-256 hash, timestamp, IP signataire |
| **Catégories rétention** | 10 ans (obligation légale assurance) — OTP : 24h max |
| **Destinataires** | Clients, avocats, auditeurs, organismes assurance |
| **Sous-traitants** | Supabase (stockage signatures hachées) |
| **Transferts tiers** | Aucun |
| **Droits concernés** | Accès restreint (preuve légale) |
| **Sécurité** | OTP HTTPS, SHA-256 hachage, anti-brute-force 5 essais/1h |
| **Notes** | Non supprimable légalement (preuve) |

---

## T3 : FACTURATION ET PAIEMENTS

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Gestion financière et comptable |
| **Finalité légale** | Gestion comptable, conformité TVA/URSSAF |
| **Base légale** | Art. 6(1)c RGPD (obligation légale) |
| **Données personnelles** | Email client, montant, date, status paiement, order_token (masqué) |
| **Catégories rétention** | 6 ans (obligation comptabilité française, art. L123-22 code commerce) |
| **Destinataires** | Comptable, auditeur, Stripe (sous-traitant) |
| **Sous-traitants** | Stripe (paiements, PCI-DSS compliant) |
| **Transferts tiers** | USA (Stripe) → Data Privacy Framework |
| **Droits concernés** | Accès, rectification (montants) |
| **Sécurité** | PCI-DSS via Stripe (card data jamais stocké) |
| **Notes** | S@FE ne stocke PAS les numéros de carte (délégué Stripe) |

---

## T4 : LOGS D'AUDIT ET SÉCURITÉ INFORMATIQUE

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Audit trails et détection incidents |
| **Finalité légale** | Sécurité informatique, détection violations |
| **Base légale** | Art. 6(1)f RGPD (intérêt légitime sécurité) |
| **Données personnelles** | UserID, action, timestamp, résultat (succès/erreur), IP (hachée) |
| **Catégories rétention** | 90 jours hot logs / 2 ans cold storage |
| **Destinataires** | DPO, admin_global uniquement |
| **Sous-traitants** | Supabase (stockage logs) |
| **Transferts tiers** | Aucun |
| **Droits concernés** | Accès restreint (DPO/admin) |
| **Sécurité** | AES-256 (logs sensibles = RLS violations), RLS enforced |
| **Notes** | Pas supprimable (obligation sécurité) |

---

## T5 : APPELS API IA (call-ia)

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Support IA clients (résumés, recommendations) |
| **Finalité légale** | Service IA aux clients |
| **Base légale** | Art. 6(1)b RGPD (contrat de service) |
| **Données personnelles** | Contexte client partiellement, requête utilisateur, réponse IA |
| **Catégories rétention** | 6 mois logs / puis anonymisation |
| **Destinataires** | Grok (xAI, USA), Claude (Anthropic, USA), Mistral (EU) |
| **Sous-traitants** | Anthropic, xAI (processeurs) |
| **Transferts tiers** | USA → SCC + Supplementary Measures |
| **Droits concernés** | Accès (14j), suppression logs après 6m |
| **Sécurité** | Pseudonymisation avant transfert (regex masking) |
| **Notes** | Pas de prompts/réponses brutes transférés (hash seulement) |

---

## SIGNATURE ET APPROBATION

**Date :** 2026-06-22
**Signataire (DPO) :** ___________________________
**Signataire (Responsable légal) :** ___________________________

Ce registre doit être révisé annuellement ou en cas de modification des traitements.
