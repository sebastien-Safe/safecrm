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
