-- ============================================================================
-- Suppression du module Formation DDA
--   - Le module (frontend modules/Formation/, edge function
--     send-dda-alert-email) a été retiré du produit. Cette migration
--     supprime les objets schéma associés : cron, fonctions, tables,
--     policies de stockage et secret Vault. Les anciennes migrations
--     dda_formation_* restent en place pour l'historique.
--   - NOTE : le bucket "formation-docs" et ses fichiers ne sont PAS
--     supprimés ici (le rôle de migration n'a pas les droits owner sur
--     storage.objects, et le trigger protect_objects_delete impose de
--     passer par la Storage API). Les policies sont retirées : le bucket
--     devient inaccessible à tous (aucune policy = accès refusé par RLS).
--     Suppression finale à faire manuellement via Storage API/Dashboard.
--   - Irréversible : toute donnée de progression/obligations DDA existante
--     est perdue.
-- ============================================================================

-- 1. Cron
select cron.unschedule(jobid) from cron.job where jobname = 'dda-check-echeances';

-- 2. Notifications résiduelles générées par le cron d'échéance
delete from notifications where type = 'dda_alert';

-- 3. Policies de stockage (bucket laissé en place, cf. note ci-dessus)
drop policy if exists "formation_docs_formateur_all" on storage.objects;
drop policy if exists "formation_docs_collab_read_own" on storage.objects;
drop policy if exists "formation_docs_collab_upload_own" on storage.objects;

-- 4. Fonctions dépendant du cron / des tables
drop function if exists dda_check_echeances();
drop function if exists dda_heartbeat(uuid, text, int, int);
drop function if exists dda_close_session_if_complete(uuid);
drop function if exists dda_start_session(int);

-- 5. Tables (cascade : policies, triggers, index, FK associés)
drop table if exists dda_emargements cascade;
drop table if exists dda_progression_unites cascade;
drop table if exists dda_sessions cascade;
drop table if exists dda_obligations cascade;
drop table if exists dda_perimetre cascade;
drop table if exists dda_programmes cascade;

-- 6. Fonctions restantes (recalc trigger + rôle formateur)
drop function if exists recalc_dda_obligation(uuid);
drop function if exists trg_recalc_dda_obligation() cascade;
drop function if exists is_formateur() cascade;

-- 7. Rôle formateur sur profiles
alter table profiles drop column if exists is_formateur;

-- 8. Secret Vault (créé manuellement hors migration, cf. 20260708113548)
delete from vault.secrets where name = 'dda_alert_secret';
