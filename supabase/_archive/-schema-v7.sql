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
