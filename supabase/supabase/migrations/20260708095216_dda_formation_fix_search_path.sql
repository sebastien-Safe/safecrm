create or replace function trg_recalc_dda_obligation()
returns trigger
language plpgsql
set search_path to 'public'
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
