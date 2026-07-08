-- =========================================================
-- S@FE CRM — Mise à jour v4 (Schéma de base de données)
-- À exécuter APRÈS supabase-schema.sql, v2 et v3, dans :
-- Supabase > SQL Editor > New query > Run
--
-- Ajoute :
--  - "created_by" sur contacts et contrats (qui a enregistré la fiche)
--  - lecture des profils (prénom/photo) ouverte à tous les
--    utilisateurs connectés, pour afficher le nom de l'auteur
--    (l'écriture reste limitée à son propre profil)
--  - un taux de commission sur les objectifs
--  - remplacement des objectifs par 3 jauges :
--    Entrées en contact, CA généré, Commissions reversées
-- =========================================================

-- ---------------------------------------------------------
-- Auteur des fiches
-- ---------------------------------------------------------
alter table contacts  add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table contracts add column if not exists created_by uuid references auth.users(id) default auth.uid();

-- ---------------------------------------------------------
-- Profils : lecture ouverte à tous les utilisateurs connectés
-- (pour afficher "ajouté par"), écriture limitée à soi-même
-- ---------------------------------------------------------
drop policy if exists "users_manage_own_profile" on profiles;

create policy "profiles_select_all_authenticated" on profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_delete_own" on profiles
  for delete using (auth.uid() = id);

-- ---------------------------------------------------------
-- Objectifs : taux de commission + nouveaux types de métriques
-- ---------------------------------------------------------
alter table objectifs add column if not exists taux_commission numeric;

alter table objectifs drop constraint if exists objectifs_metric_type_check;
alter table objectifs add constraint objectifs_metric_type_check check (metric_type in
  ('contrats_type','nouveaux_clients','contrats_total','taches_terminees','ca_recurrent',
   'nouveaux_contacts','ca_genere','commissions'));

-- Remplace l'ensemble des objectifs par les 3 jauges demandées
delete from objectifs;

insert into objectifs (label, metric_type, contract_type_filter, objectif_base, jours_reference, scale_by_days, taux_commission, ordre) values
('Entrées en contact',    'nouveaux_contacts', null, 8,    20, true, null, 1),
('CA généré',             'ca_genere',         null, 2000, 20, true, null, 2),
('Commissions reversées', 'commissions',       null, 240,  20, true, 12,   3);
