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
