-- =========================================================
-- S@FE CRM — Mise à jour v12 (Schéma de base de données)
-- À exécuter APRÈS les scripts précédents (v1 à v11).
--
-- 🚨 CORRECTIF MAJEUR
-- ------------------
-- L'ancienne fonction `admin_create_user` insérait directement
-- dans `auth.users` et `auth.identities`, mais le format
-- requis par Supabase Auth a évolué : certains champs internes
-- (instance_id, confirmation_token, email_change_token_new...)
-- doivent être positionnés selon une convention précise, et
-- l'insertion par SQL contourne le flow officiel.
--
-- Conséquence : les utilisateurs créés ainsi étaient "cassés"
-- — leur connexion échouait avec l'erreur :
--   « Database error querying schema »
--
-- Cette mise à jour :
--   1. Neutralise `admin_create_user` (lève désormais une
--      exception explicite avec la marche à suivre).
--   2. La création se fait dorénavant via l'Edge Function
--      `admin-create-user` qui utilise l'API Auth Admin
--      officielle de Supabase (service_role_key, côté serveur).
--
-- 🧹 NETTOYAGE DES UTILISATEURS CASSÉS
-- ------------------------------------
-- Si vous avez déjà créé des utilisateurs via l'ancienne
-- fonction, supprimez-les depuis le dashboard Supabase :
--   Authentication > Users > sélectionner > "..." > Delete
-- Puis recréez-les via le nouveau bouton "Créer un utilisateur"
-- du CRM (qui appellera l'Edge Function).
-- =========================================================

drop function if exists admin_create_user(text, text, text);

-- On garde une fonction du même nom mais qui lève une exception
-- explicite avec instructions, pour le cas où un script ou un
-- collègue tenterait l'ancienne API.
create or replace function admin_create_user(
  new_email    text,
  new_password text,
  new_prenom   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'La création d''utilisateurs par SQL direct est désactivée car elle produit des comptes cassés. '
    'Utilisez le bouton "Créer un utilisateur" du CRM (qui appelle l''Edge Function admin-create-user), '
    'ou créez l''utilisateur depuis le dashboard Supabase : Authentication > Users > Add user.';
end;
$$;

revoke execute on function admin_create_user(text, text, text) from authenticated;
