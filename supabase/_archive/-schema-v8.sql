-- =========================================================
-- S@FE CRM — Mise à jour v8 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v7), dans :
-- Supabase > SQL Editor > New query > Run
--
-- Mentions légales obligatoires sur les bons de commande :
--   - SIRET du client (14 chiffres)
--   - Forme juridique (SARL, SAS, EI, etc.)
--   - Code postal et ville (adresse de facturation)
--
-- Ces champs viennent compléter `adresse` déjà présent.
-- Ils sont facultatifs en saisie, mais nécessaires pour
-- générer un bon de commande complet.
-- =========================================================

alter table contacts
  add column if not exists siret              text,
  add column if not exists forme_juridique    text,
  add column if not exists code_postal_ville  text;
