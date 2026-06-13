-- =========================================================
-- S@FE CRM — Mise à jour v5 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v4), dans :
-- Supabase > SQL Editor > New query > Run
--
-- Ajoute :
--  - un type de tâche (Premier contact / RDV visio / RDV terrain / Autre)
--    avec date, heure et lieu pour les RDV
--  - une case "RGPD KO" sur les contacts (droit d'opposition) :
--    verrouille la fiche et efface les coordonnées
-- =========================================================

-- ---------------------------------------------------------
-- Tâches : type + informations de RDV
-- ---------------------------------------------------------
alter table tasks add column if not exists type_tache text;
alter table tasks add column if not exists rdv_date date;
alter table tasks add column if not exists rdv_heure time;
alter table tasks add column if not exists rdv_lieu text;

alter table tasks drop constraint if exists tasks_type_tache_check;
alter table tasks add constraint tasks_type_tache_check check (
  type_tache is null or type_tache in ('Premier contact','RDV visio','RDV terrain','Autre')
);

-- ---------------------------------------------------------
-- Contacts : RGPD KO (droit d'opposition)
-- ---------------------------------------------------------
alter table contacts add column if not exists rgpd_ko boolean not null default false;
