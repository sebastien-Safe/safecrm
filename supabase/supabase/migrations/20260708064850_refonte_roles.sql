-- ============================================================================
-- Refonte du système de rôles S@FE CRM
--   - Renommage : user -> collab-digitalisation, dci -> resp-equipe,
--                 admin_candy -> collab-assurances (super_admin inchangé)
--   - collab-assurances devient un rôle métier pur (module Assurance à venir
--     + prospection terrain), sans droits d'administration globale
--   - resp-equipe : prospection terrain + suivi de son équipe uniquement
--   - Seul super_admin garde l'accès aux modules SEO/DPO/Click&Collect/Cyber
--     et à l'administration globale (auparavant ouverts à tout utilisateur
--     authentifié ou à admin_candy)
-- ============================================================================

-- 1. Contrainte CHECK levée avant la migration des données (elle interdirait
--    sinon les nouvelles valeurs de rôle pendant l'UPDATE ci-dessous)
alter table public.profiles drop constraint if exists profiles_role_check;

-- 2. Renommage des valeurs existantes en base
-- (trigger anti-escalade de privilèges désactivé temporairement : cette migration
--  s'exécute hors contexte utilisateur authentifié, donc is_admin() renverrait false)
alter table public.profiles disable trigger profiles_protect_admin_fields;

update public.profiles set role = 'resp-equipe' where role = 'dci';
update public.profiles set role = 'collab-digitalisation' where role = 'user';
update public.profiles set role = 'collab-assurances' where role = 'admin_candy';

alter table public.profiles enable trigger profiles_protect_admin_fields;

-- 3. Nouvelle contrainte CHECK et valeur par défaut sur profiles.role
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['collab-digitalisation'::text, 'resp-equipe'::text, 'collab-assurances'::text, 'super_admin'::text]));

alter table public.profiles alter column role set default 'collab-digitalisation';

-- 3. Fonction utilitaire is_super_admin() (nouvelle)
create or replace function public.is_super_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce((select role = 'super_admin' from profiles where id = auth.uid()), false);
$function$;

grant execute on function public.is_super_admin() to authenticated;

-- 4. is_dci() -> vérifie désormais le rôle resp-equipe (nom de fonction conservé,
--    utilisé par de nombreuses policies existantes : contacts_select, contracts_select, etc.)
CREATE OR REPLACE FUNCTION public.is_dci()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role = 'resp-equipe' FROM profiles WHERE id = auth.uid()),
    false
  );
$function$;

-- 5. get_my_role() -> valeur par défaut alignée sur le nouveau rôle de base
CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_role text;
begin
  select role into v_role from profiles where id = auth.uid();
  return coalesce(v_role, 'collab-digitalisation');
end;
$function$;

-- 6. limite_km_tournee() -> 'dci' -> 'resp-equipe'
CREATE OR REPLACE FUNCTION public.limite_km_tournee(user_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role     text;
  v_is_admin boolean;
BEGIN
  SELECT role, is_admin
    INTO v_role, v_is_admin
    FROM profiles
   WHERE id = user_id;

  IF v_is_admin THEN RETURN NULL; END IF;   -- illimité
  IF v_role = 'resp-equipe' THEN RETURN 200; END IF;
  RETURN 100;                                -- défaut (role = 'collab-digitalisation')
END;
$function$;

-- 7. flag_profils_incomplets() -> 'user','dci' -> 'collab-digitalisation','resp-equipe'
CREATE OR REPLACE FUNCTION public.flag_profils_incomplets()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update profiles
  set profil_revocation_flag = true
  where not profil_completed
    and profil_alerte_at is not null
    and profil_alerte_at < now() - interval '2 days'
    and profil_revocation_flag = false
    and role in ('collab-digitalisation','resp-equipe');
end;
$function$;

-- 8. Policy DPO (audit_access_log) réservée désormais à super_admin uniquement
drop policy if exists "audit_access_log_read_dpo" on "public"."audit_access_log";
create policy "audit_access_log_read_dpo"
  on "public"."audit_access_log"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1 FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text)))));

-- ============================================================================
-- 9. Restriction des modules métier (SEO / DPO / Click&Collect / Cyber / Social)
--    à super_admin uniquement (auparavant ouverts à tout utilisateur authentifié
--    ou limités à la seule propriété des lignes, sans distinction de rôle)
-- ============================================================================

drop policy if exists "cc_profiles_auth" on "public"."cc_client_profiles";
create policy "cc_profiles_auth"
  on "public"."cc_client_profiles"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "cc_produits_auth" on "public"."cc_produits";
create policy "cc_produits_auth"
  on "public"."cc_produits"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "auth_cyber_incidents" on "public"."cyber_client_incidents";
create policy "auth_cyber_incidents"
  on "public"."cyber_client_incidents"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "auth_cyber_plan" on "public"."cyber_client_plan";
create policy "auth_cyber_plan"
  on "public"."cyber_client_plan"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "auth_cyber_profiles" on "public"."cyber_client_profiles";
create policy "auth_cyber_profiles"
  on "public"."cyber_client_profiles"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "dpo_client_audit_items_auth" on "public"."dpo_client_audit_items";
create policy "dpo_client_audit_items_auth"
  on "public"."dpo_client_audit_items"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "dpo_client_consentements_auth" on "public"."dpo_client_consentements";
create policy "dpo_client_consentements_auth"
  on "public"."dpo_client_consentements"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "dpo_client_demandes_auth" on "public"."dpo_client_demandes";
create policy "dpo_client_demandes_auth"
  on "public"."dpo_client_demandes"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "dpo_client_documents_auth" on "public"."dpo_client_documents";
