-- Cache d'enrichissement entreprise (SIREN, CA, effectif, domaine) pour le module
-- Prospection terrain — export XLS. Clé = siren, réutilisé tant que < 90 jours pour
-- éviter de repayer les recherches Google Custom Search / Anthropic à chaque export.

create table if not exists entreprise_enrichissement_cache (
  siren                 text primary key,
  denomination          text,
  chiffre_affaires      text,
  chiffre_affaires_src  text,   -- 'sirene' | 'web'
  effectif_reel         text,
  effectif_tranche      text,
  nom_domaine           text,
  confiance             text,  -- 'haute' | 'moyenne' | 'faible'
  updated_at            timestamptz not null default now()
);

alter table entreprise_enrichissement_cache enable row level security;

create policy "authenticated_read_enrichissement"
  on entreprise_enrichissement_cache
  for select
  to authenticated
  using (true);
