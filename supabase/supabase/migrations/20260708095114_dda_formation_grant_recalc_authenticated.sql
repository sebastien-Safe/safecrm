-- Correction : la fonction recalc_dda_obligation est invoquée par le trigger
-- trg_recalc_dda_obligation (qui, lui, s'exécute en SECURITY INVOKER, donc
-- avec les droits de l'utilisateur authentifié qui modifie dda_sessions).
-- Sans ce grant, toute écriture sur dda_sessions par un formateur authentifié
-- échouerait avec "permission denied for function recalc_dda_obligation".
grant execute on function recalc_dda_obligation(uuid) to authenticated;
