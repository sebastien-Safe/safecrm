-- =========================================================
-- S@FE CRM — Migration v23
-- Sécurité : journal de connexion + détection d'intrusion
-- =========================================================

-- ---------------------------------------------------------
-- 1. Table login_audit
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_audit (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text        NOT NULL,
  success    boolean     NOT NULL,
  locked     boolean     NOT NULL DEFAULT false,
  ip_hint    text,
  created_at timestamptz DEFAULT now()
);

-- Index pour les requêtes admin (tri par date)
CREATE INDEX IF NOT EXISTS login_audit_created_at_idx ON login_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS login_audit_email_idx      ON login_audit (email);

-- RLS : lecture réservée aux administrateurs
ALTER TABLE login_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_audit_admin_read" ON login_audit;
CREATE POLICY "login_audit_admin_read" ON login_audit
  FOR SELECT USING (is_admin());

-- ---------------------------------------------------------
-- 2. RPC log_login_attempt (SECURITY DEFINER — accessible
--    sans session authentifiée, car appelée lors du login)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION log_login_attempt(
  p_email   text,
  p_success boolean,
  p_locked  boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text;
BEGIN
  -- Tenter de récupérer l'IP depuis les headers (Supabase Edge)
  BEGIN
    v_ip := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  INSERT INTO login_audit (email, success, locked, ip_hint)
  VALUES (p_email, p_success, p_locked, v_ip);
EXCEPTION WHEN OTHERS THEN
  NULL; -- non bloquant : une erreur de log ne doit jamais bloquer la connexion
END;
$$;

-- ---------------------------------------------------------
-- 3. Table login_alerts — alertes visibles dans le panel admin
--    Déclenchée automatiquement après 5 échecs (verrouillage)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_alerts (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text        NOT NULL,
  details    text,
  resolved   boolean     DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE login_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_alerts_admin" ON login_alerts;
CREATE POLICY "login_alerts_admin" ON login_alerts
  FOR ALL USING (is_admin());

-- ---------------------------------------------------------
-- 4. Trigger : créer une alerte admin dès qu'un verrou est posé
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION _trigger_login_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.locked = true THEN
    INSERT INTO login_alerts (email, details)
    VALUES (
      NEW.email,
      'Compte verrouillé après ' || (
        SELECT COUNT(*) FROM login_audit
        WHERE email = NEW.email
          AND success = false
          AND created_at > now() - interval '1 hour'
      ) || ' tentatives échouées en 1h — IP : ' || COALESCE(NEW.ip_hint, 'inconnue')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS login_audit_alert ON login_audit;
CREATE TRIGGER login_audit_alert
  AFTER INSERT ON login_audit
  FOR EACH ROW
  EXECUTE FUNCTION _trigger_login_alert();

-- ---------------------------------------------------------
-- 5. RPC get_login_audit — lecture admin des 50 dernières
--    tentatives (évite d'exposer la table directement au client)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_login_audit(p_limit int DEFAULT 50)
RETURNS TABLE (
  id         uuid,
  email      text,
  success    boolean,
  locked     boolean,
  ip_hint    text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;
  RETURN QUERY
    SELECT a.id, a.email, a.success, a.locked, a.ip_hint, a.created_at
    FROM login_audit a
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------
-- 6. RPC get_login_alerts — alertes non résolues pour l'admin
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_login_alerts()
RETURNS TABLE (
  id         uuid,
  email      text,
  details    text,
  resolved   boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;
  RETURN QUERY
    SELECT a.id, a.email, a.details, a.resolved, a.created_at
    FROM login_alerts a
    ORDER BY a.created_at DESC;
END;
$$;

-- ---------------------------------------------------------
-- 7. RPC resolve_login_alert — marquer une alerte résolue
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION resolve_login_alert(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;
  UPDATE login_alerts SET resolved = true WHERE id = p_id;
END;
$$;
