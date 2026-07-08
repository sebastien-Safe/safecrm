-- Postgres accorde EXECUTE à PUBLIC par défaut à la création d'une fonction :
-- is_formateur() et recalc_dda_obligation() étaient donc appelables en RPC par
-- un utilisateur anonyme (get_advisors l'a détecté). On aligne sur le seul
-- exemple correctement verrouillé du repo (is_admin()) : revoke public, grant
-- authenticated uniquement.
revoke execute on function is_formateur() from public;
grant execute on function is_formateur() to authenticated;

revoke execute on function recalc_dda_obligation(uuid) from public;
