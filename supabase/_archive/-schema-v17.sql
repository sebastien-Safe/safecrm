-- =========================================================
-- S@FE CRM — Mise à jour v17
-- Résiliation : événement tracé, pas un statut
-- =========================================================

-- Ajouter resilié_at sur contracts
alter table contracts
  add column if not exists resilié_at timestamptz;

-- Mettre à jour la contrainte statut (supprimer 'Résilié')
alter table contracts
  drop constraint if exists contracts_statut_check;

alter table contracts
  add constraint contracts_statut_check
  check (statut in ('Devis envoyé','Signé','En cours','Terminé'));

-- Migrer les anciens contrats 'Résilié' vers 'Terminé' + resilié_at
update contracts
set statut = 'Terminé', resilié_at = updated_at
where statut = 'Résilié'
  and resilié_at is null;

