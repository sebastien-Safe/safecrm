-- =========================================================
-- S@FE CRM — Mise à jour v30
-- Google Places API — log des recherches + rate limiting
-- RGPD : seule la requête et le nombre de résultats sont
--        conservés. Les données Google ne sont JAMAIS stockées.
-- =========================================================

CREATE TABLE IF NOT EXISTS places_search_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query         text        NOT NULL,
  results_count int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index pour les requêtes de rate limiting (mois courant par user et global)
CREATE INDEX IF NOT EXISTS idx_places_logs_user_month
  ON places_search_logs (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_places_logs_month
  ON places_search_logs (created_at);

-- RLS
ALTER TABLE places_search_logs ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur voit uniquement ses propres logs
CREATE POLICY "user_read_own_places_logs"
  ON places_search_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- Seul le service role (Edge Function) peut écrire
-- Pas de policy INSERT pour authenticated → l'Edge Function écrit via service_role
