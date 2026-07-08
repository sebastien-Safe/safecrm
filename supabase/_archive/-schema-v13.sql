-- =========================================================
-- S@FE CRM — Mise à jour v13 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v12).
--
-- Ajoute deux colonnes manquantes sur la table contracts :
--
--   • frais_mise_en_place : montant HT des frais facturés
--     au 1ᵉʳ mois (non remboursables). Apparaît dans le
--     récapitulatif financier du bon de commande PDF et sert
--     de base au calcul de la commission à la signature.
--
--   • engagement_mois : durée minimale d'engagement (en mois).
--     Sert au calcul automatique de la date d'échéance.
--
-- Pré-remplissage des contrats existants : on lit FORMULE_PRESETS
-- côté client à la prochaine sauvegarde. Pour rattraper les
-- contrats existants sans intervention manuelle, le script ci-
-- dessous applique les valeurs par défaut connues.
-- =========================================================

alter table contracts
  add column if not exists frais_mise_en_place numeric(10, 2),
  add column if not exists engagement_mois     integer;

-- Rattrapage : valeurs par défaut pour les contrats existants
-- (basées sur FORMULE_PRESETS — alignement avec la grille de
--  commissionnement SAFE-AC-2026 du 10 juin 2026).

-- Référencement Local
update contracts set frais_mise_en_place = 190, engagement_mois = 6
  where type = 'Référencement Local' and formule = 'Essentiel'
    and frais_mise_en_place is null;
update contracts set frais_mise_en_place = 290, engagement_mois = 6
  where type = 'Référencement Local' and formule = 'Boost'
    and frais_mise_en_place is null;
update contracts set frais_mise_en_place = 0, engagement_mois = 3
  where type = 'Référencement Local' and formule = 'Prestige'
    and frais_mise_en_place is null;

-- Click & Collect
update contracts set frais_mise_en_place = 150, engagement_mois = 6
  where type = 'Click & Collect' and formule = 'Essentiel'
    and frais_mise_en_place is null;
update contracts set frais_mise_en_place = 250, engagement_mois = 6
  where type = 'Click & Collect' and formule = 'Pro'
    and frais_mise_en_place is null;
update contracts set frais_mise_en_place = 0, engagement_mois = 3
  where type = 'Click & Collect' and formule = 'Premium'
    and frais_mise_en_place is null;

-- DPO externalisé (engagement 12 mois)
update contracts set frais_mise_en_place = 0, engagement_mois = 12
  where type = 'DPO externalisé' and frais_mise_en_place is null;

-- Tous les autres contrats restants (audits, options, etc.) :
-- ponctuels sans frais MeP ni engagement.
update contracts set frais_mise_en_place = coalesce(frais_mise_en_place, 0),
                     engagement_mois     = coalesce(engagement_mois, 0)
  where frais_mise_en_place is null or engagement_mois is null;
