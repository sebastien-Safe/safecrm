-- =========================================================
-- S@FE CRM — Mise à jour v3 (Schéma de base de données)
-- À exécuter APRÈS supabase-schema.sql et supabase-schema-v2.sql,
-- dans : Supabase > SQL Editor > New query > Run
--
-- Ajoute une colonne "remise" (€ HT déduits du tarif catalogue)
-- sur les contrats.
-- =========================================================

alter table contracts
  add column if not exists remise numeric not null default 0 check (remise >= 0);
