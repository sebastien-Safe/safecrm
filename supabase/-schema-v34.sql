-- Migration v34 — Connecteur PageSpeed Insights
-- Remplace SE Ranking par l'API Google PageSpeed Insights dans les connecteurs SEO

-- Supprime l'éventuel enregistrement SE Ranking résiduel
DELETE FROM safe_connectors WHERE service_key = 'seranking';

-- Insère (ou remplace si déjà présent) le connecteur PageSpeed
INSERT INTO safe_connectors (
  service_key,
  label,
  statut,
  cat,
  ico,
  usage_desc,
  cout,
  donnees,
  limite,
  doc_url,
  modules,
  is_custom,
  updated_at
)
VALUES (
  'pagespeed',
  'PageSpeed Insights',
  'non_configure',
  'seo',
  '⚡',
  'Analyse la performance web (score Lighthouse), la vitesse de chargement mobile et les Core Web Vitals (LCP, CLS, TBT) de n''importe quelle URL.',
  'Gratuit — 25 000 requêtes/jour par clé API',
  'URL analysée, stratégie (mobile/desktop). Retour : score performance, LCP, CLS, TBT, FCP, Speed Index.',
  'Max 25 000 req/jour. Temps de réponse : 5-30s selon la charge des serveurs Google.',
  'https://developers.google.com/speed/docs/insights/v5/get-started',
  ARRAY['SEO'],
  false,
  now()
)
ON CONFLICT (service_key) DO UPDATE SET
  label      = EXCLUDED.label,
  cat        = EXCLUDED.cat,
  ico        = EXCLUDED.ico,
  usage_desc = EXCLUDED.usage_desc,
  cout       = EXCLUDED.cout,
  donnees    = EXCLUDED.donnees,
  limite     = EXCLUDED.limite,
  doc_url    = EXCLUDED.doc_url,
  modules    = EXCLUDED.modules,
  updated_at = now();
