# Archive — snapshots de schéma obsolètes

Ces fichiers `-schema-vN.sql` (v2 à v35) sont d'anciens dumps manuels du schéma,
pris à différents moments avant l'adoption d'un vrai suivi de migrations.
Ils ne reflètent **pas** l'état actuel de la base et ne doivent plus être
utilisés comme référence.

La source de vérité est désormais le dossier `supabase/supabase/migrations/`,
tenu à jour via la CLI Supabase (`supabase db pull` / `supabase migration new`).
Ces archives sont conservées uniquement à titre historique.
