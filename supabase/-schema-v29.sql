-- =========================================================
-- S@FE CRM — Mise à jour v29
-- Géographie profil : ajout code_postal et ville séparés
-- =========================================================

alter table profiles
  add column if not exists code_postal text,
  add column if not exists ville       text;
