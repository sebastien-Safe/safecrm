-- Migration v34 — Connecteur PageSpeed Insights + table safe_connector_secrets

-- 1. Renommer seranking → pagespeed avec les bons métadonnées
UPDATE safe_connectors SET
  service_key  = 'pagespeed',
  label        = 'PageSpeed Insights',
  cat          = 'seo',
  ico          = '⚡',
  usage_desc   = 'Analyse la performance web via l''API Google Lighthouse : score de performance (0-100), Core Web Vitals (LCP, CLS, TBT), First Contentful Paint et Speed Index — pour mobile et desktop.',
  cout         = 'Gratuit — 25 000 requêtes/jour avec clé API (quota illimité sans clé)',
  donnees      = 'URL analysée et stratégie (mobile/desktop) envoyées à Google. Retour : scores Lighthouse, métriques CWV, recommandations. Aucune donnée client transmise.',
  limite       = 'Max 25 000 req/jour par clé API. Temps de réponse : 5-30s selon la charge Google. Sans clé : quota réduit mais fonctionnel.',
  doc_url      = 'https://developers.google.com/speed/docs/insights/v5/get-started',
  modules      = ARRAY['SEO'],
  is_custom    = false,
  updated_at   = now()
WHERE service_key = 'seranking';

-- 2. Table de secrets pour les clés API complètes (inaccessible côté client)
--    Seul le service_role (edge functions) peut lire cette table.
CREATE TABLE IF NOT EXISTS safe_connector_secrets (
  service_key  TEXT PRIMARY KEY,
  api_key      TEXT NOT NULL,
  updated_by   UUID REFERENCES auth.users(id),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE safe_connector_secrets ENABLE ROW LEVEL SECURITY;
-- Aucune politique SELECT pour les utilisateurs authentifiés
-- Les admins écrivent via l'edge function connector-secret-store (service_role)
