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
