-- =========================================================
-- S@FE CRM — Mise à jour v33
-- Feature 1 : Suivi des établissements déjà ajoutés
-- Feature 2 : Limite Google Places dynamique par profil
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- TABLE : etablissements_cibles
-- Trace les établissements ajoutés à une tournée.
-- Sert à afficher le badge "Déjà ajouté" dans les résultats
-- de recherche SIRENE et Google Places.
-- RGPD : seul l'identifiant technique est conservé (pas de
--   données personnelles). Base légale Art.6(1)(f).
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etablissements_cibles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source     text        NOT NULL CHECK (source IN ('sirene', 'google_places')),
  identifier text        NOT NULL,  -- SIRET (SIRENE) ou place_id (Google Places)
  label      text,                  -- nom de l'établissement (aide lisibilité)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, identifier)       -- un établissement = une seule entrée globale
);

CREATE INDEX IF NOT EXISTS idx_etab_cibles_lookup
  ON etablissements_cibles (source, identifier);

CREATE INDEX IF NOT EXISTS idx_etab_cibles_user
  ON etablissements_cibles (user_id, created_at DESC);

-- RLS
ALTER TABLE etablissements_cibles ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs authentifiés voient tous les établissements
-- (comparaison globale — éviter les doublons dans toute l'organisation)
CREATE POLICY "etab_cibles_select"
  ON etablissements_cibles FOR SELECT TO authenticated
  USING (true);

-- Insertion : chaque utilisateur insère uniquement pour lui-même
CREATE POLICY "etab_cibles_insert"
  ON etablissements_cibles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────
-- Feature 2 : limite Google Places dynamique par profil
-- Valeur par défaut : 20 (comportement actuel conservé)
-- L'admin peut la modifier par utilisateur depuis la gestion
-- des comptes.
-- ─────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS limite_requetes_google_places integer NOT NULL DEFAULT 20;

COMMENT ON COLUMN profiles.limite_requetes_google_places IS
  'Quota mensuel de recherches Google Places pour cet utilisateur. Défaut : 20. Modifiable par l''administrateur.';

COMMENT ON TABLE etablissements_cibles IS
  'Établissements ajoutés à une tournée (SIRET ou place_id). Permet d''afficher le badge "Déjà ajouté" lors des recherches. Base légale RGPD : Art.6(1)(f) intérêt légitime.';

-- ─────────────────────────────────────────────────────────
-- Mise à jour de admin_list_users pour exposer
-- limite_requetes_google_places à l'interface d'administration
-- ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS admin_list_users();
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
  id                             uuid,
  email                          text,
  prenom                         text,
  nom                            text,
  telephone                      text,
  adresse                        text,
  siret                          text,
  rcpro_numero                   text,
  numero_mandat                  text,
  role                           text,
  is_admin                       boolean,
  profil_completed               boolean,
  profil_revocation_flag         boolean,
  dci_parent_id                  uuid,
  region                         text,
  banned_until                   timestamptz,
  created_at                     timestamptz,
  limite_requetes_google_places  integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : super-administrateur uniquement.';
  END IF;

  RETURN QUERY
    SELECT
      u.id,
      u.email::text,
      p.prenom,
      p.nom,
      p.telephone,
      p.adresse,
      p.siret,
      p.rcpro_numero,
      p.numero_mandat,
      p.role,
      COALESCE(p.is_admin, false)              AS is_admin,
      COALESCE(p.profil_completed, false)      AS profil_completed,
      COALESCE(p.profil_revocation_flag, false) AS profil_revocation_flag,
      p.dci_parent_id,
      p.region,
      u.banned_until,
      u.created_at,
      COALESCE(p.limite_requetes_google_places, 20) AS limite_requetes_google_places
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated;
