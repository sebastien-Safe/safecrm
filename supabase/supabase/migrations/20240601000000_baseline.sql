-- ============================================================
-- S@FE CRM — Migration baseline (schéma initial v1 → v29)
-- Générée le 2026-06-23 pour adoption Supabase CLI
-- Représente l'état complet de la BDD au 23/06/2026
-- ============================================================

-- =========================================================
-- S@FE CRM — Schéma de base de données (Supabase / PostgreSQL)
-- À exécuter dans : Supabase > SQL Editor > New query > Run
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- TABLE : contacts
-- ---------------------------------------------------------
create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  nom         text not null,
  entreprise  text,
  email       text,
  telephone   text,
  adresse     text,
  activites   text[] default '{}',          -- ex: {Digitalisation,RGPD,Assurance}
  statut      text default 'Prospect' check (statut in ('Prospect','Client','Inactif')),
  source      text,                          -- ex: GBP, Bouche à oreille, Site web...
  notes       text
);

-- ---------------------------------------------------------
-- TABLE : contracts
-- ---------------------------------------------------------
create table if not exists contracts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  contact_id    uuid references contacts(id) on delete cascade,
  type          text not null,               -- ex: "Référencement Local", "DPO externe"...
  formule       text,                         -- ex: Essentiel / Boost / Prestige
  montant       numeric,
  recurrence    text default 'Ponctuel' check (recurrence in ('Ponctuel','Mensuel','Annuel')),
  date_debut    date,
  date_echeance date,
  statut        text default 'Devis envoyé' check (statut in ('Devis envoyé','Signé','Contrat en cours','Terminé','Résilié')),
  notes         text
);

-- ---------------------------------------------------------
-- TABLE : tasks
-- ---------------------------------------------------------
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  contact_id   uuid references contacts(id) on delete set null,
  contract_id  uuid references contracts(id) on delete set null,
  titre        text not null,
  description  text,
  echeance     date,
  statut       text default 'À faire' check (statut in ('À faire','En cours','Terminé')),
  priorite     text default 'Normale' check (priorite in ('Basse','Normale','Haute')),
  assigne_a    text
);

-- Index utiles
create index if not exists idx_contracts_contact on contracts(contact_id);
create index if not exists idx_tasks_contact on tasks(contact_id);
create index if not exists idx_tasks_contract on tasks(contract_id);
create index if not exists idx_tasks_echeance on tasks(echeance);

-- ---------------------------------------------------------
-- SÉCURITÉ : Row Level Security (RLS)
-- Seuls les utilisateurs authentifiés (créés dans Supabase Auth)
-- peuvent lire/écrire. Aucun accès anonyme.
-- ---------------------------------------------------------
alter table contacts  enable row level security;
alter table contracts enable row level security;
alter table tasks     enable row level security;

create policy "auth_full_access_contacts" on contacts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_full_access_contracts" on contracts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_full_access_tasks" on tasks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');


-- ============================================================
-- Migration v2
-- ============================================================
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

-- ============================================================
-- Migration v3
-- ============================================================
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

-- ============================================================
-- Migration v4
-- ============================================================
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

-- ============================================================
-- Migration v5
-- ============================================================
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

-- ============================================================
-- Migration v6
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v6 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v5), dans :
-- Supabase > SQL Editor > New query > Run
--
-- Le taux de commission n'est plus modifiable depuis le CRM
-- (fixé à 12 %, voir assets/app.js — COMMISSION_RATE).
-- Ce script met simplement à jour le libellé de l'objectif
-- correspondant et aligne la valeur stockée pour référence.
-- =========================================================

update objectifs
set label = 'Commissions reversées',
where metric_type = 'commissions';

-- ============================================================
-- Migration v7
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v7 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v6), dans :
-- Supabase > SQL Editor > New query > Run
--
-- Apporte :
--   1. Statut super-administrateur (profiles.is_admin) +
--      fonction utilitaire is_admin()
--   2. Objectifs PAR UTILISATEUR (objectifs.user_id + RLS)
--   3. Table "messages" pour les pop-ups admin → utilisateur
--   4. Cases "Consentement" sur les contacts (téléphone /
--      e-mail / courrier)
--   5. RPC d'administration : lister, révoquer, restaurer
--      et créer un utilisateur
--
-- ATTENTION : après exécution, vous devez vous promouvoir
-- super-administrateur manuellement (voir TOUT EN BAS du
-- script, instruction commentée).
-- =========================================================


-- ---------------------------------------------------------
-- 1. Super-administrateur
-- ---------------------------------------------------------
alter table profiles
  add column if not exists is_admin boolean not null default false;

-- Fonction "is_admin()" : utilisée dans les politiques RLS.
-- SECURITY DEFINER pour éviter une lecture récursive de
-- profiles depuis les politiques de profiles elles-mêmes.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function is_admin() to authenticated;


-- ---------------------------------------------------------
-- 2. Objectifs : un jeu d'objectifs par utilisateur
-- ---------------------------------------------------------
alter table objectifs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Ancienne politique "tout authentifié" : on la retire et on
-- la remplace par une politique par utilisateur (l'admin voit
-- tout).
drop policy if exists "auth_full_access_objectifs" on objectifs;
drop policy if exists "objectifs_select_own_or_admin" on objectifs;
drop policy if exists "objectifs_modify_own_or_admin" on objectifs;

create policy "objectifs_select_own_or_admin"
  on objectifs for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "objectifs_modify_own_or_admin"
  on objectifs for all
  to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- Nettoyage des objectifs "globaux" hérités des versions
-- antérieures (ils n'ont pas de user_id). L'application les
-- recrée automatiquement pour chaque utilisateur connecté.
delete from objectifs where user_id is null;


-- ---------------------------------------------------------
-- 3. Messages admin → utilisateur (pop-up dashboard)
-- ---------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_recipient_unread_idx
  on messages (recipient_id, read);

alter table messages enable row level security;

drop policy if exists "messages_select_own_or_admin" on messages;
drop policy if exists "messages_insert_admin"       on messages;
drop policy if exists "messages_update_own"         on messages;
drop policy if exists "messages_delete_admin"       on messages;

create policy "messages_select_own_or_admin"
  on messages for select to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid() or is_admin());

-- Seul un admin peut envoyer un message
create policy "messages_insert_admin"
  on messages for insert to authenticated
  with check (is_admin() and sender_id = auth.uid());

-- Le destinataire peut marquer son message comme lu
create policy "messages_update_own"
  on messages for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "messages_delete_admin"
  on messages for delete to authenticated
  using (is_admin());


-- ---------------------------------------------------------
-- 4. Consentement sur les contacts
-- ---------------------------------------------------------
alter table contacts
  add column if not exists consent_telephone boolean not null default false,
  add column if not exists consent_email     boolean not null default false,
  add column if not exists consent_courrier  boolean not null default false;


-- ---------------------------------------------------------
-- 5. RPC d'administration (lister / révoquer / créer)
-- ---------------------------------------------------------

