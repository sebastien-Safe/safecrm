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
