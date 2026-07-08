-- Correction : une unité d'évaluation (QCM final noté) ne doit être validée
-- que si le temps minimal est écoulé ET le score enregistré est >= 70%.
-- Pour les unités de type "lesson" (quiz_score toujours null), la condition
-- "quiz_score is null" laisse le comportement Phase 2 initial inchangé
-- (validation par le temps seul).
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
     set unite_validee = (pu.temps_passe_sec >= pu.duree_minimale_min * 60)
                          and (pu.quiz_score is null or pu.quiz_score >= 70),
         completed_at = case when (pu.temps_passe_sec >= pu.duree_minimale_min * 60)
                                  and (pu.quiz_score is null or pu.quiz_score >= 70)
                                  and pu.completed_at is null
                              then now() else pu.completed_at end
   where pu.session_id = p_session_id and pu.unite_id = p_unite_id;

  perform dda_close_session_if_complete(p_session_id);

  return query
    select pu.temps_passe_sec, pu.unite_validee
      from dda_progression_unites pu
     where pu.session_id = p_session_id and pu.unite_id = p_unite_id;
end;
$function$;

revoke execute on function dda_heartbeat(uuid, text, int, int) from public;
revoke execute on function dda_heartbeat(uuid, text, int, int) from anon;
grant execute on function dda_heartbeat(uuid, text, int, int) to authenticated;
