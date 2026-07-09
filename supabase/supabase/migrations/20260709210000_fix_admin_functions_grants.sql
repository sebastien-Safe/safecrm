-- Les fonctions admin_set_banned / admin_set_admin / admin_delete_user avaient
-- perdu leur GRANT EXECUTE pour "authenticated" sur la base distante (dérive
-- entre l'historique de migrations et l'état réel de la prod, probablement
-- suite à une recréation ad-hoc des fonctions qui réinitialise l'ACL Postgres
-- par défaut). Résultat : "permission denied for function admin_set_banned"
-- pour tout admin authentifié depuis l'espace de gestion.

grant execute on function public.admin_set_banned(uuid, boolean) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
