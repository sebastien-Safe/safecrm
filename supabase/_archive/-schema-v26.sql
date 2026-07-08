-- ============================================================
-- Migration v26 — Centre de connecteurs S@FE Work
-- Appliquée le 2026-06-20
-- ============================================================

CREATE TABLE IF NOT EXISTS safe_connectors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key     text NOT NULL UNIQUE,
  label           text NOT NULL,
  statut          text NOT NULL DEFAULT 'non_configure'
                  CHECK (statut IN ('non_configure','configure','actif','desactive')),
  api_key_masked  text,     -- jamais la clé en clair, seulement les 4 derniers chars
  notes           text,
  activated_by    uuid REFERENCES auth.users(id),
  activated_at    timestamptz,
  desactivated_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safe_connectors_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_key text NOT NULL,
  action        text NOT NULL,  -- 'activated','desactivated','configured','key_updated'
  done_by       uuid REFERENCES auth.users(id),
  done_at       timestamptz DEFAULT now(),
  notes         text
);

ALTER TABLE safe_connectors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE safe_connectors_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_safe_connectors"
  ON safe_connectors TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_safe_connectors_log"
  ON safe_connectors_log TO authenticated USING (true) WITH CHECK (true);
