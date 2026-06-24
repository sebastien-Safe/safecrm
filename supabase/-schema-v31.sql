-- =========================================================
-- S@FE CRM — Mise à jour v31
-- Tournées de prospection intégrées à l'agenda
--
-- RGPD / Base légale : Art. 6(1)(f) — intérêt légitime
--   (organisation commerciale interne, données B2B publiques)
-- Durée de conservation : 1 an (expires_at)
-- Données Google Places stockées : nom entreprise, adresse,
--   lat/lng uniquement (données publiques). Aucune donnée
--   personnelle issue de Google Places n'est stockée.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- TABLE : tournees
-- Une tournée = une feuille de route pour une journée
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournees (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Planification
  date_tournee     date        NOT NULL,
  heure_depart     time        NOT NULL DEFAULT '09:00',
  adresse_depart   text        NOT NULL,
  lat_depart       numeric(10,7),
  lng_depart       numeric(10,7),
  heure_retour_est time,                         -- calculée par le TSP

  -- Cycle de vie
  statut           text        NOT NULL DEFAULT 'planifiée'
                   CHECK (statut IN ('planifiée','en_cours','terminée','annulée')),

  -- RGPD — purge automatique après 1 an
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT now() + interval '1 year'
);

-- ─────────────────────────────────────────────────────────
-- TABLE : tournee_etapes
-- Chaque arrêt de la tournée (ordonné, numéroté)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournee_etapes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournee_id     uuid        NOT NULL REFERENCES tournees(id) ON DELETE CASCADE,

  -- Ordre de visite
  ordre          smallint    NOT NULL CHECK (ordre >= 1),

  -- Lieu (données publiques B2B — non personnelles sauf auto-entrepreneur)
  label          text        NOT NULL,       -- nom de l'entreprise
  adresse        text,
  lat            numeric(10,7),
  lng            numeric(10,7),
  heure_estimee  time,
  duree_min      smallint    NOT NULL DEFAULT 60,

  -- Lien CRM optionnel (NULL pour cibles Google Places / SIRENE non qualifiées)
  -- Renseigné uniquement APRÈS obtention du consentement
  contact_id     uuid        REFERENCES contacts(id) ON DELETE SET NULL,

  -- Traçabilité source (RGPD — savoir d'où vient chaque étape)
  source         text        NOT NULL DEFAULT 'crm'
                 CHECK (source IN ('crm','sirene','google_places')),

  -- Suivi terrain
  visitee        boolean     NOT NULL DEFAULT false,
  notes          text,                       -- notes post-visite libres
                                             -- ⚠️ ne pas y copier de données Google

  created_at     timestamptz NOT NULL DEFAULT now(),

  -- Unicité de l'ordre dans une tournée
  UNIQUE (tournee_id, ordre)
);

-- ─────────────────────────────────────────────────────────
-- INDEX
-- ─────────────────────────────────────────────────────────

-- Chargement agenda : tournées d'un commercial par date
CREATE INDEX IF NOT EXISTS idx_tournees_commercial_date
  ON tournees (commercial_id, date_tournee);

-- Chargement agenda admin : toutes les tournées par date
CREATE INDEX IF NOT EXISTS idx_tournees_date
  ON tournees (date_tournee);

-- Étapes d'une tournée dans l'ordre
CREATE INDEX IF NOT EXISTS idx_etapes_tournee_ordre
  ON tournee_etapes (tournee_id, ordre);

-- Retrouver les tournées liées à un contact
CREATE INDEX IF NOT EXISTS idx_etapes_contact
  ON tournee_etapes (contact_id)
  WHERE contact_id IS NOT NULL;

-- Purge RGPD : identifier les tournées expirées rapidement
CREATE INDEX IF NOT EXISTS idx_tournees_expires
  ON tournees (expires_at);

-- ─────────────────────────────────────────────────────────
-- RLS — Row Level Security
-- Chaque commercial ne voit que SES tournées
-- L'admin voit tout
-- ─────────────────────────────────────────────────────────
ALTER TABLE tournees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournee_etapes ENABLE ROW LEVEL SECURITY;

-- tournees : lecture
CREATE POLICY "tournees_select" ON tournees
  FOR SELECT TO authenticated
  USING (commercial_id = auth.uid() OR is_admin());

-- tournees : création (le commercial ne peut créer que pour lui-même)
CREATE POLICY "tournees_insert" ON tournees
  FOR INSERT TO authenticated
  WITH CHECK (commercial_id = auth.uid());

-- tournees : mise à jour (statut, notes…)
CREATE POLICY "tournees_update" ON tournees
  FOR UPDATE TO authenticated
  USING  (commercial_id = auth.uid() OR is_admin())
  WITH CHECK (commercial_id = auth.uid() OR is_admin());

-- tournees : suppression (commercial peut supprimer les siennes, admin toutes)
CREATE POLICY "tournees_delete" ON tournees
  FOR DELETE TO authenticated
  USING (commercial_id = auth.uid() OR is_admin());

-- tournee_etapes : accès hérité de la tournée parente (pas de check direct user)
CREATE POLICY "etapes_select" ON tournee_etapes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournees t
      WHERE t.id = tournee_etapes.tournee_id
        AND (t.commercial_id = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "etapes_insert" ON tournee_etapes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournees t
      WHERE t.id = tournee_etapes.tournee_id
        AND t.commercial_id = auth.uid()
    )
  );

CREATE POLICY "etapes_update" ON tournee_etapes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournees t
      WHERE t.id = tournee_etapes.tournee_id
        AND (t.commercial_id = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "etapes_delete" ON tournee_etapes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournees t
      WHERE t.id = tournee_etapes.tournee_id
        AND (t.commercial_id = auth.uid() OR is_admin())
    )
  );

-- ─────────────────────────────────────────────────────────
-- PURGE RGPD — Suppression des tournées expirées
-- À appeler manuellement depuis la console admin
-- ou via un cron Supabase (pg_cron)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION purge_expired_tournees()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  -- Les étapes sont supprimées en cascade (ON DELETE CASCADE)
  DELETE FROM tournees WHERE expires_at < now();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- Seuls les admins peuvent appeler la purge
REVOKE ALL ON FUNCTION purge_expired_tournees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_tournees() TO authenticated;
-- (is_admin() vérifié côté appelant dans l'interface admin)

-- ─────────────────────────────────────────────────────────
-- COMMENTAIRES RGPD — Documentation inline
-- ─────────────────────────────────────────────────────────
COMMENT ON TABLE tournees IS
  'Tournées de prospection terrain. Base légale : Art.6(1)(f) RGPD — intérêt légitime. Conservation : 1 an (expires_at). Données publiques B2B uniquement.';

COMMENT ON TABLE tournee_etapes IS
  'Étapes d'une tournée. label + adresse = données publiques entreprise. contact_id renseigné UNIQUEMENT après consentement. source = traçabilité origine (crm/sirene/google_places).';

COMMENT ON COLUMN tournee_etapes.contact_id IS
  'NULL tant que le consentement n'est pas obtenu. Lien créé manuellement après la visite.';

COMMENT ON COLUMN tournee_etapes.notes IS
  'Notes libres post-visite. Ne pas y copier de données issues de Google Places (obligation CGU EEE).';

COMMENT ON COLUMN tournee_etapes.source IS
  'Traçabilité RGPD : crm = contact Supabase existant, sirene = API data.gouv.fr, google_places = Google Maps Places API.';
