-- ============================================================
-- S@FE CRM — Consentement RGPD général (formulaires site vitrine)
-- Distinct de consent_telephone/consent_email/consent_courrier
-- (consentements de démarchage) : ici, preuve du consentement au
-- traitement des données pour répondre à la demande (T10).
-- ============================================================

alter table contacts
  add column if not exists consent_rgpd       boolean not null default false,
  add column if not exists consent_rgpd_at    timestamptz,
  add column if not exists consent_rgpd_texte text;
