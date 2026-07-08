-- Migration v35 — Prospects web (safe-assurances / safe-digitalisation → CRM)
--
-- Ajoute deux colonnes à `contacts` pour distinguer les fiches créées
-- automatiquement depuis les formulaires de contact des sites vitrines :
--   - canal_acquisition : NULL pour toute fiche existante/saisie manuelle
--     (comportement inchangé), renseigné par l'edge function `create-lead`
--     pour les nouveaux prospects web (ex: 'Site web — S@FE Assurances').
--   - qualification : par défaut 'qualifié' pour ne pas re-qualifier
--     silencieusement les fiches existantes ; l'edge function `create-lead`
--     passe explicitement 'non_qualifié' pour les prospects web.
--
-- Aucune modification RLS : ces colonnes sont écrites soit par un
-- utilisateur authentifié (RLS existant sur `contacts` inchangé), soit par
-- l'edge function `create-lead` via la clé service_role (contourne le RLS).

alter table contacts
  add column if not exists canal_acquisition text,
  add column if not exists qualification text default 'qualifié'
    check (qualification in ('non_qualifié', 'qualifié'));

comment on column contacts.canal_acquisition is 'Origine de la fiche si créée automatiquement (ex: formulaire web) — NULL = saisie manuelle par un commercial.';
comment on column contacts.qualification is 'Statut de qualification commerciale du prospect, indépendant de `statut` (Prospect/Client/Inactif).';
