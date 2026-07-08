-- ============================================================================
-- Module Formation DDA — Phase 3 : cron d'alerte d'échéance
--   - Réutilise la table `notifications` existante (pas de table parallèle) :
--     RLS déjà en place exige is_admin(), ce qui convient puisque le seul
--     formateur (Sébastien) est super_admin.
--   - Dédup sur 7 jours glissants par obligation, en base de la notification
--     ET de l'envoi d'email, pour éviter le spam quotidien pendant 6 semaines.
--   - premier job pg_cron réellement actif du projet (l'extension existait
--     déjà mais aucun schedule() n'était enregistré).
-- ============================================================================

create extension if not exists pg_net;

create or replace function dda_check_echeances()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rec record;
  v_formateur_id uuid;
  v_is_new_week boolean;
  v_alertes jsonb := '[]'::jsonb;
begin
  for v_rec in
    select o.id, o.collaborateur_id, o.annee_civile, o.heures_requises, o.heures_realisees, o.statut,
           p.prenom, p.nom
      from dda_obligations o
      join profiles p on p.id = o.collaborateur_id
     where o.statut <> 'a_jour'
       and make_date(o.annee_civile, 12, 31) - current_date between 0 and 42
  loop
    select not exists (
      select 1 from notifications
       where type = 'dda_alert'
         and (data->>'obligation_id')::uuid = v_rec.id
         and created_at > now() - interval '7 days'
    ) into v_is_new_week;

    if v_is_new_week then
      for v_formateur_id in select id from profiles where is_formateur = true loop
        insert into notifications (user_id, type, titre, message, data)
        values (
          v_formateur_id,
          'dda_alert',
          '⏰ Échéance formation DDA',
          v_rec.prenom || ' ' || v_rec.nom || ' : ' || v_rec.heures_realisees || 'h / ' ||
            v_rec.heures_requises || 'h réalisées, à moins de 6 semaines du 31/12/' || v_rec.annee_civile || '.',
          jsonb_build_object(
            'obligation_id', v_rec.id, 'collaborateur_id', v_rec.collaborateur_id,
            'annee_civile', v_rec.annee_civile
          )
        );
      end loop;

      v_alertes := v_alertes || jsonb_build_array(jsonb_build_object(
        'nom', v_rec.prenom || ' ' || v_rec.nom,
        'heures_realisees', v_rec.heures_realisees,
        'heures_requises', v_rec.heures_requises,
        'statut', v_rec.statut,
        'jours_restants', make_date(v_rec.annee_civile, 12, 31) - current_date
      ));
    end if;
  end loop;

  if jsonb_array_length(v_alertes) > 0 then
    perform net.http_post(
      url := 'https://qdjmzietysukediqkebg.supabase.co/functions/v1/send-dda-alert-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-dda-secret', current_setting('app.dda_alert_secret', true)),
      body := jsonb_build_object('alertes', v_alertes)
    );
  end if;
end;
$function$;

revoke execute on function dda_check_echeances() from public;
revoke execute on function dda_check_echeances() from anon;
revoke execute on function dda_check_echeances() from authenticated;

select cron.schedule('dda-check-echeances', '0 7 * * *', $$select dda_check_echeances()$$);
