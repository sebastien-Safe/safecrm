-- =========================================================
-- S@FE CRM — Mise à jour v9 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v8).
--
-- Ajoute des colonnes de traçabilité pour les bons de
-- commande signés électroniquement et envoyés au client :
--   - date d'envoi pour signature
--   - e-mail du destinataire
--   - URL kDrive du PDF signé archivé
-- =========================================================

alter table contracts
  add column if not exists sent_for_signature_at  timestamptz,
  add column if not exists sent_for_signature_to  text,
  add column if not exists signed_pdf_kdrive_url  text;

create index if not exists contracts_signed_idx
  on contracts (sent_for_signature_at desc) where sent_for_signature_at is not null;
