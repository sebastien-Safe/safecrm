-- ============================================================================
-- Module Formation DDA — Phase 1 : fondations (schéma, sécurité, stockage)
--   - Remplace la logique cosmétique côté client de formation-tronc-commun.html
--     par un système traçable et individualisé par collaborateur.
--   - Aucune table "collaborateurs" n'existe dans ce schéma : l'entité
--     collaborateur est `public.profiles` (PK = auth.users.id). Toutes les
--     FK "collaborateur" ci-dessous pointent vers profiles(id).
--   - Rôle formateur modélisé en flag orthogonal (is_formateur), sur le
--     modèle de profiles.is_admin déjà existant : un formateur garde son
--     rôle métier (ex. resp-equipe, collab-assurances).
-- ============================================================================

-- ---------------------------------------------------------
-- 1. Rôle formateur
-- ---------------------------------------------------------
alter table profiles
  add column if not exists is_formateur boolean not null default false;

create or replace function is_formateur()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce((select is_formateur from profiles where id = auth.uid()), false);
$function$;

grant execute on function is_formateur() to authenticated;

-- ---------------------------------------------------------
-- 2. Périmètre DDA : qui est soumis à l'obligation, avec quel profil
-- ---------------------------------------------------------
create table if not exists dda_perimetre (
  id                     uuid primary key default gen_random_uuid(),
  collaborateur_id       uuid not null references profiles(id) on delete cascade,
  role_metier            text not null,
  perimetre_produits     text[] not null,
  mode_distribution      text not null check (mode_distribution in ('conseil_complet', 'prospection_amont')),
  date_entree_perimetre  date not null,
  date_sortie_perimetre  date,
  created_at             timestamptz not null default now()
);

alter table dda_perimetre enable row level security;

create index if not exists idx_dda_perimetre_collaborateur on dda_perimetre(collaborateur_id);

create policy "dda_perimetre_select" on dda_perimetre for select to authenticated
  using (collaborateur_id = auth.uid() or is_formateur());
create policy "dda_perimetre_write" on dda_perimetre for all to authenticated
  using (is_formateur()) with check (is_formateur());

