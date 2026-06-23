-- ============================================================
-- Migration v28 — Correction RLS safe_connectors
-- Appliquée le 2026-06-23
-- Référence audit : P0-5 — RGPD Art.25, ANSSI principe de moindre privilège
-- ============================================================

-- ── safe_connectors ──────────────────────────────────────────────────────
-- Remplacement de la policy unique USING(true) WITH CHECK(true)
-- par 4 policies granulaires : SELECT ouvert, écriture admin uniquement.

DROP POLICY IF EXISTS "auth_safe_connectors" ON safe_connectors;

-- SELECT : tous les utilisateurs authentifiés
-- (requis par connectors-guard.js, modules work/)
CREATE POLICY "safe_connectors_select"
  ON safe_connectors FOR SELECT TO authenticated
  USING (true);

-- INSERT : admins uniquement
CREATE POLICY "safe_connectors_admin_insert"
  ON safe_connectors FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- UPDATE : admins uniquement
CREATE POLICY "safe_connectors_admin_update"
  ON safe_connectors FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- DELETE : admins uniquement
CREATE POLICY "safe_connectors_admin_delete"
  ON safe_connectors FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ── safe_connectors_log ───────────────────────────────────────────────────
-- Journal d'audit des connecteurs : accès restreint aux admins.

DROP POLICY IF EXISTS "auth_safe_connectors_log" ON safe_connectors_log;

-- SELECT log : admins uniquement
CREATE POLICY "safe_connectors_log_admin_select"
  ON safe_connectors_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- INSERT log : admins uniquement
CREATE POLICY "safe_connectors_log_admin_insert"
  ON safe_connectors_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
