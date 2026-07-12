-- Demandes d'exercice des droits RGPD (Art.15-22) pour les contacts internes du CRM S@FE
-- (distinct de dpo_client_demandes, qui concerne les demandeurs des clients DPO externes)

CREATE TABLE IF NOT EXISTS rgpd_demandes_droits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type_droit text NOT NULL,
  date_demande date DEFAULT CURRENT_DATE,
  date_limite date,
  statut text DEFAULT 'Reçue',
  description text,
  reponse text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE rgpd_demandes_droits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rgpd_demandes_droits_auth" ON rgpd_demandes_droits
  TO authenticated USING (true) WITH CHECK (true);
