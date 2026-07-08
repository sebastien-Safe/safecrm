-- =========================================================
-- S@FE CRM — Mise à jour v32
-- Éco-responsabilité des tournées de prospection
--
-- Objectif RSE : limiter l''empreinte carbone des déplacements
--   commerciaux en imposant des plafonds kilométriques selon
--   le niveau de l''utilisateur.
--
-- NIV1 (role = 'user')  : 100 km/tournée — périmètre départemental
-- NIV2 (role = 'dci')   : 200 km/tournée — périmètre régional
-- Admin (is_admin=true)  : illimité
--
-- Facteur CO₂ retenu : 120 g/km (voiture essence, ADEME 2024)
-- Plafond étapes     : 5 arrêts maximum par tournée
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- Ajouts à la table tournees
-- ─────────────────────────────────────────────────────────
ALTER TABLE tournees
  ADD COLUMN IF NOT EXISTS distance_totale_km  numeric(8,2),
  ADD COLUMN IF NOT EXISTS score_co2_kg        numeric(8,3)
    GENERATED ALWAYS AS (distance_totale_km * 0.120) STORED,
  ADD COLUMN IF NOT EXISTS nb_etapes           smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_depassee     boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_depassement   boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_etape         smallint,   -- étape de friction atteinte (1–4)
  ADD CONSTRAINT tournees_nb_etapes_max
    CHECK (nb_etapes <= 5);

-- ─────────────────────────────────────────────────────────
-- Fonction : limite kilométrique selon le rôle
-- Retourne NULL si illimité (admin)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION limite_km_tournee(user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text;
  v_is_admin boolean;
BEGIN
  SELECT role, is_admin
    INTO v_role, v_is_admin
    FROM profiles
   WHERE id = user_id;

  IF v_is_admin THEN RETURN NULL; END IF;   -- illimité
  IF v_role = 'dci'  THEN RETURN 200; END IF;
  RETURN 100;                                -- défaut NIV1 (role = 'user')
END;
$$;

GRANT EXECUTE ON FUNCTION limite_km_tournee(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────
-- Vue : bilan éco des tournées par commercial (mois courant)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW tournees_eco_bilan AS
SELECT
  t.commercial_id,
  p.prenom,
  p.nom,
  p.role,
  date_trunc('month', t.date_tournee)               AS mois,
  COUNT(*)                                           AS nb_tournees,
  SUM(t.nb_etapes)                                   AS total_etapes,
  ROUND(SUM(t.distance_totale_km), 1)               AS total_km,
  ROUND(SUM(t.score_co2_kg), 2)                     AS total_co2_kg,
  SUM(CASE WHEN t.force_depassement THEN 1 ELSE 0 END) AS nb_depassements_forces
FROM  tournees t
JOIN  profiles p ON p.id = t.commercial_id
WHERE t.statut <> 'annulée'
GROUP BY t.commercial_id, p.prenom, p.nom, p.role, date_trunc('month', t.date_tournee);

-- Accès admin uniquement
REVOKE ALL ON tournees_eco_bilan FROM PUBLIC;
GRANT  SELECT ON tournees_eco_bilan TO authenticated;
-- (filtre is_admin() à appliquer côté application)

-- ─────────────────────────────────────────────────────────
-- Index : stats éco par commercial et par mois
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tournees_eco
  ON tournees (commercial_id, date_tournee, distance_totale_km)
  WHERE distance_totale_km IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- Commentaires RGPD / RSE
-- ─────────────────────────────────────────────────────────
COMMENT ON COLUMN tournees.distance_totale_km IS
  'Distance totale calculée par le TSP (km). Base du score CO₂.';

COMMENT ON COLUMN tournees.score_co2_kg IS
  'Empreinte CO₂ estimée (kg). Calculée : distance_totale_km × 0,120 (facteur ADEME 2024, voiture essence).';

COMMENT ON COLUMN tournees.nb_etapes IS
  'Nombre d''arrêts de la tournée. Maximum 5 par contrainte éco S@FE.';

COMMENT ON COLUMN tournees.limite_depassee IS
  'True si la distance totale dépasse la limite du rôle (100 km NIV1 / 200 km NIV2).';

COMMENT ON COLUMN tournees.force_depassement IS
  'True si le commercial a explicitement forcé le dépassement après lecture des 4 étapes de sensibilisation CO₂.';
