-- =========================================================
-- S@FE CRM — Migration v24
-- Sécurité : tables pour l'Edge Function record-login-failure
-- =========================================================

-- ---------------------------------------------------------
-- 1. Table rate_limits — anti-abus par IP (1h glissante)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  action     text        PRIMARY KEY,
  count      int         NOT NULL DEFAULT 0,
  window_at  timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Aucun accès direct côté client (tout passe par Edge Function service_role)
DROP POLICY IF EXISTS "rate_limits_deny_all" ON rate_limits;
CREATE POLICY "rate_limits_deny_all" ON rate_limits
  FOR ALL USING (false);

-- ---------------------------------------------------------
-- 2. Table login_attempts — compteur d'échecs par email
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  email           text        PRIMARY KEY,
  attempts        int         NOT NULL DEFAULT 0,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at       timestamptz
);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Lecture admin uniquement
DROP POLICY IF EXISTS "login_attempts_admin_read" ON login_attempts;
CREATE POLICY "login_attempts_admin_read" ON login_attempts
  FOR SELECT USING (is_admin());

-- Aucune écriture directe côté client (tout passe par Edge Function service_role)
DROP POLICY IF EXISTS "login_attempts_deny_write" ON login_attempts;
CREATE POLICY "login_attempts_deny_write" ON login_attempts
  FOR ALL USING (false);

-- Index pour les requêtes admin
CREATE INDEX IF NOT EXISTS login_attempts_locked_idx ON login_attempts (locked_at DESC NULLS LAST);

-- ---------------------------------------------------------
-- 3. RPC reset_login_attempts — déblocage manuel par l'admin
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION reset_login_attempts(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;

  -- Réinitialiser le compteur
  UPDATE login_attempts
  SET attempts = 0, locked_at = NULL, last_attempt_at = now()
  WHERE email = user_email;

  -- Lever le ban Supabase Auth via la vue auth.users (si accessible)
  -- Note : le vrai déblocage se fait via l'Edge Function ou le dashboard Supabase
  -- car ban_duration nécessite service_role
  DELETE FROM login_attempts WHERE email = user_email AND attempts = 0;

  -- Journaliser l'action admin
  BEGIN
    INSERT INTO login_audit (email, success, locked, ip_hint)
    VALUES (user_email, true, false, 'admin_reset');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- ---------------------------------------------------------
-- 4. Nettoyage automatique — purge hebdomadaire des vieux logs
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_security_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garder 90 jours de login_audit
  DELETE FROM login_audit WHERE created_at < now() - interval '90 days';
  -- Purger les rate_limits d'hier
  DELETE FROM rate_limits WHERE window_at < now() - interval '2 hours';
  -- Purger les tentatives débloquées depuis plus de 24h
  DELETE FROM login_attempts WHERE locked_at IS NULL AND last_attempt_at < now() - interval '24 hours';
END;
$$;
