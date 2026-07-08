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
