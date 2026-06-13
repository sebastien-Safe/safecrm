-- =========================================================
-- S@FE CRM — Schéma de base de données (Supabase / PostgreSQL)
-- À exécuter dans : Supabase > SQL Editor > New query > Run
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- TABLE : contacts
-- ---------------------------------------------------------
create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  nom         text not null,
  entreprise  text,
  email       text,
  telephone   text,
  adresse     text,
  activites   text[] default '{}',          -- ex: {Digitalisation,RGPD,Assurance}
  statut      text default 'Prospect' check (statut in ('Prospect','Client','Inactif')),
  source      text,                          -- ex: GBP, Bouche à oreille, Site web...
  notes       text
);

-- ---------------------------------------------------------
-- TABLE : contracts
-- ---------------------------------------------------------
create table if not exists contracts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  contact_id    uuid references contacts(id) on delete cascade,
  type          text not null,               -- ex: "Référencement Local", "DPO externe"...
  formule       text,                         -- ex: Essentiel / Boost / Prestige
  montant       numeric,
  recurrence    text default 'Ponctuel' check (recurrence in ('Ponctuel','Mensuel','Annuel')),
  date_debut    date,
  date_echeance date,
  statut        text default 'Devis envoyé' check (statut in ('Devis envoyé','Signé','En cours','Terminé','Résilié')),
  notes         text
);

-- ---------------------------------------------------------
-- TABLE : tasks
-- ---------------------------------------------------------
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  contact_id   uuid references contacts(id) on delete set null,
  contract_id  uuid references contracts(id) on delete set null,
  titre        text not null,
  description  text,
  echeance     date,
  statut       text default 'À faire' check (statut in ('À faire','En cours','Terminé')),
  priorite     text default 'Normale' check (priorite in ('Basse','Normale','Haute')),
  assigne_a    text
);

-- Index utiles
create index if not exists idx_contracts_contact on contracts(contact_id);
create index if not exists idx_tasks_contact on tasks(contact_id);
create index if not exists idx_tasks_contract on tasks(contract_id);
create index if not exists idx_tasks_echeance on tasks(echeance);

-- ---------------------------------------------------------
-- SÉCURITÉ : Row Level Security (RLS)
-- Seuls les utilisateurs authentifiés (créés dans Supabase Auth)
-- peuvent lire/écrire. Aucun accès anonyme.
-- ---------------------------------------------------------
alter table contacts  enable row level security;
alter table contracts enable row level security;
alter table tasks     enable row level security;

create policy "auth_full_access_contacts" on contacts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_full_access_contracts" on contracts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_full_access_tasks" on tasks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