-- ---------------------------------------------------------
-- 3. Programmes de formation individualisés (contenu structuré)
-- ---------------------------------------------------------
create table if not exists dda_programmes (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null,
  perimetre_cible text[] not null default '{}',
  contenu         jsonb not null,
  version         int not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table dda_programmes enable row level security;

create policy "dda_programmes_select" on dda_programmes for select to authenticated
  using (true);
create policy "dda_programmes_write" on dda_programmes for all to authenticated
  using (is_formateur()) with check (is_formateur());

-- ---------------------------------------------------------
-- 4. Assignation annuelle programme <-> collaborateur
-- ---------------------------------------------------------
create table if not exists dda_obligations (
  id                    uuid primary key default gen_random_uuid(),
  collaborateur_id      uuid not null references profiles(id) on delete cascade,
  programme_id          uuid references dda_programmes(id),
  annee_civile          int not null,
  date_entree_distribution date,
  heures_requises       numeric not null,
  heures_realisees      numeric not null default 0,
  statut                text not null default 'en_cours' check (statut in ('a_jour', 'en_cours', 'en_retard')),
  updated_at            timestamptz not null default now(),
  unique (collaborateur_id, annee_civile)
);

alter table dda_obligations enable row level security;

create index if not exists idx_dda_obligations_collaborateur on dda_obligations(collaborateur_id);

create policy "dda_obligations_select" on dda_obligations for select to authenticated
  using (collaborateur_id = auth.uid() or is_formateur());
create policy "dda_obligations_write" on dda_obligations for all to authenticated
  using (is_formateur()) with check (is_formateur());

-- ---------------------------------------------------------
-- 5. Sessions / actions de formation (interne ou externe)
-- ---------------------------------------------------------
create table if not exists dda_sessions (
  id                     uuid primary key default gen_random_uuid(),
  obligation_id          uuid not null references dda_obligations(id) on delete cascade,
  entite_formatrice      text not null,
  formateur_nom          text,
  formateur_qualification text,
  type_formation         text not null check (type_formation in ('interne', 'organisme_externe', 'intermediaire_pair')),
  modalite               text not null check (modalite in ('e_learning', 'presentiel', 'classe_virtuelle')),
  date_debut             date not null,
  date_fin               date not null,
  duree_heures           numeric not null,
  duree_effective_heures numeric,
  themes                 text[] not null,
  score_qcm              numeric,
  attestation_path       text,
  created_at             timestamptz not null default now()
);

alter table dda_sessions enable row level security;

create index if not exists idx_dda_sessions_obligation on dda_sessions(obligation_id);

create policy "dda_sessions_select" on dda_sessions for select to authenticated
  using (
    is_formateur()
    or exists (select 1 from dda_obligations o where o.id = obligation_id and o.collaborateur_id = auth.uid())
  );
create policy "dda_sessions_write" on dda_sessions for all to authenticated
  using (is_formateur()) with check (is_formateur());

-- ---------------------------------------------------------
-- 6. Progression fine par unité de contenu (base du minuteur strict, Phase 2)
-- ---------------------------------------------------------
create table if not exists dda_progression_unites (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references dda_sessions(id) on delete cascade,
  unite_id             text not null,
  duree_minimale_min   int not null,
  temps_passe_sec      int not null default 0,
  unite_validee        boolean not null default false,
  quiz_score           numeric,
  completed_at         timestamptz,
  updated_at           timestamptz not null default now(),
  unique (session_id, unite_id)
);

alter table dda_progression_unites enable row level security;

create policy "dda_progression_select" on dda_progression_unites for select to authenticated
  using (
    is_formateur()
    or exists (
      select 1 from dda_sessions s join dda_obligations o on o.id = s.obligation_id
      where s.id = session_id and o.collaborateur_id = auth.uid()
    )
  );
-- Le collaborateur peut mettre à jour SA propre progression (heartbeat, Phase 2) ;
-- le recalcul serveur du champ unite_validee sera repris par trigger/Edge Function,
-- jamais par une valeur envoyée telle quelle par le client (cf. plan mode strict).
create policy "dda_progression_collab_write" on dda_progression_unites for all to authenticated
  using (
    exists (
      select 1 from dda_sessions s join dda_obligations o on o.id = s.obligation_id
      where s.id = session_id and o.collaborateur_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from dda_sessions s join dda_obligations o on o.id = s.obligation_id
      where s.id = session_id and o.collaborateur_id = auth.uid()
    )
  );
create policy "dda_progression_formateur_write" on dda_progression_unites for all to authenticated
  using (is_formateur()) with check (is_formateur());

-- ---------------------------------------------------------
-- 7. Émargement électronique (sessions non e-learning)
--    Miroir du pattern déjà éprouvé sur `mandats` : signature dessinée +
--    vérification OTP email, plutôt qu'un champ signature_data isolé.
-- ---------------------------------------------------------
create table if not exists dda_emargements (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references dda_sessions(id) on delete cascade,
  collaborateur_id    uuid not null references profiles(id) on delete cascade,
  date_seance         date not null,
  heure_debut         time,
  heure_fin           time,
  signature_svg       text,
  otp_verified_at     timestamptz,
  signed_ip           text,
  signed_user_agent   text,
  doc_hash            text,
  created_at          timestamptz not null default now()
);

alter table dda_emargements enable row level security;

create index if not exists idx_dda_emargements_session on dda_emargements(session_id);
create index if not exists idx_dda_emargements_collaborateur on dda_emargements(collaborateur_id);

create policy "dda_emargements_select" on dda_emargements for select to authenticated
  using (collaborateur_id = auth.uid() or is_formateur());
create policy "dda_emargements_collab_write" on dda_emargements for insert to authenticated
  with check (collaborateur_id = auth.uid());
create policy "dda_emargements_formateur_write" on dda_emargements for all to authenticated
  using (is_formateur()) with check (is_formateur());

-- Généralisation de mandat_otp pour servir aussi à la signature d'émargement
-- formation, plutôt que de dupliquer un système OTP parallèle.
alter table mandat_otp
  add column if not exists contexte text not null default 'mandat';

-- ---------------------------------------------------------
-- 8. Recalcul serveur de heures_realisees / statut sur dda_obligations
--    Ne fait jamais confiance à une valeur envoyée par le client : se
--    déclenche sur les mutations de dda_sessions.duree_effective_heures.
-- ---------------------------------------------------------
create or replace function recalc_dda_obligation(p_obligation_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_heures_realisees numeric;
  v_heures_requises   numeric;
  v_annee_civile      int;
begin
  select coalesce(sum(duree_effective_heures), 0)
    into v_heures_realisees
    from dda_sessions
   where obligation_id = p_obligation_id;

  select heures_requises, annee_civile into v_heures_requises, v_annee_civile
    from dda_obligations where id = p_obligation_id;

  update dda_obligations
     set heures_realisees = v_heures_realisees,
         statut = case
           when v_heures_realisees >= v_heures_requises then 'a_jour'
           when make_date(v_annee_civile, 12, 31) < current_date then 'en_retard'
           else 'en_cours'
         end,
         updated_at = now()
   where id = p_obligation_id;
end;
$function$;

create or replace function trg_recalc_dda_obligation()
returns trigger
language plpgsql
as $function$
begin
  if TG_OP = 'DELETE' then
    perform recalc_dda_obligation(OLD.obligation_id);
    return OLD;
  end if;
  perform recalc_dda_obligation(NEW.obligation_id);
  return NEW;
end;
$function$;

drop trigger if exists dda_sessions_recalc on dda_sessions;
create trigger dda_sessions_recalc
  after insert or update of duree_effective_heures or delete on dda_sessions
  for each row execute function trg_recalc_dda_obligation();

-- ---------------------------------------------------------
-- 9. Stockage : bucket privé dédié aux pièces justificatives de formation
--    (attestations externes uploadées, PDF générés) — distinct de
--    contrats-pdf (contrats commerciaux) et avatars (photos).
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('formation-docs', 'formation-docs', false)
on conflict (id) do nothing;

create policy "formation_docs_formateur_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'formation-docs' and is_formateur())
  with check (bucket_id = 'formation-docs' and is_formateur());

create policy "formation_docs_collab_read_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'formation-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "formation_docs_collab_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'formation-docs' and (storage.foldername(name))[1] = auth.uid()::text);