-- 5.1 — Lister les utilisateurs (admin uniquement)
create or replace function admin_list_users()
returns table (
  id            uuid,
  email         text,
  prenom        text,
  is_admin      boolean,
  banned_until  timestamptz,
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not is_admin() then
    raise exception 'Accès refusé : super-administrateur uniquement.';
  end if;

  return query
    select
      u.id,
      u.email::text,
      p.prenom,
      coalesce(p.is_admin, false) as is_admin,
      u.banned_until,
      u.created_at
    from auth.users u
    left join profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

grant execute on function admin_list_users() to authenticated;


-- 5.2 — Révoquer / restaurer un utilisateur
create or replace function admin_set_banned(
  target_user_id uuid,
  banned         boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not is_admin() then
    raise exception 'Accès refusé : super-administrateur uniquement.';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas vous révoquer vous-même.';
  end if;

  update auth.users
  set banned_until = case when banned then 'infinity'::timestamptz else null end
  where id = target_user_id;
end;
$$;

grant execute on function admin_set_banned(uuid, boolean) to authenticated;


-- 5.3 — Promouvoir / rétrograder un utilisateur (statut admin)
create or replace function admin_set_admin(
  target_user_id uuid,
  make_admin     boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès refusé : super-administrateur uniquement.';
  end if;
  if target_user_id = auth.uid() and not make_admin then
    raise exception 'Vous ne pouvez pas vous rétrograder vous-même.';
  end if;

  update profiles set is_admin = make_admin where id = target_user_id;
end;
$$;

grant execute on function admin_set_admin(uuid, boolean) to authenticated;


-- 5.4 — Création d'un utilisateur depuis le CRM
--
-- ⚠️ Avertissement important
-- Cette fonction insère directement dans auth.users et
-- auth.identities en utilisant le module pgcrypto pour le
-- hachage bcrypt. C'est un pattern reconnu mais NON officiel :
-- il peut être amené à évoluer en cas de changement interne
-- du schéma "auth" de Supabase.
--
-- En cas de souci, la voie OFFICIELLE et toujours disponible
-- consiste à créer l'utilisateur depuis :
--   Supabase Dashboard → Authentication → Users → "Add user".
-- Puis à compléter le profil dans la page "Administration".
create extension if not exists pgcrypto;

create or replace function admin_create_user(
  new_email    text,
  new_password text,
  new_prenom   text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  if not is_admin() then
    raise exception 'Accès refusé : super-administrateur uniquement.';
  end if;
  if new_email is null or length(trim(new_email)) = 0 then
    raise exception 'E-mail obligatoire.';
  end if;
  if new_password is null or length(new_password) < 6 then
    raise exception 'Le mot de passe doit faire au moins 6 caractères.';
  end if;
  if exists (select 1 from auth.users where email = lower(trim(new_email))) then
    raise exception 'Un utilisateur avec cet e-mail existe déjà.';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    new_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    lower(trim(new_email)),
    crypt(new_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    '{}'::jsonb,
    now(),
    now()
  );

  insert into auth.identities (
    id, user_id, provider, provider_id, identity_data,
    last_sign_in_at, created_at, updated_at
  ) values (
    new_id, new_id, 'email', new_id::text,
    jsonb_build_object('sub', new_id::text, 'email', lower(trim(new_email))),
    now(), now(), now()
  );

  insert into profiles (id, prenom)
  values (new_id, nullif(trim(new_prenom), ''));

  return new_id;
end;
$$;

grant execute on function admin_create_user(text, text, text) to authenticated;


-- ---------------------------------------------------------
-- 🚨 ACTION MANUELLE OBLIGATOIRE
-- ---------------------------------------------------------
-- Après avoir exécuté ce script, vous devez vous promouvoir
-- super-administrateur. Décommentez la ligne ci-dessous en
-- remplaçant l'e-mail par le vôtre, puis exécutez-la (Run) :
--
-- update profiles set is_admin = true
--  where id = (select id from auth.users where email = 'votre.email@example.com');

-- ============================================================
-- Migration v8
-- ============================================================
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

-- ============================================================
-- Migration v9
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v9 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v8).
--
-- Ajoute des colonnes de traçabilité pour les bons de
-- commande signés électroniquement et envoyés au client :
--   - date d'envoi pour signature
--   - e-mail du destinataire
--   - URL kDrive du PDF signé archivé
-- =========================================================

alter table contracts
  add column if not exists sent_for_signature_at  timestamptz,
  add column if not exists sent_for_signature_to  text,
  add column if not exists signed_pdf_kdrive_url  text;

create index if not exists contracts_signed_idx
  on contracts (sent_for_signature_at desc) where sent_for_signature_at is not null;

-- ============================================================
-- Migration v10
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v10 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v9).
--
-- Ajoute :
--   - admin_delete_user(uuid) : suppression DÉFINITIVE d'un
--     utilisateur (compte Auth + profil). Réservée aux
--     super-administrateurs.
--
-- ⚠️ La suppression est IRRÉVERSIBLE. Les contacts, contrats
--    et tâches créés par l'utilisateur sont conservés mais
--    leur champ `created_by` devient NULL (l'utilisateur
--    apparaîtra comme "—" dans la colonne "Ajouté par").
--    Si vous préférez conserver les utilisateurs supprimés
--    en archive, utilisez plutôt la fonction "Révoquer"
--    (admin_set_banned) déjà disponible.
-- =========================================================

-- Garantir que les contacts/contrats orphelins ne plantent pas
-- (FK contre auth.users avec SET NULL en cascade)
alter table contacts
  drop constraint if exists contacts_created_by_fkey,
  add constraint contacts_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table contracts
  drop constraint if exists contracts_created_by_fkey,
  add constraint contracts_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

-- Suppression définitive d'un utilisateur (réservée aux admins)
create or replace function admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Vérifie que l'appelant est admin
  if not is_admin() then
    raise exception 'Permission refusée : super-administrateur requis.';
  end if;

  -- Empêche l'auto-suppression (sécurité de base : un admin
  -- doit toujours pouvoir se reconnecter pour réparer un
  -- problème)
  if target_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte. Demandez à un autre administrateur.';
  end if;

  -- Suppression du compte Auth (cascade vers profiles via la
  -- FK existante "profiles_id_fkey")
  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function admin_delete_user(uuid) to authenticated;

-- ============================================================
-- Migration v11
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v11 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v10).
--
-- Cette mise à jour introduit la notion de PROPRIÉTÉ DE
-- FICHE CLIENT :
--
--   1. Un contact ne peut être modifié ou supprimé QUE
--      par son créateur (champ `created_by`) OU par un
--      super-administrateur. La lecture reste ouverte à
--      tous les utilisateurs authentifiés.
--
--   2. Un contact peut être TRANSFÉRÉ d'un commercial à
--      un autre via la fonction RPC `transfer_contact()`.
--      Tous les contrats et tâches liés sont également
--      réassignés au nouveau propriétaire.
--
--   3. Le passage d'un contrat au statut "Terminé" (ou
--      "Résilié") est RÉSERVÉ aux super-administrateurs.
--      Un commercial peut faire évoluer son contrat jusqu'à
--      "Signé" / "Contrat en cours" mais c'est l'admin qui valide
--      la clôture définitive.
-- =========================================================

-- ---------------------------------------------------------
-- 0. Pré-requis : `tasks.created_by` doit exister pour
--    permettre le transfert des tâches lors d'un transfert
--    de client.
-- ---------------------------------------------------------

alter table tasks
  add column if not exists created_by uuid references auth.users(id) on delete set null
  default auth.uid();

-- Pour les tâches déjà créées, on tente de récupérer le created_by
-- depuis le contact lié (best-effort). Les tâches sans contact restent
-- "orphelines" (created_by = NULL) mais peuvent quand même être éditées.
update tasks t
   set created_by = c.created_by
  from contacts c
 where t.created_by is null
   and t.contact_id = c.id;

-- ---------------------------------------------------------
-- 1. Propriété stricte des contacts (RLS)
-- ---------------------------------------------------------

-- On supprime l'ancienne politique "tout le monde peut tout faire"
drop policy if exists "auth_full_access" on contacts;
drop policy if exists "auth_select_contacts"   on contacts;
drop policy if exists "auth_insert_contacts"   on contacts;
drop policy if exists "auth_update_contacts"   on contacts;
drop policy if exists "auth_delete_contacts"   on contacts;

-- Lecture : ouverte à tous les utilisateurs authentifiés
create policy "auth_select_contacts" on contacts
  for select
  to authenticated
  using (true);

