-- ============================================================
-- Migration : Remplacement du système de réservation maison
-- par les liens de rendez-vous Google Calendar
-- Ajoute :
--   - profiles.google_booking_url (URL publique du planning Google)
-- Supprime :
--   - table bookings
--   - profiles.availability / profiles.booking_token
-- ============================================================

alter table profiles
  add column if not exists google_booking_url text;

drop table if exists bookings;

drop index if exists idx_profiles_booking_token;

alter table profiles
  drop column if exists availability,
  drop column if exists booking_token;
