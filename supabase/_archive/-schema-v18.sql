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
