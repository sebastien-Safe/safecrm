-- =========================================================
-- S@FE CRM — Mise à jour v6 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v5), dans :
-- Supabase > SQL Editor > New query > Run
--
-- Le taux de commission n'est plus modifiable depuis le CRM
-- (fixé à 12 %, voir assets/app.js — COMMISSION_RATE).
-- Ce script met simplement à jour le libellé de l'objectif
-- correspondant et aligne la valeur stockée pour référence.
-- =========================================================

update objectifs
set label = 'Commissions reversées',
    taux_commission = 
where metric_type = 'commissions';
