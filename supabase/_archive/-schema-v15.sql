-- =========================================================
-- S@FE CRM — Mise à jour v15
-- Suivi client : interactions + registre RGPD automatique
-- =========================================================

-- ---------------------------------------------------------
-- TABLE : interactions
-- Trace chaque échange avec un contact (appel, mail, visite)
-- Sert de base légale RGPD (preuve de relation active)
-- ---------------------------------------------------------
create table if not exists interactions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  contact_id      uuid not null references contacts(id) on delete cascade,
  type            text not null check (type in ('Téléphone','Email','Visite','Autre')),
  date            date not null default current_date,
  objet           text not null,
  contenu         text,
  suite_a_donner  text
);

create index if not exists idx_interactions_contact on interactions(contact_id);
create index if not exists idx_interactions_date    on interactions(date desc);
create index if not exists idx_interactions_created_by on interactions(created_by);

alter table interactions enable row level security;

create policy "interactions_select" on interactions for select to authenticated
  using (created_by = auth.uid() or is_admin());
create policy "interactions_insert" on interactions for insert to authenticated
  with check (created_by = auth.uid() or is_admin());
create policy "interactions_update" on interactions for update to authenticated
  using (created_by = auth.uid() or is_admin());
create policy "interactions_delete" on interactions for delete to authenticated
  using (created_by = auth.uid() or is_admin());

-- ---------------------------------------------------------
-- TABLE : rgpd_log
-- Trace chaque basculement automatique RGPD KO
-- ---------------------------------------------------------
create table if not exists rgpd_log (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references contacts(id) on delete cascade,
  bascule_at   timestamptz not null default now(),
  raison       text not null
);

create index if not exists idx_rgpd_log_contact on rgpd_log(contact_id);

alter table rgpd_log enable row level security;

create policy "rgpd_log_select" on rgpd_log for select to authenticated
  using (true);
create policy "rgpd_log_insert" on rgpd_log for insert to authenticated
  with check (true);

-- ---------------------------------------------------------
-- FONCTION : check_rgpd_expiry()
-- Bascule automatiquement les contacts en rgpd_ko = true
-- selon les délais légaux :
--   - Prospect : aucune interaction depuis 3 ans
--   - Client   : aucune interaction depuis 5 ans après
--                la fin du dernier contrat
-- Appelée manuellement depuis le frontend au login,
-- et en trigger après chaque INSERT d'interaction.
-- ---------------------------------------------------------
create or replace function check_rgpd_expiry()
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  last_interaction date;
  last_contract_end date;
  delai_depasse boolean;
  raison_basculement text;
begin
  -- Parcourir tous les contacts non encore RGPD KO
  for rec in
    select c.id, c.statut, c.created_at::date as creation_date
    from contacts c
    where c.rgpd_ko = false or c.rgpd_ko is null
  loop
    delai_depasse := false;
    raison_basculement := null;

    -- Dernière interaction connue avec ce contact
    select max(i.date) into last_interaction
    from interactions i
    where i.contact_id = rec.id;

    -- Date de référence : dernière interaction ou date de création du contact
    if last_interaction is null then
      last_interaction := rec.creation_date;
    end if;

    if rec.statut = 'Prospect' then
      -- Délai légal prospection : 3 ans sans interaction
      if last_interaction < current_date - interval '3 years' then
        delai_depasse := true;
        raison_basculement := 'Prospect sans interaction depuis plus de 3 ans (délai légal RGPD)';
      end if;

    elsif rec.statut = 'Client' then
      -- Délai légal relation commerciale : 5 ans après fin du dernier contrat
      select max(co.date_echeance) into last_contract_end
      from contracts co
      where co.contact_id = rec.id
        and co.statut in ('Terminé','Résilié');

      if last_contract_end is not null then
        -- Client avec contrat terminé : 5 ans après la fin du dernier contrat
        if last_contract_end < current_date - interval '5 years'
           and last_interaction < current_date - interval '5 years' then
          delai_depasse := true;
          raison_basculement := 'Client sans interaction depuis plus de 5 ans après fin de contrat (délai légal RGPD)';
        end if;
      else
        -- Client sans contrat terminé : 5 ans sans interaction
        if last_interaction < current_date - interval '5 years' then
          delai_depasse := true;
          raison_basculement := 'Client sans interaction depuis plus de 5 ans (délai légal RGPD)';
        end if;
      end if;

    elsif rec.statut = 'Inactif' then
      -- Inactif : même règle que prospect (3 ans)
      if last_interaction < current_date - interval '3 years' then
        delai_depasse := true;
        raison_basculement := 'Contact inactif sans interaction depuis plus de 3 ans (délai légal RGPD)';
      end if;
    end if;

    -- Basculement si délai dépassé
    if delai_depasse then
      update contacts set rgpd_ko = true where id = rec.id;
      insert into rgpd_log (contact_id, raison)
      values (rec.id, raison_basculement);
    end if;

  end loop;
end;
$$;

grant execute on function check_rgpd_expiry() to authenticated;

-- ---------------------------------------------------------
-- TRIGGER : après chaque nouvelle interaction,
-- vérifier uniquement le contact concerné (optimisé)
-- ---------------------------------------------------------
create or replace function trg_check_rgpd_on_interaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec record;
  last_interaction date;
  last_contract_end date;
  delai_depasse boolean := false;
  raison_basculement text;
begin
  select id, statut, created_at::date as creation_date
  into rec
  from contacts
  where id = NEW.contact_id and (rgpd_ko = false or rgpd_ko is null);

  if not found then return NEW; end if;

  select max(i.date) into last_interaction
  from interactions i where i.contact_id = rec.id;

  if last_interaction is null then last_interaction := rec.creation_date; end if;

  -- Une nouvelle interaction remet le compteur à zéro :
  -- si la nouvelle interaction est récente, on ne bascule pas.
  -- Ce trigger sert surtout à re-vérifier si on insère une vieille interaction.
  if NEW.date >= current_date - interval '3 years' then
    return NEW; -- interaction récente, pas de risque
  end if;

  if rec.statut = 'Prospect' or rec.statut = 'Inactif' then
    if last_interaction < current_date - interval '3 years' then
      delai_depasse := true;
      raison_basculement := 'Prospect/Inactif sans interaction depuis plus de 3 ans (délai légal RGPD)';
    end if;
  elsif rec.statut = 'Client' then
    select max(co.date_echeance) into last_contract_end
    from contracts co
    where co.contact_id = rec.id and co.statut in ('Terminé','Résilié');
    if last_interaction < current_date - interval '5 years' then
      delai_depasse := true;
      raison_basculement := 'Client sans interaction depuis plus de 5 ans (délai légal RGPD)';
    end if;
  end if;

  if delai_depasse then
    update contacts set rgpd_ko = true where id = rec.id;
    insert into rgpd_log (contact_id, raison) values (rec.id, raison_basculement);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_rgpd_on_interaction on interactions;
create trigger trg_rgpd_on_interaction
  after insert on interactions
  for each row execute function trg_check_rgpd_on_interaction();

-- ---------------------------------------------------------
-- VUE : interactions enrichies (avec nom du contact)
-- Utile pour le registre RGPD et les rapports
-- ---------------------------------------------------------
create or replace view v_interactions as
  select
    i.*,
    c.nom        as contact_nom,
    c.entreprise as contact_entreprise,
    c.statut     as contact_statut,
    c.rgpd_ko    as contact_rgpd_ko
  from interactions i
  join contacts c on c.id = i.contact_id;

grant select on v_interactions to authenticated;

