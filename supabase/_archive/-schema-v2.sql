-- =========================================================
-- S@FE CRM — Mise à jour v2 (Schéma de base de données)
-- À exécuter APRÈS supabase-schema.sql, dans :
-- Supabase > SQL Editor > New query > Run
--
-- Ajoute :
--  - le suivi de la date à laquelle un contact devient "Client"
--  - le suivi de la date de fin d'une tâche
--  - une table "profiles" (prénom, photo, jours travaillés/mois)
--  - une table "objectifs" (objectifs mensuels par activité)
--  - un espace de stockage pour les photos de profil
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Colonnes additionnelles
-- ---------------------------------------------------------
alter table contacts add column if not exists devenu_client_at timestamptz;
alter table tasks    add column if not exists termine_at timestamptz;

-- ---------------------------------------------------------
-- TABLE : profiles (1 ligne par utilisateur connecté)
-- ---------------------------------------------------------
create table if not exists profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  prenom               text,
  photo_url            text,
  jours_travailles     integer,
  jours_travailles_mois text  -- format 'YYYY-MM' : mois auquel s'applique jours_travailles
);

alter table profiles enable row level security;

create policy "users_manage_own_profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------
-- TABLE : objectifs (objectifs mensuels par activité)
-- ---------------------------------------------------------
create table if not exists objectifs (
  id                   uuid primary key default gen_random_uuid(),
  label                text not null,
  metric_type          text not null check (metric_type in
                         ('contrats_type','nouveaux_clients','contrats_total','taches_terminees','ca_recurrent')),
  contract_type_filter text,           -- utilisé seulement si metric_type = 'contrats_type'
  objectif_base        numeric not null default 0,  -- objectif pour un mois "plein"
  jours_reference      integer not null default 20, -- nb de jours travaillés correspondant à l'objectif_base
  scale_by_days        boolean not null default true, -- ajuster ou non au prorata des jours travaillés
  ordre                integer default 0
);

alter table objectifs enable row level security;

create policy "auth_full_access_objectifs" on objectifs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Objectifs par défaut (modifiables ensuite depuis le CRM)
insert into objectifs (label, metric_type, contract_type_filter, objectif_base, jours_reference, scale_by_days, ordre)
select * from (values
  ('Nouveaux clients signés',        'nouveaux_clients', null,                            2::numeric, 20, true,  1),
  ('Contrats signés (total)',        'contrats_total',   null,                            3::numeric, 20, true,  2),
  ('CA récurrent mensuel (€)',       'ca_recurrent',     null,                         2000::numeric, 20, false, 3),
  ('Tâches terminées',               'taches_terminees', null,                           15::numeric, 20, true,  4),
  ('Audit RGPD',                     'contrats_type',    'Audit RGPD',                    1::numeric, 20, true,  5),
  ('Mise en conformité RGPD',        'contrats_type',    'Mise en conformité RGPD',       1::numeric, 20, true,  6),
  ('DPO externalisé',                'contrats_type',    'DPO externalisé',               1::numeric, 20, true,  7),
  ('Référencement Local',            'contrats_type',    'Référencement Local',           2::numeric, 20, true,  8),
  ('Gestion Fiche Google Business',  'contrats_type',    'Gestion Fiche Google Business', 2::numeric, 20, true,  9),
  ('Courtage Assurance',             'contrats_type',    'Courtage Assurance',            1::numeric, 20, true, 10),
  ('Click & Collect',                'contrats_type',    'Click & Collect',               1::numeric, 20, true, 11)
) as v(label, metric_type, contract_type_filter, objectif_base, jours_reference, scale_by_days, ordre)
where not exists (select 1 from objectifs);

-- ---------------------------------------------------------
-- STOCKAGE : photos de profil
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_auth_insert" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "avatars_auth_update" on storage.objects
  for update using (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "avatars_auth_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.role() = 'authenticated');
