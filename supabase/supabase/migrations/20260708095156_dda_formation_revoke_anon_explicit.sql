-- Le schéma public a un ALTER DEFAULT PRIVILEGES qui accorde EXECUTE à anon
-- sur toute nouvelle fonction (revoke from public seul ne suffit pas, l'ACL
-- liste anon explicitement, pas via PUBLIC). Révocation explicite nécessaire.
revoke execute on function is_formateur() from anon;
revoke execute on function recalc_dda_obligation(uuid) from anon;
