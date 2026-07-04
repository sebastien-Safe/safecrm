# REGISTRE DES TRAITEMENTS
## S@FE CRM — Conformité RGPD Art. 30

**Entreprise:** S@FE SASU
**SIRET:** 104 699 558 00011
**DPO:** Sébastien Alonso (dpo@safe-digitalisation.fr)
**Dernière mise à jour:** 2026-07-04
**Certification cible:** Art. 42 RGPD / CNIL

> Ce registre est la source unique de vérité pour les traitements de S@FE. Le tableau affiché dans la CRM (Administration → Registre RGPD → Registre des traitements) reprend exactement les mêmes 10 traitements, avec un sous-ensemble opérationnel des colonnes (finalité, base légale, catégories de données, destinataires, durée de conservation, mesures de sécurité) ; les colonnes légales complètes (sous-traitants, transferts tiers, droits concernés, chiffrement) ne sont détaillées que dans ce document.

---

## T1 : GESTION DES COMPTES UTILISATEURS DU CRM

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Gestion des comptes utilisateurs du CRM |
| **Finalité légale** | Authentification et usage du CRM par les commerciaux et administrateurs S@FE |
| **Base légale** | Art. 6(1)b RGPD (exécution du contrat de travail / mission) |
| **Données personnelles** | E-mail, prénom, nom, photo de profil, rôle, journaux de connexion |
| **Catégories rétention** | Durée du contrat/mission + 5 ans (obligations comptables) |
| **Destinataires** | Direction S@FE, DPO |
| **Sous-traitants** | Supabase (hébergement) |
| **Transferts tiers** | Aucun (données restent EU) |
| **Droits concernés** | Accès, rectification, suppression (à la fin du contrat) |
| **Sécurité** | RLS Postgres, TLS 1.2+, authentification MFA (TOTP) optionnelle |
| **Chiffrement** | TLS transit, repos via Supabase (AES-256) |

---

