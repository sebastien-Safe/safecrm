-- ============================================================
-- Migration : Système de réservation de RDV commercial
-- Ajoute :
--   - profiles.availability  (JSONB horaires de travail)
--   - profiles.booking_token (token URL public de réservation)
--   - table bookings         (réservations prospect)
-- ============================================================

-- Champs agenda sur la table profiles existante
alter table profiles
  add column if not exists availability   jsonb    default '{}',
  add column if not exists booking_token  text     unique;

-- Index sur le token pour lookup rapide depuis la page publique
create index if not exists idx_profiles_booking_token
  on profiles (booking_token)
  where booking_token is not null;

-- ── Table bookings ──────────────────────────────────────────
create table if not exists bookings (
  id            uuid        primary key default gen_random_uuid(),
  commercial_id uuid        not null references profiles(id) on delete cascade,
  date          date        not null,
  heure         time        not null,
  duree_min     int         not null default 60,
  nom           text        not null,
  entreprise    text,
  email         text        not null,
  telephone     text,
  message       text,
  adresse       text,
  lat           numeric(10,7),
  lng           numeric(10,7),
  statut        text        not null default 'confirmé'
                            check (statut in ('confirmé','annulé','terminé')),
  created_at    timestamptz not null default now()
);

-- RLS : le commercial voit ses propres réservations
alter table bookings enable row level security;

create policy "commercial_own_bookings" on bookings
  for all
  using (commercial_id = auth.uid());

-- Index perf pour requêtes de créneaux
create index if not exists idx_bookings_commercial_date
  on bookings (commercial_id, date);