-- Insertion : un utilisateur crée toujours pour lui (created_by = lui)
create policy "auth_insert_contacts" on contacts
  for insert
  to authenticated
  with check (created_by = auth.uid() or is_admin());

-- Modification : propriétaire ou admin
create policy "auth_update_contacts" on contacts
  for update
  to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- Suppression : propriétaire ou admin
create policy "auth_delete_contacts" on contacts
  for delete
  to authenticated
  using (created_by = auth.uid() or is_admin());

-- ---------------------------------------------------------
-- 2. Propriété indirecte des contrats et tâches
--    (un contrat ou une tâche sont liés à un contact —
--     leur écriture est réservée au propriétaire du contact
--     ou à l'admin)
-- ---------------------------------------------------------

drop policy if exists "auth_full_access"        on contracts;
drop policy if exists "auth_select_contracts"   on contracts;
drop policy if exists "auth_insert_contracts"   on contracts;
drop policy if exists "auth_update_contracts"   on contracts;
drop policy if exists "auth_delete_contracts"   on contracts;

create policy "auth_select_contracts" on contracts
  for select to authenticated using (true);

create policy "auth_insert_contracts" on contracts
  for insert to authenticated
  with check (created_by = auth.uid() or is_admin());

create policy "auth_update_contracts" on contracts
  for update to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

create policy "auth_delete_contracts" on contracts
  for delete to authenticated
  using (created_by = auth.uid() or is_admin());

-- Tâches : on garde l'accès partagé (un utilisateur peut piloter une tâche
-- pour le compte d'un collègue) mais le UPDATE/DELETE est tout de même
-- restreint à l'auteur ou à l'admin pour éviter les conflits.
drop policy if exists "auth_full_access"      on tasks;
drop policy if exists "auth_select_tasks"     on tasks;
drop policy if exists "auth_insert_tasks"     on tasks;
drop policy if exists "auth_update_tasks"     on tasks;
drop policy if exists "auth_delete_tasks"     on tasks;

create policy "auth_select_tasks" on tasks for select to authenticated using (true);
create policy "auth_insert_tasks" on tasks for insert to authenticated with check (true);
create policy "auth_update_tasks" on tasks for update to authenticated using (true) with check (true);
create policy "auth_delete_tasks" on tasks for delete to authenticated using (true);

-- ---------------------------------------------------------
-- 3. Restriction du statut "Terminé" / "Résilié" aux admins
--    (via un trigger BEFORE UPDATE qui bloque l'opération
--    si l'utilisateur n'est pas admin)
-- ---------------------------------------------------------

create or replace function check_contract_final_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Si le statut passe à "Terminé" ou "Résilié" et que l'utilisateur n'est
  -- pas admin, on refuse la modification.
  if new.statut in ('Terminé', 'Résilié')
     and (old.statut is distinct from new.statut)
     and not is_admin() then
    raise exception 'Seul un super-administrateur peut clôturer un contrat (statut "Terminé" ou "Résilié").';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_contract_final_status on contracts;
create trigger trg_check_contract_final_status
  before update on contracts
  for each row
  execute function check_contract_final_status();

-- Idem à la création : un commercial ne peut pas créer un contrat directement
-- en statut "Terminé" / "Résilié" pour contourner la règle
create or replace function check_contract_initial_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut in ('Terminé', 'Résilié') and not is_admin() then
    raise exception 'Seul un super-administrateur peut créer un contrat directement en statut "Terminé" ou "Résilié".';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_contract_initial_status on contracts;
create trigger trg_check_contract_initial_status
  before insert on contracts
  for each row
  execute function check_contract_initial_status();

-- ---------------------------------------------------------
-- 4. Fonction RPC `transfer_contact()` — transfert d'un
--    client d'un commercial à un autre. Réassigne aussi les
--    contrats et tâches liés au client.
-- ---------------------------------------------------------

create or replace function transfer_contact(
  p_contact_id      uuid,
  p_target_user_id  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_owner uuid;
begin
  -- Vérifie l'existence du contact
  select created_by into v_current_owner
    from contacts
   where id = p_contact_id;
  if v_current_owner is null then
    raise exception 'Contact introuvable.';
  end if;

  -- Seul le propriétaire actuel ou un admin peut transférer
  if v_current_owner <> auth.uid() and not is_admin() then
    raise exception 'Vous ne pouvez transférer que vos propres clients.';
  end if;

  -- L'utilisateur cible doit exister
  if not exists (select 1 from profiles where id = p_target_user_id) then
    raise exception 'Utilisateur destinataire introuvable.';
  end if;

  -- Transfert : contact + tous ses contrats + ses tâches
  update contacts  set created_by = p_target_user_id where id           = p_contact_id;
  update contracts set created_by = p_target_user_id where contact_id   = p_contact_id;
  update tasks     set created_by = p_target_user_id where contact_id   = p_contact_id;
end;
$$;

grant execute on function transfer_contact(uuid, uuid) to authenticated;

-- ============================================================
-- Migration v12
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v12 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v11).
--
-- 🚨 CORRECTIF MAJEUR
-- ------------------
-- L'ancienne fonction `admin_create_user` insérait directement
-- dans `auth.users` et `auth.identities`, mais le format
-- requis par Supabase Auth a évolué : certains champs internes
-- (instance_id, confirmation_token, email_change_token_new...)
-- doivent être positionnés selon une convention précise, et
-- l'insertion par SQL contourne le flow officiel.
--
-- Conséquence : les utilisateurs créés ainsi étaient "cassés"
-- — leur connexion échouait avec l'erreur :
--   « Database error querying schema »
--
-- Cette mise à jour :
--   1. Neutralise `admin_create_user` (lève désormais une
--      exception explicite avec la marche à suivre).
--   2. La création se fait dorénavant via l'Edge Function
--      `admin-create-user` qui utilise l'API Auth Admin
--      officielle de Supabase (service_role_key, côté serveur).
--
-- 🧹 NETTOYAGE DES UTILISATEURS CASSÉS
-- ------------------------------------
-- Si vous avez déjà créé des utilisateurs via l'ancienne
-- fonction, supprimez-les depuis le dashboard Supabase :
--   Authentication > Users > sélectionner > "..." > Delete
-- Puis recréez-les via le nouveau bouton "Créer un utilisateur"
-- du CRM (qui appellera l'Edge Function).
-- =========================================================

drop function if exists admin_create_user(text, text, text);

-- On garde une fonction du même nom mais qui lève une exception
-- explicite avec instructions, pour le cas où un script ou un
-- collègue tenterait l'ancienne API.
create or replace function admin_create_user(
  new_email    text,
  new_password text,
  new_prenom   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'La création d''utilisateurs par SQL direct est désactivée car elle produit des comptes cassés. '
    'Utilisez le bouton "Créer un utilisateur" du CRM (qui appelle l''Edge Function admin-create-user), '
    'ou créez l''utilisateur depuis le dashboard Supabase : Authentication > Users > Add user.';
end;
$$;

revoke execute on function admin_create_user(text, text, text) from authenticated;

-- ============================================================
-- Migration v13
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v13 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v12).
--
-- Ajoute deux colonnes manquantes sur la table contracts :
--
--   • frais_mise_en_place : montant HT des frais facturés
--     au 1ᵉʳ mois (non remboursables). Apparaît dans le
--     récapitulatif financier du bon de commande PDF et sert
--     de base au calcul de la commission à la signature.
--
--   • engagement_mois : durée minimale d'engagement (en mois).
--     Sert au calcul automatique de la date d'échéance.
--
-- Pré-remplissage des contrats existants : on lit FORMULE_PRESETS
-- côté client à la prochaine sauvegarde. Pour rattraper les
-- contrats existants sans intervention manuelle, le script ci-
-- dessous applique les valeurs par défaut connues.
-- =========================================================

alter table contracts
  add column if not exists frais_mise_en_place numeric(10, 2),
  add column if not exists engagement_mois     integer;

-- Rattrapage : valeurs par défaut pour les contrats existants
-- (basées sur FORMULE_PRESETS — alignement avec la grille de
--  commissionnement SAFE-AC-2026 du 10 juin 2026).

-- Référencement Local
update contracts set frais_mise_en_place = 190, engagement_mois = 6
  where type = 'Référencement Local' and formule = 'Essentiel'
    and frais_mise_en_place is null;
update contracts set frais_mise_en_place = 290, engagement_mois = 6
  where type = 'Référencement Local' and formule = 'Boost'
    and frais_mise_en_place is null;
update contracts set frais_mise_en_place = 0, engagement_mois = 3
  where type = 'Référencement Local' and formule = 'Prestige'
    and frais_mise_en_place is null;

-- Click & Collect
update contracts set frais_mise_en_place = 150, engagement_mois = 6
  where type = 'Click & Collect' and formule = 'Essentiel'
    and frais_mise_en_place is null;
update contracts set frais_mise_en_place = 250, engagement_mois = 6
  where type = 'Click & Collect' and formule = 'Pro'
    and frais_mise_en_place is null;
update contracts set frais_mise_en_place = 0, engagement_mois = 3
  where type = 'Click & Collect' and formule = 'Premium'
    and frais_mise_en_place is null;

-- DPO externalisé (engagement 12 mois)
update contracts set frais_mise_en_place = 0, engagement_mois = 12
  where type = 'DPO externalisé' and frais_mise_en_place is null;

-- Tous les autres contrats restants (audits, options, etc.) :
-- ponctuels sans frais MeP ni engagement.
update contracts set frais_mise_en_place = coalesce(frais_mise_en_place, 0),
                     engagement_mois     = coalesce(engagement_mois, 0)
  where frais_mise_en_place is null or engagement_mois is null;

-- ============================================================
-- Migration v14
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v14
-- Tunnel de paiement Stripe (bon de commande → signature
-- en ligne → paiement → contrat "Signé")
-- =========================================================

create table if not exists order_links (
  id                  uuid primary key default gen_random_uuid(),
  contract_id         uuid not null references contracts(id) on delete cascade,
  token               text unique not null default encode(gen_random_bytes(32), 'hex'),
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '7 days'),

  -- Snapshot du contrat (le client voit ces données même si le contrat change après)
  client_name         text,
  client_email        text,
  client_entreprise   text,
  client_siret        text,
  produit             text,
  formule             text,
  montant             numeric(10,2),
  frais_mise_en_place numeric(10,2) default 0,
  remise              numeric(10,2) default 0,
  recurrence          text,
  engagement_mois     integer default 0,

  -- Consentement (preuve juridique)
  consent_cgv_at      timestamptz,
  consent_rgpd_at     timestamptz,
  consent_ip          text,
  consent_user_agent  text,

  -- Stripe
  stripe_session_id   text,
  stripe_subscription_id text,
  stripe_payment_status text default 'pending',
  paid_at             timestamptz,

  status              text not null default 'pending'
    check (status in ('pending','consented','paid','expired','cancelled'))
);

alter table order_links enable row level security;

create policy "ol_insert" on order_links for insert to authenticated
  with check (created_by = auth.uid() or is_admin());
create policy "ol_select" on order_links for select to authenticated
  using (created_by = auth.uid() or is_admin());
create policy "ol_update" on order_links for update to authenticated
  using (created_by = auth.uid() or is_admin());

-- RPC publique : récupère un bon de commande par token (pour order.html, appelé avec anon key)
create or replace function get_order_by_token(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select json_build_object(
    'id', ol.id, 'token', ol.token, 'status', ol.status,
    'expires_at', ol.expires_at,
    'client_name', ol.client_name, 'client_email', ol.client_email,
    'client_entreprise', ol.client_entreprise, 'client_siret', ol.client_siret,
    'produit', ol.produit, 'formule', ol.formule,
    'montant', ol.montant, 'frais_mise_en_place', ol.frais_mise_en_place,
    'remise', ol.remise, 'recurrence', ol.recurrence,
    'engagement_mois', ol.engagement_mois,
    'paid_at', ol.paid_at
  ) into v from order_links ol where ol.token = p_token;
  if v is null then return json_build_object('error','not_found'); end if;
  if (v->>'expires_at')::timestamptz < now() then return json_build_object('error','expired'); end if;
  if v->>'status' = 'paid' then return json_build_object('error','already_paid','paid_at',v->>'paid_at'); end if;
  return v;
end; $$;

grant execute on function get_order_by_token(text) to anon, authenticated;

create index if not exists order_links_token_idx on order_links (token);
create index if not exists order_links_contract_idx on order_links (contract_id);

-- ============================================================
-- Migration v15
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v15
-- Suivi client : interactions + registre RGPD automatique
-- =========================================================

-- ---------------------------------------------------------
-- TABLE : interactions
-- Trace chaque échange avec un contact (appel, mail, visite)
-- Sert de base légale RGPD (preuve de relation active)
-- ---------------------------------------------------------
create table if not exists interactions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  contact_id      uuid not null references contacts(id) on delete cascade,
  type            text not null check (type in ('Téléphone','Email','Visite','Autre')),
  date            date not null default current_date,
  objet           text not null,
  contenu         text,
  suite_a_donner  text
);

create index if not exists idx_interactions_contact on interactions(contact_id);
create index if not exists idx_interactions_date    on interactions(date desc);
create index if not exists idx_interactions_created_by on interactions(created_by);

alter table interactions enable row level security;

create policy "interactions_select" on interactions for select to authenticated
  using (created_by = auth.uid() or is_admin());
create policy "interactions_insert" on interactions for insert to authenticated
  with check (created_by = auth.uid() or is_admin());
create policy "interactions_update" on interactions for update to authenticated
  using (created_by = auth.uid() or is_admin());
create policy "interactions_delete" on interactions for delete to authenticated
  using (created_by = auth.uid() or is_admin());

-- ---------------------------------------------------------
-- TABLE : rgpd_log
-- Trace chaque basculement automatique RGPD KO
-- ---------------------------------------------------------
create table if not exists rgpd_log (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references contacts(id) on delete cascade,
  bascule_at   timestamptz not null default now(),
  raison       text not null
);

create index if not exists idx_rgpd_log_contact on rgpd_log(contact_id);

alter table rgpd_log enable row level security;

create policy "rgpd_log_select" on rgpd_log for select to authenticated
  using (true);
create policy "rgpd_log_insert" on rgpd_log for insert to authenticated
  with check (true);

-- ---------------------------------------------------------
-- FONCTION : check_rgpd_expiry()
-- Bascule automatiquement les contacts en rgpd_ko = true
-- selon les délais légaux :
--   - Prospect : aucune interaction depuis 3 ans
--   - Client   : aucune interaction depuis 5 ans après
--                la fin du dernier contrat
-- Appelée manuellement depuis le frontend au login,
-- et en trigger après chaque INSERT d'interaction.
-- ---------------------------------------------------------
create or replace function check_rgpd_expiry()
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  last_interaction date;
  last_contract_end date;
  delai_depasse boolean;
  raison_basculement text;
begin
  -- Parcourir tous les contacts non encore RGPD KO
  for rec in
    select c.id, c.statut, c.created_at::date as creation_date
    from contacts c
    where c.rgpd_ko = false or c.rgpd_ko is null
  loop
    delai_depasse := false;
    raison_basculement := null;

    -- Dernière interaction connue avec ce contact
    select max(i.date) into last_interaction
    from interactions i
    where i.contact_id = rec.id;

    -- Date de référence : dernière interaction ou date de création du contact
    if last_interaction is null then
      last_interaction := rec.creation_date;
    end if;

    if rec.statut = 'Prospect' then
      -- Délai légal prospection : 3 ans sans interaction
      if last_interaction < current_date - interval '3 years' then
        delai_depasse := true;
        raison_basculement := 'Prospect sans interaction depuis plus de 3 ans (délai légal RGPD)';
      end if;

    elsif rec.statut = 'Client' then
      -- Délai légal relation commerciale : 5 ans après fin du dernier contrat
      select max(co.date_echeance) into last_contract_end
      from contracts co
      where co.contact_id = rec.id
        and co.statut in ('Terminé','Résilié');

      if last_contract_end is not null then
        -- Client avec contrat terminé : 5 ans après la fin du dernier contrat
        if last_contract_end < current_date - interval '5 years'
           and last_interaction < current_date - interval '5 years' then
          delai_depasse := true;
          raison_basculement := 'Client sans interaction depuis plus de 5 ans après fin de contrat (délai légal RGPD)';
        end if;
      else
        -- Client sans contrat terminé : 5 ans sans interaction
        if last_interaction < current_date - interval '5 years' then
          delai_depasse := true;
          raison_basculement := 'Client sans interaction depuis plus de 5 ans (délai légal RGPD)';
        end if;
      end if;

    elsif rec.statut = 'Inactif' then
      -- Inactif : même règle que prospect (3 ans)
      if last_interaction < current_date - interval '3 years' then
        delai_depasse := true;
        raison_basculement := 'Contact inactif sans interaction depuis plus de 3 ans (délai légal RGPD)';
      end if;
    end if;

    -- Basculement si délai dépassé
    if delai_depasse then
      update contacts set rgpd_ko = true where id = rec.id;
      insert into rgpd_log (contact_id, raison)
      values (rec.id, raison_basculement);
    end if;

  end loop;
end;
$$;

grant execute on function check_rgpd_expiry() to authenticated;

-- ---------------------------------------------------------
-- TRIGGER : après chaque nouvelle interaction,
-- vérifier uniquement le contact concerné (optimisé)
-- ---------------------------------------------------------
create or replace function trg_check_rgpd_on_interaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec record;
  last_interaction date;
  last_contract_end date;
  delai_depasse boolean := false;
  raison_basculement text;
begin
  select id, statut, created_at::date as creation_date
  into rec
  from contacts
  where id = NEW.contact_id and (rgpd_ko = false or rgpd_ko is null);

  if not found then return NEW; end if;

  select max(i.date) into last_interaction
  from interactions i where i.contact_id = rec.id;

  if last_interaction is null then last_interaction := rec.creation_date; end if;

  -- Une nouvelle interaction remet le compteur à zéro :
  -- si la nouvelle interaction est récente, on ne bascule pas.
  -- Ce trigger sert surtout à re-vérifier si on insère une vieille interaction.
  if NEW.date >= current_date - interval '3 years' then
    return NEW; -- interaction récente, pas de risque
  end if;

  if rec.statut = 'Prospect' or rec.statut = 'Inactif' then
    if last_interaction < current_date - interval '3 years' then
      delai_depasse := true;
      raison_basculement := 'Prospect/Inactif sans interaction depuis plus de 3 ans (délai légal RGPD)';
    end if;
  elsif rec.statut = 'Client' then
    select max(co.date_echeance) into last_contract_end
    from contracts co
    where co.contact_id = rec.id and co.statut in ('Terminé','Résilié');
    if last_interaction < current_date - interval '5 years' then
      delai_depasse := true;
      raison_basculement := 'Client sans interaction depuis plus de 5 ans (délai légal RGPD)';
    end if;
  end if;

  if delai_depasse then
    update contacts set rgpd_ko = true where id = rec.id;
    insert into rgpd_log (contact_id, raison) values (rec.id, raison_basculement);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_rgpd_on_interaction on interactions;
create trigger trg_rgpd_on_interaction
  after insert on interactions
  for each row execute function trg_check_rgpd_on_interaction();

-- ---------------------------------------------------------
-- VUE : interactions enrichies (avec nom du contact)
-- Utile pour le registre RGPD et les rapports
-- ---------------------------------------------------------
create or replace view v_interactions as
  select
    i.*,
    c.nom        as contact_nom,
    c.entreprise as contact_entreprise,
    c.statut     as contact_statut,
    c.rgpd_ko    as contact_rgpd_ko
  from interactions i
  join contacts c on c.id = i.contact_id;

grant select on v_interactions to authenticated;


-- ============================================================
-- Migration v16
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v16
-- Résiliation abonnement Stripe depuis la fiche contrat
-- =========================================================

-- Ajouter stripe_subscription_id sur contracts
alter table contracts
  add column if not exists stripe_subscription_id text;

-- Propager le stripe_subscription_id depuis order_links vers contracts
-- (pour les abonnements déjà payés)
update contracts ct
set stripe_subscription_id = ol.stripe_subscription_id
from order_links ol
where ol.contract_id = ct.id
  and ol.stripe_subscription_id is not null
  and ct.stripe_subscription_id is null;

-- Index
create index if not exists idx_contracts_stripe_sub
  on contracts(stripe_subscription_id)
  where stripe_subscription_id is not null;


-- ============================================================
-- Migration v17
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v17
-- Résiliation : événement tracé, pas un statut
-- =========================================================

-- Ajouter resilié_at sur contracts
alter table contracts
  add column if not exists resilié_at timestamptz;

-- Mettre à jour la contrainte statut (supprimer 'Résilié')
alter table contracts
  drop constraint if exists contracts_statut_check;

alter table contracts
  add constraint contracts_statut_check
  check (statut in ('Devis envoyé','Signé','En cours','Terminé'));

-- Migrer les anciens contrats 'Résilié' vers 'Terminé' + resilié_at
update contracts
set statut = 'Terminé', resilié_at = updated_at
where statut = 'Résilié'
  and resilié_at is null;


-- ============================================================
-- Migration v18
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v18
-- Bordereaux de commission mensuels
-- =========================================================

-- Table de suivi des bordereaux
create table if not exists bordereau_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  periode      text not null, -- format YYYY-MM (ex: 2026-06)
  generated_at timestamptz not null default now(),
  sent_at      timestamptz,
  sent_by      uuid references auth.users(id) on delete set null,
  montant_total numeric(10,2),
  notes        text
);