## T2 : GESTION DES CONTACTS ET PROSPECTS

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Gestion CRM des contacts, prospects et clients (tous canaux d'acquisition) |
| **Finalité légale** | Suivi commercial, mise en relation, exécution des contrats, qualification des prospects — y compris ceux collectés automatiquement via les formulaires des sites vitrines (cf. T10) |
| **Base légale** | Art. 6(1)b (exécution du contrat, clients) + Art. 6(1)f (intérêt légitime de prospection BtoB) + Art. 6(1)c (obligations comptables/assurance) |
| **Données personnelles** | Nom, prénom, entreprise, fonction, e-mail, téléphone, adresse, SIRET, notes commerciales, consentements, historique d'actions, canal d'acquisition, qualification |
| **Catégories rétention** | Prospects : 3 ans après dernier contact / Clients actifs : durée du contrat + 5 ans |
| **Destinataires** | Commerciaux S@FE habilités, DPO, auditeurs externes |
| **Sous-traitants** | Supabase (hébergement) |
| **Transferts tiers** | Aucun (données restent EU) |
| **Droits concernés** | DSAR (Art. 15), rectification (Art. 16), suppression (Art. 17), portabilité (Art. 20), opposition (RGPD KO → effacement immédiat des coordonnées) |
| **Sécurité** | RLS par rôle et par propriétaire, journalisation des accès (Journal RGPD) |
| **Chiffrement** | TLS transit, repos via Supabase (AES-256) |

---

## T3 : GESTION DES CONTRATS COMMERCIAUX

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Suivi de la relation contractuelle et facturation |
| **Finalité légale** | Suivi de la relation contractuelle et facturation |
| **Base légale** | Art. 6(1)b (exécution du contrat) |
| **Données personnelles** | Type de prestation, formule, montant, dates, statut, lien vers le contact |
| **Catégories rétention** | Durée du contrat + 10 ans (pièces comptables) |
| **Destinataires** | Commerciaux S@FE, direction, comptabilité |
| **Sous-traitants** | Supabase (hébergement) |
| **Transferts tiers** | Aucun |
| **Droits concernés** | Accès, rectification |
| **Sécurité** | RLS, sauvegardes chiffrées Supabase, historique des modifications |
| **Chiffrement** | TLS transit, repos via Supabase (AES-256) |

---

## T4 : SIGNATURES ÉLECTRONIQUES ET AUDIT

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

## T5 : FACTURATION ET PAIEMENTS

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

## T6 : LOGS D'AUDIT ET SÉCURITÉ INFORMATIQUE

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Audit trails et détection incidents |
| **Finalité légale** | Sécurité informatique, détection violations, traçabilité (Journal RGPD Art. 30) |
| **Base légale** | Art. 6(1)f RGPD (intérêt légitime sécurité) |
| **Données personnelles** | UserID (ou "Système" pour les actions automatisées), rôle, action, module, timestamp, résultat, IP (hachée) |
| **Catégories rétention** | 90 jours hot logs / 2 ans cold storage |
| **Destinataires** | DPO, admin_global uniquement |
| **Sous-traitants** | Supabase (stockage logs) |
| **Transferts tiers** | Aucun |
| **Droits concernés** | Accès restreint (DPO/admin) |
| **Sécurité** | AES-256 (logs sensibles), RLS enforced |
| **Notes** | Pas supprimable (obligation sécurité) |

---

## T7 : SUIVI DES OBJECTIFS COMMERCIAUX

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Pilotage individuel de la performance commerciale |
| **Finalité légale** | Pilotage individuel de la performance commerciale |
| **Base légale** | Art. 6(1)f (intérêt légitime de l'employeur) |
| **Données personnelles** | Identifiant utilisateur, métriques agrégées (nb contacts, CA généré, commissions) |
| **Catégories rétention** | 5 ans glissants |
| **Destinataires** | Commercial concerné (ses propres chiffres) et super-administrateur S@FE |
| **Sous-traitants** | Supabase |
| **Transferts tiers** | Aucun |
| **Droits concernés** | Accès (ses propres données) |
| **Sécurité** | RLS stricte (un utilisateur ne voit que ses propres chiffres ; seul l'admin voit l'ensemble) |
| **Chiffrement** | TLS transit, repos via Supabase (AES-256) |

---

## T8 : MESSAGERIE INTERNE

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Information ponctuelle des utilisateurs par la direction |
| **Finalité légale** | Information ponctuelle des utilisateurs par la direction |
| **Base légale** | Art. 6(1)f (intérêt légitime) |
| **Données personnelles** | Identifiant émetteur, identifiant destinataire, contenu du message |
| **Catégories rétention** | 1 an après lecture |
| **Destinataires** | Destinataire et émetteur uniquement |
| **Sous-traitants** | Supabase |
| **Transferts tiers** | Aucun |
| **Droits concernés** | Accès, suppression |
| **Sécurité** | RLS, accès journalisé |
| **Chiffrement** | TLS transit, repos via Supabase (AES-256) |

---

## T9 : APPELS API IA (call-ia)

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

## T10 : COLLECTE DE PROSPECTS VIA FORMULAIRES WEB

| Propriété | Valeur |
|---|---|
| **Nom du traitement** | Collecte de prospects via les formulaires de contact des sites vitrines |
| **Finalité légale** | Traiter les demandes entrantes de safe-assurances.fr et safe-digitalisation.fr et, sur consentement explicite, permettre un rappel téléphonique commercial |
| **Base légale** | Art. 6(1)b (mesures précontractuelles prises à la demande de la personne concernée) + Art. 6(1)a (consentement explicite pour le démarchage téléphonique, cf. loi n°2025-594 du 30/06/2025, applicable au 11/08/2026) |
| **Données personnelles** | Nom, e-mail, téléphone, message, consentement horodaté au démarchage téléphonique, marque d'origine (canal d'acquisition) |
| **Catégories rétention** | 3 ans après dernier contact (identique aux autres prospects, cf. T2) |
| **Destinataires** | Commerciaux S@FE habilités |
| **Sous-traitants** | Supabase (Edge Function `create-lead`, clé service_role — aucune écriture directe depuis le navigateur du visiteur) |
| **Transferts tiers** | Aucun (données restent EU) |
| **Droits concernés** | DSAR, rectification, suppression, retrait du consentement à tout moment |
| **Sécurité** | Edge Function dédiée avec liste blanche CORS par domaine, honeypot anti-spam, aucune clé exposée côté client |
| **Chiffrement** | TLS transit, repos via Supabase (AES-256) |

---

## SIGNATURE ET APPROBATION

**Date :** 2026-07-04
**Signataire (DPO) :** Sébastien Alonso
**Signataire (Responsable légal) :** Sébastien Alonso

Ce registre doit être révisé annuellement ou en cas de modification des traitements. Cette révision fusionne les deux versions précédemment divergentes du registre (document signé vs. écran in-app) en un seul jeu de 10 traitements et ajoute T10 suite à la mise en place de la collecte de prospects via les sites vitrines.
