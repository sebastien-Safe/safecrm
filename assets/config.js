// =========================================================
// Configuration Supabase — S@FE CRM
// =========================================================
// 1. Créez un projet gratuit sur https://supabase.com
// 2. Allez dans : Project Settings (⚙️) > API Keys (ou bouton "Connect")
// 3. Copiez "Project URL" et la clé publique :
//    - "Publishable key" (sb_publishable_...) sur les projets récents, OU
//    - "anon / public" (eyJ...) sous l'onglet "Legacy API Keys" sur les
//      projets plus anciens
// 4. Collez les deux valeurs ci-dessous
//
// Cette clé est conçue pour être publique (elle est protégée par les
// règles RLS définies dans supabase-schema.sql) : seuls les comptes
// utilisateurs créés dans Authentication > Users pourront se connecter
// et voir les données.
//
// ⚠️ Ne mettez JAMAIS ici la "secret key" / "service_role key" : elle
// donne un accès administrateur complet et ne doit jamais figurer dans
// du code public (GitHub, site déployé, etc.).
// =========================================================

const SUPABASE_URL = "https://qdjmzietysukediqkebg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_G1vRTrnTnUdYNOwm3QifRg_gV5E8BML";
