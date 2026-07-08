-- ============================================================
-- S@FE CRM — Migration v25 : Module DPO Clients
-- Suivi de la conformité RGPD des clients S@FE
-- Appliqué via Supabase MCP le 2026-06-20
-- ============================================================

-- 1. Profil DPO par client (1 ligne par contact)
CREATE TABLE IF NOT EXISTS dpo_client_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  score_global int DEFAULT 0,
  score_traitements int DEFAULT 0,
  score_consentements int DEFAULT 0,
  score_documents int DEFAULT 0,
  score_sous_traitants int DEFAULT 0,
  score_procedures int DEFAULT 0,
  score_audit int DEFAULT 0,
  responsable_dpo text,
  notes text,
  last_audit_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(contact_id)
);
ALTER TABLE dpo_client_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_profiles_auth" ON dpo_client_profiles
  TO authenticated USING (true) WITH CHECK (true);

-- 2. Registre des traitements par client (Art.30 RGPD)
CREATE TABLE IF NOT EXISTS dpo_client_traitements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  nom text NOT NULL,
  finalite text,
  base_legale text DEFAULT 'Consentement (Art.6.1.a)',
  categories_donnees text[] DEFAULT '{}',
  duree_conservation text,
  responsable_traitement text,
  sous_traitants text[] DEFAULT '{}',
  statut text DEFAULT 'Actif',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dpo_client_traitements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_traitements_auth" ON dpo_client_traitements
  TO authenticated USING (true) WITH CHECK (true);

-- 3. Consentements (email, SMS, marketing, formulaire)
CREATE TABLE IF NOT EXISTS dpo_client_consentements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type_consentement text NOT NULL,
  statut text DEFAULT 'actif',
  date_obtention date DEFAULT CURRENT_DATE,
  source text,
  date_retrait date,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE dpo_client_consentements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_consentements_auth" ON dpo_client_consentements
  TO authenticated USING (true) WITH CHECK (true);

-- 4. Demandes d'exercice des droits (Art.15-22 RGPD)
CREATE TABLE IF NOT EXISTS dpo_client_demandes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  demandeur_nom text NOT NULL,
  demandeur_email text,
  type_droit text NOT NULL,
  date_demande date DEFAULT CURRENT_DATE,
  date_limite date,          -- calculé : date_demande + 30 jours
  statut text DEFAULT 'Reçue',
  description text,
  reponse text,
  historique jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dpo_client_demandes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_demandes_auth" ON dpo_client_demandes
  TO authenticated USING (true) WITH CHECK (true);

-- 5. Bibliothèque documentaire RGPD par client
CREATE TABLE IF NOT EXISTS dpo_client_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type_document text NOT NULL,
  titre text NOT NULL,
  contenu text,
  version int DEFAULT 1,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dpo_client_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_documents_auth" ON dpo_client_documents
  TO authenticated USING (true) WITH CHECK (true);

-- 6. Violations de données par client
CREATE TABLE IF NOT EXISTS dpo_client_violations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  date_incident date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  niveau_gravite text DEFAULT 'modéré',
  categories_donnees text[] DEFAULT '{}',
  nb_personnes_concernees int,
  actions_correctives text,
  statut text DEFAULT 'ouvert',
  cloture_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dpo_client_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_violations_auth" ON dpo_client_violations
  TO authenticated USING (true) WITH CHECK (true);

-- 7. Items d'audit automatique par client
CREATE TABLE IF NOT EXISTS dpo_client_audit_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  categorie text NOT NULL,
  item text NOT NULL,
  statut text DEFAULT 'action_requise',
  note text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dpo_client_audit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_client_audit_items_auth" ON dpo_client_audit_items
  TO authenticated USING (true) WITH CHECK (true);