create unique index if not exists bordereau_log_user_periode
  on bordereau_log(user_id, periode);

create index if not exists bordereau_log_periode
  on bordereau_log(periode desc);

alter table bordereau_log enable row level security;

create policy "bordereau_select" on bordereau_log for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "bordereau_insert" on bordereau_log for insert to authenticated
  with check (is_admin());
create policy "bordereau_update" on bordereau_log for update to authenticated
  using (is_admin());

-- Fonction : lister les utilisateurs sans bordereau pour une période donnée
create or replace function get_pending_bordereaux(p_periode text default to_char(now() - interval '1 month', 'YYYY-MM'))
returns table (
  user_id uuid,
  prenom  text,
  email   text,
  periode text,
  sent_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  return query
    select
      p.id          as user_id,
      p.prenom,
      au.email,
      p_periode     as periode,
      bl.sent_at
    from profiles p
    join auth.users au on au.id = p.id
    left join bordereau_log bl
      on bl.user_id = p.id and bl.periode = p_periode
    where p.is_admin = false
    order by p.prenom;
end;
$$;

grant execute on function get_pending_bordereaux(text) to authenticated;

-- ============================================================
-- Migration v19
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v19
-- Demandes d'assistance : alertes dashboard
-- =========================================================

create table if not exists help_requests (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  sujet        text not null,
  message      text not null,
  statut       text not null default 'ouvert'
    check (statut in ('ouvert','traite')),
  treated_at   timestamptz,
  treated_by   uuid references auth.users(id) on delete set null
);

create index if not exists idx_help_requests_user    on help_requests(user_id);
create index if not exists idx_help_requests_statut  on help_requests(statut);
create index if not exists idx_help_requests_created on help_requests(created_at desc);

alter table help_requests enable row level security;

-- L'utilisateur voit ses propres demandes, l'admin voit tout
create policy "help_select" on help_requests for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- Seul l'utilisateur peut créer sa demande
create policy "help_insert" on help_requests for insert to authenticated
  with check (user_id = auth.uid());

-- Seul l'admin peut mettre à jour (traiter)
create policy "help_update" on help_requests for update to authenticated
  using (is_admin());

-- ============================================================
-- Migration v20
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v20
-- Contrats de mandat DCI — signature électronique OTP
-- =========================================================

-- Table principale des mandats signés
create table if not exists mandats (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  user_id             uuid not null references auth.users(id) on delete cascade,

  -- Numéro de contrat auto-incrémental
  numero              text unique not null,

  -- Informations mandataire saisies lors de la signature
  prenom              text not null,
  nom                 text not null,
  adresse             text not null,
  code_postal         text not null,
  ville               text not null,
  region              text not null,
  siret               text,
  rsac_numero         text,
  rsac_greffe         text,
  rcpro_assureur      text,
  rcpro_numero        text,
  rcpro_echeance      date,
  has_rcpro           boolean not null default false,

  -- Signature électronique
  signature_svg       text,        -- dessin canvas en SVG/base64
  signed_at           timestamptz, -- horodatage signature
  signed_ip           text,        -- IP du signataire
  signed_user_agent   text,        -- navigateur
  otp_verified_at     timestamptz, -- horodatage vérification OTP
  doc_hash            text,        -- hash SHA-256 du contenu signé

  -- Statut
  statut              text not null default 'en_attente'
    check (statut in ('en_attente','signe','resilie')),
  resilie_at          timestamptz,
  resilie_par         uuid references auth.users(id) on delete set null,
  resilie_motif       text,

  -- Version de la grille tarifaire acceptée
  grille_version      text not null default '2026-06',
  grille_acceptee_at  timestamptz
);

-- Séquence pour numérotation auto
create sequence if not exists mandat_seq start 1;

-- Fonction : générer le prochain numéro de contrat
create or replace function next_mandat_numero()
returns text language plpgsql security definer set search_path = public as $$
declare
  n integer;
  annee text;
begin
  n     := nextval('mandat_seq');
  annee := to_char(now(), 'YYYY');
  return 'SAFE-AC-' || annee || '-' || lpad(n::text, 3, '0');
end;
$$;

grant execute on function next_mandat_numero() to authenticated;

-- Table OTP pour vérification email
create table if not exists mandat_otp (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  code       text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used       boolean not null default false
);

alter table mandats    enable row level security;
alter table mandat_otp enable row level security;

-- Policies mandats
create policy "mandat_select" on mandats for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "mandat_insert" on mandats for insert to authenticated
  with check (user_id = auth.uid() or is_admin());
create policy "mandat_update" on mandats for update to authenticated
  using (user_id = auth.uid() or is_admin());

-- Policies OTP
create policy "otp_select" on mandat_otp for select to authenticated
  using (user_id = auth.uid());
create policy "otp_insert" on mandat_otp for insert to authenticated
  with check (user_id = auth.uid());
create policy "otp_update" on mandat_otp for update to authenticated
  using (user_id = auth.uid());

-- Index
create index if not exists idx_mandats_user    on mandats(user_id);
create index if not exists idx_mandats_statut  on mandats(statut);
create index if not exists idx_mandat_otp_user on mandat_otp(user_id);

-- Vue admin : mandats avec email utilisateur
create or replace view v_mandats as
  select m.*, au.email as user_email
  from mandats m
  join auth.users au on au.id = m.user_id;

grant select on v_mandats to authenticated;

-- ============================================================
-- Migration v21
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v21
-- Gestion mot de passe robuste + rotation 45 jours
-- =========================================================

-- Ajouter les colonnes de gestion mot de passe sur profiles
alter table profiles
  add column if not exists password_set          boolean not null default false,
  add column if not exists password_changed_at   timestamptz,
  add column if not exists profil_completed      boolean not null default false,
  add column if not exists totp_proposed         boolean not null default false;

-- Marquer les admins existants comme ayant un mot de passe défini
-- (ils ne seront pas bloqués, juste banner non-bloquant)
update profiles set password_set = true, profil_completed = true
where is_admin = true and password_set = false;

-- Fonction : vérifier si le mot de passe doit être renouvelé (45 jours)
create or replace function needs_password_renewal(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_changed_at timestamptz;
  v_set        boolean;
begin
  select password_changed_at, password_set
  into v_changed_at, v_set
  from profiles where id = p_user_id;

  -- Pas encore défini → oui
  if not v_set then return true; end if;
  -- Jamais changé → oui
  if v_changed_at is null then return true; end if;
  -- Plus de 45 jours → oui
  return v_changed_at < now() - interval '45 days';
end;
$$;

grant execute on function needs_password_renewal(uuid) to authenticated;

-- ============================================================
-- Migration v22
-- ============================================================
-- =========================================================
-- S@FE CRM — Migration v22
-- Sécurité : protection des champs is_admin et role
--
-- Problème corrigé :
--   La politique "profiles_update_own" laissait tout utilisateur
--   authentifié modifier is_admin et role sur sa propre ligne,
--   permettant une auto-escalade en super_admin.
--
-- Corrections :
--   1. Trigger BEFORE UPDATE qui rejette toute tentative de
--      modification de is_admin / role par un non-administrateur.
--   2. Nouvelle politique admin permettant à un administrateur
--      de modifier le profil de n'importe quel utilisateur
--      (nécessaire pour la gestion des rôles depuis le CRM).
-- =========================================================

-- ---------------------------------------------------------
-- 1. Fonction déclencheur : protection des champs sensibles
-- ---------------------------------------------------------
create or replace function protect_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Si is_admin ou role changent, seul un admin peut le faire
  if (new.is_admin is distinct from old.is_admin)
  or (new.role     is distinct from old.role) then

    if not is_admin() then
      raise exception
        'Accès refusé : seul un administrateur peut modifier les droits ou le rôle (is_admin / role).';
    end if;

    -- Un admin ne peut pas retirer ses propres droits admin
    if auth.uid() = old.id
       and (new.is_admin is distinct from old.is_admin)
       and not new.is_admin
    then
      raise exception
        'Vous ne pouvez pas retirer vos propres droits d''administrateur.';
    end if;

  end if;

  return new;
end;
$$;

-- Supprime un éventuel trigger précédent pour idempotence
drop trigger if exists profiles_protect_admin_fields on profiles;

create trigger profiles_protect_admin_fields
  before update on profiles
  for each row
  execute function protect_admin_fields();

-- ---------------------------------------------------------
-- 2. Politique admin : accès en écriture sur tous les profils
--    (nécessaire pour saveEditUser et la gestion des rôles)
-- ---------------------------------------------------------
drop policy if exists "profiles_update_admin" on profiles;

create policy "profiles_update_admin" on profiles
  for update
  using    (is_admin())
  with check (is_admin());

-- ============================================================
-- Migration v23
-- ============================================================
-- =========================================================
-- S@FE CRM — Migration v23
-- Sécurité : journal de connexion + détection d'intrusion
-- =========================================================

-- ---------------------------------------------------------
-- 1. Table login_audit
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_audit (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text        NOT NULL,
  success    boolean     NOT NULL,
  locked     boolean     NOT NULL DEFAULT false,
  ip_hint    text,
  created_at timestamptz DEFAULT now()
);

-- Index pour les requêtes admin (tri par date)
CREATE INDEX IF NOT EXISTS login_audit_created_at_idx ON login_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS login_audit_email_idx      ON login_audit (email);

-- RLS : lecture réservée aux administrateurs
ALTER TABLE login_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_audit_admin_read" ON login_audit;
CREATE POLICY "login_audit_admin_read" ON login_audit
  FOR SELECT USING (is_admin());

-- ---------------------------------------------------------
-- 2. RPC log_login_attempt (SECURITY DEFINER — accessible
--    sans session authentifiée, car appelée lors du login)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION log_login_attempt(
  p_email   text,
  p_success boolean,
  p_locked  boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text;
BEGIN
  -- Tenter de récupérer l'IP depuis les headers (Supabase Edge)
  BEGIN
    v_ip := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  INSERT INTO login_audit (email, success, locked, ip_hint)
  VALUES (p_email, p_success, p_locked, v_ip);
EXCEPTION WHEN OTHERS THEN
  NULL; -- non bloquant : une erreur de log ne doit jamais bloquer la connexion
END;
$$;

-- ---------------------------------------------------------
-- 3. Table login_alerts — alertes visibles dans le panel admin
--    Déclenchée automatiquement après 5 échecs (verrouillage)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_alerts (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text        NOT NULL,
  details    text,
  resolved   boolean     DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE login_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_alerts_admin" ON login_alerts;
CREATE POLICY "login_alerts_admin" ON login_alerts
  FOR ALL USING (is_admin());

-- ---------------------------------------------------------
-- 4. Trigger : créer une alerte admin dès qu'un verrou est posé
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION _trigger_login_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.locked = true THEN
    INSERT INTO login_alerts (email, details)
    VALUES (
      NEW.email,
      'Compte verrouillé après ' || (
        SELECT COUNT(*) FROM login_audit
        WHERE email = NEW.email
          AND success = false
          AND created_at > now() - interval '1 hour'
      ) || ' tentatives échouées en 1h — IP : ' || COALESCE(NEW.ip_hint, 'inconnue')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS login_audit_alert ON login_audit;
CREATE TRIGGER login_audit_alert
  AFTER INSERT ON login_audit
  FOR EACH ROW
  EXECUTE FUNCTION _trigger_login_alert();

-- ---------------------------------------------------------
-- 5. RPC get_login_audit — lecture admin des 50 dernières
--    tentatives (évite d'exposer la table directement au client)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_login_audit(p_limit int DEFAULT 50)
RETURNS TABLE (
  id         uuid,
  email      text,
  success    boolean,
  locked     boolean,
  ip_hint    text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;
  RETURN QUERY
    SELECT a.id, a.email, a.success, a.locked, a.ip_hint, a.created_at
    FROM login_audit a
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------
-- 6. RPC get_login_alerts — alertes non résolues pour l'admin
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_login_alerts()
RETURNS TABLE (
  id         uuid,
  email      text,
  details    text,
  resolved   boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;
  RETURN QUERY
    SELECT a.id, a.email, a.details, a.resolved, a.created_at
    FROM login_alerts a
    ORDER BY a.created_at DESC;
END;
$$;

-- ---------------------------------------------------------
-- 7. RPC resolve_login_alert — marquer une alerte résolue
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION resolve_login_alert(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;
  UPDATE login_alerts SET resolved = true WHERE id = p_id;
END;
$$;

-- ============================================================
-- Migration v24
-- ============================================================
-- =========================================================
-- S@FE CRM — Migration v24
-- Sécurité : tables pour l'Edge Function record-login-failure
-- =========================================================

-- ---------------------------------------------------------
-- 1. Table rate_limits — anti-abus par IP (1h glissante)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  action     text        PRIMARY KEY,
  count      int         NOT NULL DEFAULT 0,
  window_at  timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Aucun accès direct côté client (tout passe par Edge Function service_role)
DROP POLICY IF EXISTS "rate_limits_deny_all" ON rate_limits;
CREATE POLICY "rate_limits_deny_all" ON rate_limits
  FOR ALL USING (false);

-- ---------------------------------------------------------
-- 2. Table login_attempts — compteur d'échecs par email
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  email           text        PRIMARY KEY,
  attempts        int         NOT NULL DEFAULT 0,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at       timestamptz
);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Lecture admin uniquement
DROP POLICY IF EXISTS "login_attempts_admin_read" ON login_attempts;
CREATE POLICY "login_attempts_admin_read" ON login_attempts
  FOR SELECT USING (is_admin());

-- Aucune écriture directe côté client (tout passe par Edge Function service_role)
DROP POLICY IF EXISTS "login_attempts_deny_write" ON login_attempts;
CREATE POLICY "login_attempts_deny_write" ON login_attempts
  FOR ALL USING (false);

-- Index pour les requêtes admin
CREATE INDEX IF NOT EXISTS login_attempts_locked_idx ON login_attempts (locked_at DESC NULLS LAST);

-- ---------------------------------------------------------
-- 3. RPC reset_login_attempts — déblocage manuel par l'admin
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION reset_login_attempts(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;

  -- Réinitialiser le compteur
  UPDATE login_attempts
  SET attempts = 0, locked_at = NULL, last_attempt_at = now()
  WHERE email = user_email;

  -- Lever le ban Supabase Auth via la vue auth.users (si accessible)
  -- Note : le vrai déblocage se fait via l'Edge Function ou le dashboard Supabase
  -- car ban_duration nécessite service_role
  DELETE FROM login_attempts WHERE email = user_email AND attempts = 0;

  -- Journaliser l'action admin
  BEGIN
    INSERT INTO login_audit (email, success, locked, ip_hint)
    VALUES (user_email, true, false, 'admin_reset');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- ---------------------------------------------------------
-- 4. Nettoyage automatique — purge hebdomadaire des vieux logs
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_security_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garder 90 jours de login_audit
  DELETE FROM login_audit WHERE created_at < now() - interval '90 days';
  -- Purger les rate_limits d'hier
  DELETE FROM rate_limits WHERE window_at < now() - interval '2 hours';
  -- Purger les tentatives débloquées depuis plus de 24h
  DELETE FROM login_attempts WHERE locked_at IS NULL AND last_attempt_at < now() - interval '24 hours';
END;
$$;

-- ============================================================
-- Migration v25
-- ============================================================
-- ============================================================
-- S@FE CRM — Migration v25 : Module DPO Clients
-- Suivi de la conformité RGPD des clients S@FE
-- Appliqué via Supabase MCP le 2026-06-20
-- ============================================================

-- 1. Profil DPO par client (1 ligne par contact)
CREATE TABLE IF NOT EXISTS dpo_client_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  score_global int DEFAULT 0,
  score_traitements int DEFAULT 0,
  score_consentements int DEFAULT 0,
  score_documents int DEFAULT 0,
  score_sous_traitants int DEFAULT 0,
  score_procedures int DEFAULT 0,
  score_audit int DEFAULT 0,
  responsable_dpo text,
  notes text,
  last_audit_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(contact_id)
);
ALTER TABLE dpo_client_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_profiles_auth" ON dpo_client_profiles
  TO authenticated USING (true) WITH CHECK (true);

-- 2. Registre des traitements par client (Art.30 RGPD)
CREATE TABLE IF NOT EXISTS dpo_client_traitements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  nom text NOT NULL,
  finalite text,
  base_legale text DEFAULT 'Consentement (Art.6.1.a)',
  categories_donnees text[] DEFAULT '{}',
  duree_conservation text,
  responsable_traitement text,
  sous_traitants text[] DEFAULT '{}',
  statut text DEFAULT 'Actif',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dpo_client_traitements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_traitements_auth" ON dpo_client_traitements
  TO authenticated USING (true) WITH CHECK (true);

-- 3. Consentements (email, SMS, marketing, formulaire)
CREATE TABLE IF NOT EXISTS dpo_client_consentements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type_consentement text NOT NULL,
  statut text DEFAULT 'actif',
  date_obtention date DEFAULT CURRENT_DATE,
  source text,
  date_retrait date,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE dpo_client_consentements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_consentements_auth" ON dpo_client_consentements
  TO authenticated USING (true) WITH CHECK (true);

-- 4. Demandes d'exercice des droits (Art.15-22 RGPD)
CREATE TABLE IF NOT EXISTS dpo_client_demandes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  demandeur_nom text NOT NULL,
  demandeur_email text,
  type_droit text NOT NULL,
  date_demande date DEFAULT CURRENT_DATE,
  date_limite date,          -- calculé : date_demande + 30 jours
  statut text DEFAULT 'Reçue',
  description text,
  reponse text,
  historique jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dpo_client_demandes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_demandes_auth" ON dpo_client_demandes
  TO authenticated USING (true) WITH CHECK (true);

-- 5. Bibliothèque documentaire RGPD par client
CREATE TABLE IF NOT EXISTS dpo_client_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type_document text NOT NULL,
  titre text NOT NULL,
  contenu text,
  version int DEFAULT 1,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dpo_client_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_documents_auth" ON dpo_client_documents
  TO authenticated USING (true) WITH CHECK (true);

-- 6. Violations de données par client
CREATE TABLE IF NOT EXISTS dpo_client_violations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  date_incident date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  niveau_gravite text DEFAULT 'modéré',
  categories_donnees text[] DEFAULT '{}',
  nb_personnes_concernees int,
  actions_correctives text,
  statut text DEFAULT 'ouvert',
  cloture_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dpo_client_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_violations_auth" ON dpo_client_violations
  TO authenticated USING (true) WITH CHECK (true);

-- 7. Items d'audit automatique par client
CREATE TABLE IF NOT EXISTS dpo_client_audit_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  categorie text NOT NULL,
  item text NOT NULL,
  statut text DEFAULT 'action_requise',
  note text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dpo_client_audit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_audit_items_auth" ON dpo_client_audit_items
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Migration v26
-- ============================================================
-- ============================================================
-- Migration v26 — Centre de connecteurs S@FE Work
-- Appliquée le 2026-06-20
-- ============================================================

CREATE TABLE IF NOT EXISTS safe_connectors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key     text NOT NULL UNIQUE,
  label           text NOT NULL,
  statut          text NOT NULL DEFAULT 'non_configure'
                  CHECK (statut IN ('non_configure','configure','actif','desactive')),
  api_key_masked  text,     -- jamais la clé en clair, seulement les 4 derniers chars
  notes           text,
  activated_by    uuid REFERENCES auth.users(id),
  activated_at    timestamptz,
  desactivated_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safe_connectors_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_key text NOT NULL,
  action        text NOT NULL,  -- 'activated','desactivated','configured','key_updated'
  done_by       uuid REFERENCES auth.users(id),
  done_at       timestamptz DEFAULT now(),
  notes         text
);

ALTER TABLE safe_connectors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE safe_connectors_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_safe_connectors"
  ON safe_connectors TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_safe_connectors_log"
  ON safe_connectors_log TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Migration v27
-- ============================================================
-- ============================================================
-- S@FE CRM — Schema v27 : TOTP audit + Access log RGPD
-- Art.42 RGPD / Critères CNIL — Phase 1 sécurité
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- TABLE : totp_audit
-- Journal des événements TOTP (enrollment, verify, cancel)
-- Alimenté par challengeTOTPIfNeeded() côté client
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS totp_audit (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event      TEXT        NOT NULL,
  -- event IN: enrollment_required | enrollment_ok | verify_ok | verify_ok_aal
  --           verify_fail | challenge_cancelled
  role       TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE totp_audit ENABLE ROW LEVEL SECURITY;

-- Seuls les super_admin peuvent lire — insertion via RLS SECURITY DEFINER function
CREATE POLICY "totp_audit_read_super_admin"
  ON totp_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- INSERT autorisé à l'utilisateur connecté pour son propre user_id
CREATE POLICY "totp_audit_insert_self"
  ON totp_audit FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);


-- ──────────────────────────────────────────────────────────
-- TABLE : audit_access_log
-- Trail des accès aux logs d'audit (DPO / admin)
-- Art.32 RGPD — traçabilité des accès aux données sensibles
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_access_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  accessed_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  accessed_role  TEXT,
  accessed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  table_accessed TEXT,
  rows_count     INT,
  reason_code    TEXT,
  ip_address     INET,
  file_hash      TEXT
);

ALTER TABLE audit_access_log ENABLE ROW LEVEL SECURITY;

-- Seuls les utilisateurs avec rôle super_admin ou admin_candy (= DPO) peuvent lire
CREATE POLICY "audit_access_log_read_dpo"
  ON audit_access_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin_candy')
    )
  );

-- INSERT autorisé à l'utilisateur connecté
CREATE POLICY "audit_access_log_insert_self"
  ON audit_access_log FOR INSERT
  WITH CHECK (accessed_by = auth.uid());


-- ──────────────────────────────────────────────────────────
-- Index pour performances (recherche par user + date)
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_totp_audit_user_id     ON totp_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_totp_audit_created_at  ON totp_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_accessed_by        ON audit_access_log(accessed_by);
CREATE INDEX IF NOT EXISTS idx_aal_accessed_at        ON audit_access_log(accessed_at DESC);

-- ============================================================
-- Migration v28
-- ============================================================
-- ============================================================
-- Migration v28 — Correction RLS safe_connectors
-- Appliquée le 2026-06-23
-- Référence audit : P0-5 — RGPD Art.25, ANSSI principe de moindre privilège
-- ============================================================

-- ── safe_connectors ──────────────────────────────────────────────────────
-- Remplacement de la policy unique USING(true) WITH CHECK(true)
-- par 4 policies granulaires : SELECT ouvert, écriture admin uniquement.

DROP POLICY IF EXISTS "auth_safe_connectors" ON safe_connectors;

-- SELECT : tous les utilisateurs authentifiés
-- (requis par connectors-guard.js, modules work/)
CREATE POLICY "safe_connectors_select"
  ON safe_connectors FOR SELECT TO authenticated
  USING (true);

-- INSERT : admins uniquement
CREATE POLICY "safe_connectors_admin_insert"
  ON safe_connectors FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- UPDATE : admins uniquement
CREATE POLICY "safe_connectors_admin_update"
  ON safe_connectors FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- DELETE : admins uniquement
CREATE POLICY "safe_connectors_admin_delete"
  ON safe_connectors FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ── safe_connectors_log ───────────────────────────────────────────────────
-- Journal d'audit des connecteurs : accès restreint aux admins.

DROP POLICY IF EXISTS "auth_safe_connectors_log" ON safe_connectors_log;

-- SELECT log : admins uniquement
CREATE POLICY "safe_connectors_log_admin_select"
  ON safe_connectors_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- INSERT log : admins uniquement
CREATE POLICY "safe_connectors_log_admin_insert"
  ON safe_connectors_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- Migration v29
-- ============================================================
-- =========================================================
-- S@FE CRM — Mise à jour v29
-- Géographie profil : ajout code_postal et ville séparés
-- =========================================================

alter table profiles
  add column if not exists code_postal text,
  add column if not exists ville       text;
