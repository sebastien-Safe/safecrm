# Workflow migrations — S@FE CRM

## Prérequis

```bash
npm install -g supabase
supabase login
```

## Démarrer l'environnement local

```bash
cd safecrm/supabase/supabase
supabase start          # Lance Postgres + Studio en local (Docker requis)
supabase status         # URL + clés locales
```

## Créer une nouvelle migration

```bash
supabase migration new <nom_descriptif>
# Crée migrations/YYYYMMDDHHMMSS_nom_descriptif.sql
# Écrire le SQL dans ce fichier, puis :
supabase db reset       # Rejoue toutes les migrations localement (test)
```

## Appliquer en production

```bash
supabase db push --linked
# → applique les migrations non encore exécutées sur qdjmzietysukediqkebg
```

## Vérifier l'état des migrations

```bash
supabase migration list --linked
```

## Règles

- **Ne jamais modifier** un fichier de migration déjà appliqué en production.
- **Toujours utiliser** `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (idempotence).
- **Nommer les migrations** en snake_case descriptif : `add_code_postal_profiles`, `create_table_archived_users`.
- La baseline `20240601000000_baseline.sql` représente l'état initial (v1→v29) ; ne pas la modifier.
