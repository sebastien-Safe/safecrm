-- ============================================================================
-- Module Formation DDA — Phase 2 : RPC pour le flux e-learning collaborateur
--   - dda_sessions reste en écriture réservée à is_formateur() (Phase 1) :
--     ces 3 fonctions permettent au collaborateur de créer/faire progresser/
--     clôturer SA PROPRE session e-learning sans élargir les policies RLS.
--   - Aucune valeur de temps envoyée par le client n'est prise telle quelle :
--     dda_heartbeat clampe le delta à 40s max par appel.
-- ============================================================================

create or replace function dda_start_session(p_annee int)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_obligation_id uuid;
  v_programme_id uuid;
  v_session_id uuid;
  v_duree_heures numeric;
begin
  select id, programme_id into v_obligation_id, v_programme_id
    from dda_obligations
   where collaborateur_id = auth.uid() and annee_civile = p_annee;

  if v_obligation_id is null then
    raise exception 'Aucune obligation de formation % pour cet utilisateur', p_annee;
  end if;

  select id into v_session_id
    from dda_sessions
   where obligation_id = v_obligation_id
     and modalite = 'e_learning'
     and duree_effective_heures is null
   order by created_at desc
   limit 1;

  if v_session_id is not null then
    return v_session_id;
  end if;

  select coalesce(sum((sec->>'duree_minimale_min')::numeric), 0) / 60.0
    into v_duree_heures
    from dda_programmes p, jsonb_array_elements(p.contenu->'sections') sec
   where p.id = v_programme_id;

  insert into dda_sessions (
    obligation_id, entite_formatrice, type_formation, modalite,
    date_debut, date_fin, duree_heures, themes
  ) values (
    v_obligation_id, 'S@FE SASU — auto-formation e-learning', 'interne', 'e_learning',
    current_date, current_date, coalesce(v_duree_heures, 0), '{}'
  ) returning id into v_session_id;

  return v_session_id;
end;
$function$;

create or replace function dda_close_session_if_complete(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_collaborateur_id uuid;
  v_programme_id uuid;
  v_total_units int;
  v_validated_units int;
  v_done_hours numeric;
begin
  select o.collaborateur_id, o.programme_id
    into v_collaborateur_id, v_programme_id
    from dda_sessions s join dda_obligations o on o.id = s.obligation_id
   where s.id = p_session_id;

  if v_collaborateur_id is null or v_collaborateur_id <> auth.uid() then
    return;
  end if;

  select count(*) into v_total_units
    from dda_programmes p, jsonb_array_elements(p.contenu->'sections') sec
   where p.id = v_programme_id and sec->>'kind' in ('lesson', 'evaluation');

  select count(*) into v_validated_units
    from dda_progression_unites
   where session_id = p_session_id and unite_validee = true;

  if v_total_units > 0 and v_validated_units >= v_total_units then
    select coalesce(sum(temps_passe_sec), 0) / 3600.0 into v_done_hours
      from dda_progression_unites where session_id = p_session_id;

    update dda_sessions
       set duree_effective_heures = round(v_done_hours::numeric, 2),
           date_fin = current_date
     where id = p_session_id;
  end if;
end;
$function$;

create or replace function dda_heartbeat(
  p_session_id uuid, p_unite_id text, p_duree_minimale_min int, p_delta_sec int
)
returns table(temps_passe_sec int, unite_validee boolean)
language plpgsql
set search_path to 'public'
as $function$
declare
  v_delta int := least(greatest(p_delta_sec, 0), 40);
begin
  insert into dda_progression_unites (session_id, unite_id, duree_minimale_min, temps_passe_sec)
  values (p_session_id, p_unite_id, p_duree_minimale_min, v_delta)
  on conflict (session_id, unite_id) do update
    set temps_passe_sec = dda_progression_unites.temps_passe_sec + v_delta,
        duree_minimale_min = greatest(dda_progression_unites.duree_minimale_min, excluded.duree_minimale_min),
        updated_at = now();

  update dda_progression_unites pu
     set unite_validee = (pu.temps_passe_sec >= pu.duree_minimale_min * 60),
         completed_at = case when pu.temps_passe_sec >= pu.duree_minimale_min * 60 and pu.completed_at is null
                              then now() else pu.completed_at end
   where pu.session_id = p_session_id and pu.unite_id = p_unite_id;

  perform dda_close_session_if_complete(p_session_id);

  return query
    select pu.temps_passe_sec, pu.unite_validee
      from dda_progression_unites pu
     where pu.session_id = p_session_id and pu.unite_id = p_unite_id;
end;
$function$;

-- Verrouillage des privilèges (le schéma public a un ALTER DEFAULT PRIVILEGES
-- qui accorde EXECUTE à anon par défaut — leçon de la Phase 1, corrigée dès
-- la création cette fois plutôt qu'en migration de suivi).
revoke execute on function dda_start_session(int) from public;
revoke execute on function dda_start_session(int) from anon;
grant execute on function dda_start_session(int) to authenticated;

revoke execute on function dda_close_session_if_complete(uuid) from public;
revoke execute on function dda_close_session_if_complete(uuid) from anon;
grant execute on function dda_close_session_if_complete(uuid) to authenticated;

revoke execute on function dda_heartbeat(uuid, text, int, int) from public;
revoke execute on function dda_heartbeat(uuid, text, int, int) from anon;
grant execute on function dda_heartbeat(uuid, text, int, int) to authenticated;
