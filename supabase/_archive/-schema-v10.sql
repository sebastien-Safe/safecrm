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
