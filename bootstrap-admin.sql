-- =========================================================
-- S@FE CRM — Promotion en super-administrateur
-- =========================================================
--
-- 🎯 À exécuter UNE FOIS (et une seule) après le déploiement
--    initial du CRM, pour vous donner les droits admin.
--
-- 👉 INSTRUCTIONS :
--    1. Remplacez ci-dessous 'votre.email@example.com' par
--       VOTRE adresse e-mail (celle utilisée pour la
--       connexion au CRM).
--    2. Copiez la requête dans Supabase > SQL Editor > New
--       query > Run.
--    3. Reconnectez-vous au CRM : l'onglet "Administration"
--       apparaît dans la barre latérale.
--
-- 🛡️ Le script est sécurisé :
--    - Si l'utilisateur n'existe pas → message d'erreur clair
--    - Si l'utilisateur n'a pas encore de ligne dans
--      `profiles`, elle est créée automatiquement
--    - L'opération est idempotente : la rejouer ne casse rien
-- =========================================================

-- ↓↓↓ REMPLACEZ CETTE LIGNE PAR VOTRE EMAIL ↓↓↓
do $$
declare
  v_email text := 'votre.email@example.com';   -- ← À MODIFIER
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception 'Aucun utilisateur avec l''email %. Connectez-vous au moins une fois au CRM avant de relancer ce script.', v_email;
  end if;
  insert into profiles (id, is_admin)
  values (v_user_id, true)
  on conflict (id) do update set is_admin = true;
  raise notice '✅ Utilisateur % promu super-administrateur.', v_email;
end $$;

-- Vérification
select email, is_admin
  from auth.users u
  join profiles  p on p.id = u.id
  where p.is_admin = true;