create policy "dpo_client_documents_auth"
  on "public"."dpo_client_documents"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "dpo_client_profiles_auth" on "public"."dpo_client_profiles";
create policy "dpo_client_profiles_auth"
  on "public"."dpo_client_profiles"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "dpo_client_traitements_auth" on "public"."dpo_client_traitements";
create policy "dpo_client_traitements_auth"
  on "public"."dpo_client_traitements"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "dpo_client_violations_auth" on "public"."dpo_client_violations";
create policy "dpo_client_violations_auth"
  on "public"."dpo_client_violations"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "auth_seo_audits" on "public"."seo_client_audits";
create policy "auth_seo_audits"
  on "public"."seo_client_audits"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "auth_seo_mots_cles" on "public"."seo_client_mots_cles";
create policy "auth_seo_mots_cles"
  on "public"."seo_client_mots_cles"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "auth_seo_profiles" on "public"."seo_client_profiles";
create policy "auth_seo_profiles"
  on "public"."seo_client_profiles"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "auth_all" on "public"."seo_domaines";
create policy "auth_all"
  on "public"."seo_domaines"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "social_profiles_auth" on "public"."social_client_profiles";
create policy "social_profiles_auth"
  on "public"."social_client_profiles"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "social_posts_auth" on "public"."social_posts";
create policy "social_posts_auth"
  on "public"."social_posts"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());


drop policy if exists "Insertion propre" on "public"."cyber_audits";
create policy "Insertion propre"
  on "public"."cyber_audits"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "Lecture propre" on "public"."cyber_audits";
create policy "Lecture propre"
  on "public"."cyber_audits"
  as permissive
  for select
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "Mise à jour propre" on "public"."cyber_audits";
create policy "Mise à jour propre"
  on "public"."cyber_audits"
  as permissive
  for update
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "Suppression propre" on "public"."cyber_audits";
create policy "Suppression propre"
  on "public"."cyber_audits"
  as permissive
  for delete
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "auth_cyber_audits" on "public"."cyber_client_audits";
create policy "auth_cyber_audits"
  on "public"."cyber_client_audits"
  as permissive
  for all
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()))
with check (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "del_dpo_aipd" on "public"."dpo_aipd";
create policy "del_dpo_aipd"
  on "public"."dpo_aipd"
  as permissive
  for delete
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "ins_dpo_aipd" on "public"."dpo_aipd";
create policy "ins_dpo_aipd"
  on "public"."dpo_aipd"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "sel_dpo_aipd" on "public"."dpo_aipd";
create policy "sel_dpo_aipd"
  on "public"."dpo_aipd"
  as permissive
  for select
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "upd_dpo_aipd" on "public"."dpo_aipd";
create policy "upd_dpo_aipd"
  on "public"."dpo_aipd"
  as permissive
  for update
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "del_dpo_der" on "public"."dpo_der";
create policy "del_dpo_der"
  on "public"."dpo_der"
  as permissive
  for delete
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "ins_dpo_der" on "public"."dpo_der";
create policy "ins_dpo_der"
  on "public"."dpo_der"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "sel_dpo_der" on "public"."dpo_der";
create policy "sel_dpo_der"
  on "public"."dpo_der"
  as permissive
  for select
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "upd_dpo_der" on "public"."dpo_der";
create policy "upd_dpo_der"
  on "public"."dpo_der"
  as permissive
  for update
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "del_dpo_traitements" on "public"."dpo_traitements";
create policy "del_dpo_traitements"
  on "public"."dpo_traitements"
  as permissive
  for delete
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "ins_dpo_traitements" on "public"."dpo_traitements";
create policy "ins_dpo_traitements"
  on "public"."dpo_traitements"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "sel_dpo_traitements" on "public"."dpo_traitements";
create policy "sel_dpo_traitements"
  on "public"."dpo_traitements"
  as permissive
  for select
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "upd_dpo_traitements" on "public"."dpo_traitements";
create policy "upd_dpo_traitements"
  on "public"."dpo_traitements"
  as permissive
  for update
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "del_dpo_violations" on "public"."dpo_violations";
create policy "del_dpo_violations"
  on "public"."dpo_violations"
  as permissive
  for delete
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "ins_dpo_violations" on "public"."dpo_violations";
create policy "ins_dpo_violations"
  on "public"."dpo_violations"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "sel_dpo_violations" on "public"."dpo_violations";
create policy "sel_dpo_violations"
  on "public"."dpo_violations"
  as permissive
  for select
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "upd_dpo_violations" on "public"."dpo_violations";
create policy "upd_dpo_violations"
  on "public"."dpo_violations"
  as permissive
  for update
  to authenticated
using (((auth.uid() = created_by) AND public.is_super_admin()));


drop policy if exists "auth_only" on "public"."dpo_notices";
create policy "auth_only"
  on "public"."dpo_notices"
  as permissive
  for all
  to authenticated
using (public.is_super_admin());


drop policy if exists "auth_only" on "public"."dpo_soustraitants";
create policy "auth_only"
  on "public"."dpo_soustraitants"
  as permissive
  for all
  to authenticated
using (public.is_super_admin());


drop policy if exists "auth_only" on "public"."dpo_transferts";
create policy "auth_only"
  on "public"."dpo_transferts"
  as permissive
  for all
  to authenticated
using (public.is_super_admin());


drop policy if exists "cc_commandes_auth" on "public"."cc_commandes";
create policy "cc_commandes_auth"
  on "public"."cc_commandes"
  as permissive
  for all
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
