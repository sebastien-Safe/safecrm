-- ============================================================
-- S@FE CRM — Schema v27 : TOTP audit + Access log RGPD
-- Art.42 RGPD / Critères CNIL — Phase 1 sécurité
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- TABLE : totp_audit
-- Journal des événements TOTP (enrollment, verify, cancel)
-- Alimenté par challengeTOTPIfNeeded() côté client
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS totp_audit (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event      TEXT        NOT NULL,
  -- event IN: enrollment_required | enrollment_ok | verify_ok | verify_ok_aal
  --           verify_fail | challenge_cancelled
  role       TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE totp_audit ENABLE ROW LEVEL SECURITY;

-- Seuls les super_admin peuvent lire — insertion via RLS SECURITY DEFINER function
CREATE POLICY "totp_audit_read_super_admin"
  ON totp_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- INSERT autorisé à l'utilisateur connecté pour son propre user_id
CREATE POLICY "totp_audit_insert_self"
  ON totp_audit FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);


-- ──────────────────────────────────────────────────────────
-- TABLE : audit_access_log
-- Trail des accès aux logs d'audit (DPO / admin)
-- Art.32 RGPD — traçabilité des accès aux données sensibles
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_access_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  accessed_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  accessed_role  TEXT,
  accessed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  table_accessed TEXT,
  rows_count     INT,
  reason_code    TEXT,
  ip_address     INET,
  file_hash      TEXT
);

ALTER TABLE audit_access_log ENABLE ROW LEVEL SECURITY;

-- Seuls les utilisateurs avec rôle super_admin ou admin_candy (= DPO) peuvent lire
CREATE POLICY "audit_access_log_read_dpo"
  ON audit_access_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin_candy')
    )
  );

-- INSERT autorisé à l'utilisateur connecté
CREATE POLICY "audit_access_log_insert_self"
  ON audit_access_log FOR INSERT
  WITH CHECK (accessed_by = auth.uid());


-- ──────────────────────────────────────────────────────────
-- Index pour performances (recherche par user + date)
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_totp_audit_user_id     ON totp_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_totp_audit_created_at  ON totp_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_accessed_by        ON audit_access_log(accessed_by);
CREATE INDEX IF NOT EXISTS idx_aal_accessed_at        ON audit_access_log(accessed_at DESC);
