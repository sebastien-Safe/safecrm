# Déploiement de l'Edge Function `admin-create-user`

Cette Edge Function remplace l'ancienne RPC SQL `admin_create_user` qui produisait des utilisateurs cassés (« Database error querying schema » au login).

Elle utilise l'**API Auth Admin officielle** de Supabase, ce qui garantit que les utilisateurs créés sont 100 % compatibles avec le flow de connexion standard (instance_id, identités, tokens de confirmation, etc. sont gérés par Supabase lui-même).

## Aucun secret à configurer

Contrairement à la précédente Edge Function `send-contract`, celle-ci n'a **aucun secret métier à configurer**. Elle utilise uniquement les variables d'environnement fournies automatiquement aux Edge Functions :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

Vous n'avez donc rien à ajouter dans Project Settings → Edge Functions → Secrets.

## Déploiement

### Option A — CLI Supabase (recommandée)

```bash
cd safe-crm           # racine du projet, contient supabase/functions/admin-create-user
supabase login
supabase link --project-ref tqfkdwashuepzstpxdlw
supabase functions deploy admin-create-user
```

### Option B — Dashboard Supabase

1. Dashboard → **Edge Functions** → **Deploy a new function**.
2. Nom : `admin-create-user`.
3. Copiez/collez le contenu de `supabase/functions/admin-create-user/index.ts`.
4. **Verify JWT** : laisser activé (par défaut).
5. **Deploy**.

## Test

1. Connectez-vous au CRM en tant que super-administrateur.
2. Onglet **Administration** → **Gestion des utilisateurs** → bouton **« + Créer un utilisateur »**.
3. Renseignez e-mail, prénom, mot de passe (≥ 8 caractères). Cliquez Créer.
4. L'utilisateur doit apparaître dans la liste.
5. Déconnectez-vous, reconnectez-vous avec les identifiants de l'utilisateur créé : la connexion doit fonctionner immédiatement.

## En cas d'échec

Le CRM affiche désormais l'**erreur précise** retournée par l'Edge Function. Voici les codes possibles :

| Code | Cause | Solution |
| --- | --- | --- |
| `forbidden` (`super_admin_required`) | L'appelant n'est pas admin | Vérifiez `profiles.is_admin = true` pour votre compte |
| `invalid_email` / `password_too_short` | Validation côté serveur | Mot de passe ≥ 8 caractères, e-mail valide |
| `create_failed` | L'API Auth Admin a refusé | Voir `details` : souvent un e-mail déjà utilisé |
| `missing_supabase_env` | Edge Function mal déployée | Redéployez via la CLI |
| `Function not found` (404) | Edge Function non déployée | Suivre la section Déploiement ci-dessus |

## Si vous ne voulez pas déployer cette Edge Function

Alternative parfaitement valable : créer chaque utilisateur **manuellement** depuis le dashboard Supabase :
1. Supabase Dashboard → **Authentication** → **Users** → bouton **Add user** → **Create new user**.
2. Saisissez e-mail + mot de passe. Cochez « Auto Confirm User ».
3. Le profil est créé automatiquement par le trigger Supabase. Retournez ensuite dans le CRM pour le promouvoir admin si nécessaire.

Le bouton « Créer un utilisateur » du CRM affichera un message si l'Edge Function n'est pas déployée, avec la marche à suivre.

## Nettoyage des utilisateurs cassés existants

Si vous avez créé des utilisateurs avec l'ancienne fonction et qu'ils ne peuvent pas se connecter :

1. Dashboard Supabase → **Authentication** → **Users**.
2. Pour chaque utilisateur cassé : `...` → **Delete user**.
3. Recréez-les ensuite via le bouton CRM (ou le bouton « Add user » du dashboard).
