create extension if not exists "pg_cron" with schema "pg_catalog";

drop extension if exists "pg_net";

create type "public"."etape_tunnel_enum" as enum ('Prise de contact', 'Démo effectuée', 'Devis envoyé', 'Signé');

drop policy "auth_full_access_contacts" on "public"."contacts";

drop policy "auth_select_contacts" on "public"."contacts";

drop policy "auth_full_access_contracts" on "public"."contracts";

drop policy "auth_select_contracts" on "public"."contracts";

drop policy "ol_insert" on "public"."order_links";

drop policy "ol_select" on "public"."order_links";

drop policy "ol_update" on "public"."order_links";

drop policy "auth_delete_tasks" on "public"."tasks";

drop policy "auth_full_access_tasks" on "public"."tasks";

drop policy "auth_insert_tasks" on "public"."tasks";

drop policy "auth_select_tasks" on "public"."tasks";

drop policy "auth_update_tasks" on "public"."tasks";

drop policy "rgpd_log_select" on "public"."rgpd_log";

revoke references on table "public"."order_links" from "anon";

revoke trigger on table "public"."order_links" from "anon";

revoke truncate on table "public"."order_links" from "anon";

revoke references on table "public"."order_links" from "authenticated";

revoke trigger on table "public"."order_links" from "authenticated";

revoke truncate on table "public"."order_links" from "authenticated";

revoke references on table "public"."order_links" from "service_role";

revoke trigger on table "public"."order_links" from "service_role";

revoke truncate on table "public"."order_links" from "service_role";

alter table "public"."contracts" drop constraint "contracts_statut_check";

alter table "public"."order_links" drop constraint "order_links_contract_id_fkey";

alter table "public"."order_links" drop constraint "order_links_created_by_fkey";

alter table "public"."order_links" drop constraint "order_links_status_check";

alter table "public"."order_links" drop constraint "order_links_token_key";

alter table "public"."interactions" drop constraint "interactions_type_check";

alter table "public"."safe_connectors" drop constraint "safe_connectors_statut_check";

drop function if exists "public"."admin_list_users"();

drop view if exists "public"."v_mandats";

alter table "public"."order_links" drop constraint "order_links_pkey";

drop index if exists "public"."idx_contracts_stripe_sub";

drop index if exists "public"."order_links_contract_idx";

drop index if exists "public"."order_links_pkey";

drop index if exists "public"."order_links_token_idx";

drop index if exists "public"."order_links_token_key";

drop table "public"."order_links";


  create table "public"."app_settings" (
    "key" text not null,
    "value" text not null,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."app_settings" enable row level security;


  create table "public"."archived_users" (
    "id" uuid not null default gen_random_uuid(),
    "original_user_id" uuid not null,
    "email" text not null,
    "prenom" text,
    "nom" text,
    "numero_mandat" text,
    "role" text,
    "manager_id" uuid,
    "storage_path" text not null,
    "archived_at" timestamp with time zone not null default now(),
    "archived_by" uuid not null,
    "delete_after" timestamp with time zone not null default (now() + '5 years'::interval)
      );


alter table "public"."archived_users" enable row level security;


  create table "public"."audit_logs" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid,
    "action" text not null,
    "entity_type" text not null default 'contract'::text,
    "entity_id" uuid,
    "details" jsonb,
    "module" text,
    "criticite" text default 'Info'::text,
    "resultat" text default 'Succès'::text,
    "ip_address" text,
    "user_role" text,
    "donnees_concernees" text
      );


alter table "public"."audit_logs" enable row level security;


  create table "public"."cc_client_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" bigint not null,
    "nom_boutique" text,
    "adresse_retrait" text,
    "horaires" text,
    "delai_prep" integer default 24,
    "actif" boolean default false,
    "notes" text,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."cc_client_profiles" enable row level security;


  create table "public"."cc_commandes" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" bigint not null,
    "reference" text,
    "client_nom" text,
    "client_email" text,
    "client_tel" text,
    "produits" jsonb default '[]'::jsonb,
    "total" numeric(10,2) default 0,
    "statut" text default 'en_attente'::text,
    "date_souhaitee" date,
    "notes" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."cc_commandes" enable row level security;


  create table "public"."cc_produits" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" bigint not null,
    "nom" text not null,
    "description" text,
    "prix" numeric(10,2) default 0,
    "stock" integer default 0,
    "stock_illimite" boolean default false,
    "categorie" text,
    "image_url" text,
    "actif" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."cc_produits" enable row level security;


  create table "public"."chartes_usage_si" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "signed_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone not null default (now() + '1 year'::interval),
    "version" text not null default '1.0'::text
      );


alter table "public"."chartes_usage_si" enable row level security;


  create table "public"."clauses_confidentialite" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "signed_at" timestamp with time zone not null default now(),
    "signature" text,
    "ip" text,
    "user_agent" text,
    "signed_pdf_clause_url" text,
    "nom_signataire" text,
    "email_signataire" text
      );


alter table "public"."clauses_confidentialite" enable row level security;


  create table "public"."cyber_audits" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "created_by" uuid default auth.uid(),
    "contact_id" uuid,
    "contract_id" uuid,
    "entreprise" text not null,
    "interlocuteur" text,
    "secteur" text,
    "q01_politique_ssi" smallint default 0,
    "q02_responsable_ssi" smallint default 0,
    "q03_formation_sensibilisation" smallint default 0,
    "q04_plan_continuite" smallint default 0,
    "q05_mots_de_passe" smallint default 0,
    "q06_mfa_actif" smallint default 0,
    "q07_gestion_droits" smallint default 0,
    "q08_comptes_depart" smallint default 0,
    "q09_antivirus_edr" smallint default 0,
    "q10_mises_a_jour" smallint default 0,
    "q11_sauvegarde_testee" smallint default 0,
    "q12_wifi_segmentation" smallint default 0,
    "q13_registre_traitements" smallint default 0,
    "q14_dpo_designe" smallint default 0,
    "q15_chiffrement_donnees" smallint default 0,
    "q16_sous_traitants_rgpd" smallint default 0,
    "q17_supervision_logs" smallint default 0,
    "q18_procedure_incident" smallint default 0,
    "q19_test_phishing" smallint default 0,
    "q20_audit_precedent" smallint default 0,
    "score_gouvernance" smallint generated always as ((((COALESCE((q01_politique_ssi)::integer, 0) + COALESCE((q02_responsable_ssi)::integer, 0)) + COALESCE((q03_formation_sensibilisation)::integer, 0)) + COALESCE((q04_plan_continuite)::integer, 0))) stored,
    "score_acces" smallint generated always as ((((COALESCE((q05_mots_de_passe)::integer, 0) + COALESCE((q06_mfa_actif)::integer, 0)) + COALESCE((q07_gestion_droits)::integer, 0)) + COALESCE((q08_comptes_depart)::integer, 0))) stored,
    "score_postes" smallint generated always as ((((COALESCE((q09_antivirus_edr)::integer, 0) + COALESCE((q10_mises_a_jour)::integer, 0)) + COALESCE((q11_sauvegarde_testee)::integer, 0)) + COALESCE((q12_wifi_segmentation)::integer, 0))) stored,
    "score_donnees" smallint generated always as ((((COALESCE((q13_registre_traitements)::integer, 0) + COALESCE((q14_dpo_designe)::integer, 0)) + COALESCE((q15_chiffrement_donnees)::integer, 0)) + COALESCE((q16_sous_traitants_rgpd)::integer, 0))) stored,
    "score_detection" smallint generated always as ((((COALESCE((q17_supervision_logs)::integer, 0) + COALESCE((q18_procedure_incident)::integer, 0)) + COALESCE((q19_test_phishing)::integer, 0)) + COALESCE((q20_audit_precedent)::integer, 0))) stored,
    "score_total" smallint generated always as ((((((((((((((((((((COALESCE((q01_politique_ssi)::integer, 0) + COALESCE((q02_responsable_ssi)::integer, 0)) + COALESCE((q03_formation_sensibilisation)::integer, 0)) + COALESCE((q04_plan_continuite)::integer, 0)) + COALESCE((q05_mots_de_passe)::integer, 0)) + COALESCE((q06_mfa_actif)::integer, 0)) + COALESCE((q07_gestion_droits)::integer, 0)) + COALESCE((q08_comptes_depart)::integer, 0)) + COALESCE((q09_antivirus_edr)::integer, 0)) + COALESCE((q10_mises_a_jour)::integer, 0)) + COALESCE((q11_sauvegarde_testee)::integer, 0)) + COALESCE((q12_wifi_segmentation)::integer, 0)) + COALESCE((q13_registre_traitements)::integer, 0)) + COALESCE((q14_dpo_designe)::integer, 0)) + COALESCE((q15_chiffrement_donnees)::integer, 0)) + COALESCE((q16_sous_traitants_rgpd)::integer, 0)) + COALESCE((q17_supervision_logs)::integer, 0)) + COALESCE((q18_procedure_incident)::integer, 0)) + COALESCE((q19_test_phishing)::integer, 0)) + COALESCE((q20_audit_precedent)::integer, 0))) stored,
    "niveau_risque" text,
    "recommandations" text,
    "pack_recommande" text,
    "statut" text default 'En cours'::text,
    "rapport_pdf_url" text
      );


alter table "public"."cyber_audits" enable row level security;


  create table "public"."cyber_client_audits" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" uuid not null,
    "categorie" text not null,
    "item_key" text not null,
    "statut" text not null default 'non_verifie'::text,
    "notes" text,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."cyber_client_audits" enable row level security;


  create table "public"."cyber_client_incidents" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" uuid not null,
    "titre" text not null,
    "description" text,
    "date_incident" date not null,
    "type_incident" text,
    "niveau_gravite" text default 'modere'::text,
    "statut" text default 'ouvert'::text,
    "actions_prises" text,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."cyber_client_incidents" enable row level security;


  create table "public"."cyber_client_plan" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" uuid not null,
    "titre" text not null,
    "description" text,
    "priorite" text default 'normale'::text,
    "statut" text default 'a_faire'::text,
    "categorie" text,
    "date_echeance" date,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."cyber_client_plan" enable row level security;


  create table "public"."cyber_client_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" uuid not null,
    "score_global" integer default 0,
    "last_audit_at" timestamp with time zone,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."cyber_client_profiles" enable row level security;


  create table "public"."dpo_aipd" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "created_by" uuid default auth.uid(),
    "traitement_id" uuid,
    "intitule" text not null,
    "chef_projet" text,
    "date_debut_projet" date,
    "crit_profilage" boolean default false,
    "crit_decision_auto" boolean default false,
    "crit_surveillance" boolean default false,
    "crit_donnees_sensibles" boolean default false,
    "crit_grande_echelle" boolean default false,
    "crit_croisement" boolean default false,
    "crit_personnes_vulnerables" boolean default false,
    "crit_nouvelles_techno" boolean default false,
    "crit_blocage_droits" boolean default false,
    "nb_criteres_positifs" smallint default 0,
    "obligation_aipd" boolean,
    "description_traitement" text,
    "necessite_proportionnalite" text,
    "analyse_risques" text,
    "mesures_proposees" text,
    "avis_dpo" text,
    "conditions_avis" text,
    "date_avis" date,
    "statut" text default 'En cours'::text,
    "analyse_ia_draft" text
      );


alter table "public"."dpo_aipd" enable row level security;


  create table "public"."dpo_der" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "created_by" uuid default auth.uid(),
    "contact_id" uuid,
    "demandeur_nom" text not null,
    "demandeur_email" text,
    "canal_reception" text default 'Email'::text,
    "type_droit" text not null,
    "description_demande" text,
    "date_reception" date not null default CURRENT_DATE,
    "date_limite" date,
    "date_limite_ext" date,
    "prorogation" boolean default false,
    "identite_requise" boolean default false,
    "identite_fournie" boolean default false,
    "issue" text,
    "motif_refus" text,
    "reponse_draft" text,
    "reponse_envoyee_at" timestamp with time zone,
    "statut" text default 'Reçue'::text,
    "notes" text
      );


alter table "public"."dpo_der" enable row level security;


  create table "public"."dpo_notices" (
    "id" uuid not null default gen_random_uuid(),
    "type_collecte" text not null,
    "nom_traitement" text not null,
    "responsable_traitement" text not null,
    "contact_dpo" text,
    "finalites" text[] not null default '{}'::text[],
    "base_legale" text not null,
    "base_legale_detail" text,
    "categories_donnees" text[] not null default '{}'::text[],
    "source_donnees" text,
    "destinataires" text[] not null default '{}'::text[],
    "transferts_pays_tiers" boolean not null default false,
    "pays_tiers_detail" text,
    "duree_conservation" text not null,
    "droits" text[] not null default '{}'::text[],
    "retrait_consentement" boolean not null default false,
    "decision_automatisee" boolean not null default false,
    "decision_automatisee_detail" text,
    "collecte_obligatoire" text,
    "notice_html" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."dpo_notices" enable row level security;


  create table "public"."dpo_soustraitants" (
    "id" uuid not null default gen_random_uuid(),
    "nom" text not null,
    "siren" text,
    "service" text not null,
    "categories_donnees" text[] not null default '{}'::text[],
    "lieu_traitement" text not null,
    "pays_hors_ue" boolean not null default false,
    "garanties_transfert" text,
    "finalites" text[] not null default '{}'::text[],
    "date_dpa_signe" date,
    "date_expiration_dpa" date,
    "statut_dpa" text not null default 'À signer'::text,
    "contact_rgpd" text,
    "sous_sous_traitants" text,
    "mesures_securite" text,
    "obligations_specifiques" text,
    "dpa_html" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."dpo_soustraitants" enable row level security;


  create table "public"."dpo_traitements" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "created_by" uuid default auth.uid(),
    "intitule" text not null,
    "responsable_metier" text,
    "direction" text,
    "finalites" text,
    "base_legale" text,
    "categories_personnes" text,
    "categories_donnees" text,
    "donnees_sensibles" boolean default false,
    "article9_type" text,
    "destinataires" text,
    "transferts_hors_ue" boolean default false,
    "pays_transfert" text,
    "garanties_transfert" text,
    "duree_conservation" text,
    "ref_duree_cnil" text,
    "mesures_securite" text,
    "aipd_requise" text default 'À évaluer'::text,
    "statut" text default 'Actif'::text,
    "derniere_revision" date default CURRENT_DATE,
    "fiche_ia_draft" text
      );


alter table "public"."dpo_traitements" enable row level security;


  create table "public"."dpo_transferts" (
    "id" uuid not null default gen_random_uuid(),
    "pays_destination" text not null,
    "organisation_dest" text not null,
    "service" text not null,
    "finalites" text[] not null default '{}'::text[],
    "categories_donnees" text[] not null default '{}'::text[],
    "mecanisme" text not null,
    "detail_mecanisme" text,
    "date_mise_en_place" date,
    "date_revue" date,
    "statut" text not null default 'Actif'::text,
    "risques" text,
    "mesures_complementaires" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."dpo_transferts" enable row level security;


  create table "public"."dpo_violations" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "created_by" uuid default auth.uid(),
    "intitule" text not null,
    "date_detection" timestamp with time zone not null default now(),
    "date_limite_notif" timestamp with time zone,
    "source_incident" text,
    "description" text,
    "nature" text[] default '{}'::text[],
    "categories_donnees" text[],
    "nb_personnes_estim" integer,
    "donnees_sensibles" boolean default false,
    "score_nature" smallint,
    "score_ampleur" smallint,
    "score_identification" smallint,
    "score_consequences" smallint,
    "score_total" smallint,
    "niveau_gravite" text,
    "notif_cnil_requise" boolean,
    "notif_cnil_envoyee_at" timestamp with time zone,
    "notif_cnil_ref" text,
    "notif_personnes_requise" boolean,
    "notif_personnes_envoyee_at" timestamp with time zone,
    "draft_notif_cnil" text,
    "draft_notif_personnes" text,
    "analyse_ia" text,
    "statut" text default 'Détectée'::text,
    "mesures_correctives" text
      );


alter table "public"."dpo_violations" enable row level security;


  create table "public"."etablissements_cibles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "source" text not null,
    "identifier" text not null,
    "label" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."etablissements_cibles" enable row level security;


  create table "public"."factures" (
    "id" uuid not null default gen_random_uuid(),
    "numero" text not null,
    "contract_id" uuid,
    "contact_id" uuid,
    "commercial_id" uuid,
    "montant_ht" numeric(10,2) not null,
    "tva" numeric(10,2) not null,
    "montant_ttc" numeric(10,2) not null,
    "stripe_event_id" text,
    "pdf_url" text,
    "email_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."factures" enable row level security;


  create table "public"."fournisseurs" (
    "id" uuid not null default gen_random_uuid(),
    "nom" text not null,
    "pays" text not null default 'FR'::text,
    "categorie" text not null,
    "niveau_risque" text not null default 'moyen'::text,
    "certifications" text,
    "dpa_signe" boolean default false,
    "dpa_url" text,
    "contact_technique" text,
    "notes" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."fournisseurs" enable row level security;


  create table "public"."incidents_nis2" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "detected_at" timestamp with time zone not null,
    "type" text not null,
    "systemes_affectes" text,
    "description" text not null,
    "impact_estime" text,
    "mesures_prises" text,
    "anssi_notifie" boolean default false,
    "anssi_notifie_at" timestamp with time zone,
    "statut" text not null default 'ouvert'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."incidents_nis2" enable row level security;


  create table "public"."leads_medecins" (
    "id" uuid not null default gen_random_uuid(),
    "date_creation" timestamp with time zone not null default now(),
    "nom_praticien" text not null,
    "prenom_praticien" text not null,
    "specialite" text not null,
    "email_professionnel" text not null,
    "telephone" text,
    "logiciel_actuel" text,
    "etape_tunnel" public.etape_tunnel_enum not null default 'Prise de contact'::public.etape_tunnel_enum,
    "date_naissance_praticien" date,
    "notes_commerciales" text,
    "consentement_rgpd" boolean not null default false,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."leads_medecins" enable row level security;


  create table "public"."notifications" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "type" text not null,
    "titre" text not null,
    "message" text,
    "data" jsonb,
    "read_at" timestamp with time zone,
    "user_id" uuid
      );


alter table "public"."notifications" enable row level security;


  create table "public"."places_search_logs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "query" text not null,
    "results_count" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."places_search_logs" enable row level security;


  create table "public"."registre_rgpd" (
    "id" uuid not null default gen_random_uuid(),
    "date_evenement" timestamp with time zone not null default now(),
    "lead_id" uuid,
    "type_evenement" text not null,
    "description" text not null,
    "source" text default 'formulaire_landing_page'::text
      );


alter table "public"."registre_rgpd" enable row level security;


  create table "public"."relances_email" (
    "id" uuid not null default gen_random_uuid(),
    "lead_id" uuid,
    "type_relance" text not null,
    "date_envoi_prevu" timestamp with time zone,
    "date_envoi_reel" timestamp with time zone,
    "statut" text default 'en_attente'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."relances_email" enable row level security;


  create table "public"."safe_connector_secrets" (
    "service_key" text not null,
    "api_key" text not null,
    "updated_by" uuid,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."safe_connector_secrets" enable row level security;


  create table "public"."seo_client_audits" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" uuid not null,
    "categorie" text not null,
    "item_key" text not null,
    "statut" text not null default 'non_verifie'::text,
    "notes" text,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "domaine_id" uuid
      );


alter table "public"."seo_client_audits" enable row level security;


  create table "public"."seo_client_mots_cles" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" uuid not null,
    "mot_cle" text not null,
    "url_cible" text,
    "type_mc" text default 'principal'::text,
    "position_actuelle" integer,
    "position_precedente" integer,
    "volume_recherche" integer,
    "date_maj" date default CURRENT_DATE,
    "notes" text,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "domaine_id" uuid
      );


alter table "public"."seo_client_mots_cles" enable row level security;


  create table "public"."seo_client_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" uuid not null,
    "domaine" text,
    "score_global" integer default 0,
    "last_audit_at" timestamp with time zone,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."seo_client_profiles" enable row level security;


  create table "public"."seo_domaines" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" uuid not null,
    "domaine" text not null,
    "label" text,
    "is_principal" boolean not null default false,
    "score_global" integer default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid
      );


alter table "public"."seo_domaines" enable row level security;


  create table "public"."social_client_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" bigint not null,
    "reseaux" text[] default '{}'::text[],
    "objectif_posts" integer default 0,
    "notes" text,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."social_client_profiles" enable row level security;


  create table "public"."social_posts" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" bigint not null,
    "reseau" text not null,
    "texte" text,
    "image_url" text,
    "hashtags" text,
    "date_publication" date,
    "heure_publication" time without time zone,
    "statut" text default 'brouillon'::text,
    "perf_likes" integer default 0,
    "perf_reach" integer default 0,
    "perf_comments" integer default 0,
    "notes" text,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."social_posts" enable row level security;


  create table "public"."tournee_etapes" (
    "id" uuid not null default gen_random_uuid(),
    "tournee_id" uuid not null,
    "ordre" smallint not null,
    "label" text not null,
    "adresse" text,
    "lat" numeric(10,7),
    "lng" numeric(10,7),
    "heure_estimee" time without time zone,
    "duree_min" smallint not null default 60,
    "contact_id" uuid,
    "source" text not null default 'crm'::text,
    "visitee" boolean not null default false,
    "notes" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."tournee_etapes" enable row level security;


  create table "public"."tournees" (
    "id" uuid not null default gen_random_uuid(),
    "commercial_id" uuid not null,
    "date_tournee" date not null,
    "heure_depart" time without time zone not null default '09:00:00'::time without time zone,
    "adresse_depart" text not null,
    "lat_depart" numeric(10,7),
    "lng_depart" numeric(10,7),
    "heure_retour_est" time without time zone,
    "statut" text not null default 'planifiée'::text,
    "created_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone not null default (now() + '1 year'::interval),
    "distance_totale_km" numeric(8,2),
    "score_co2_kg" numeric(8,3) generated always as ((distance_totale_km * 0.120)) stored,
    "nb_etapes" smallint not null default 0,
    "limite_depassee" boolean not null default false,
    "force_depassement" boolean not null default false,
    "force_etape" smallint
      );


alter table "public"."tournees" enable row level security;


  create table "public"."work_journal" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid,
    "user_nom" text,
    "wf_id" text,
    "wf_label" text,
    "wf_icon" text,
    "contact_id" uuid,
    "contact_nom" text,
    "contact_entreprise" text,
    "contract_type" text,
    "status" text default 'completed'::text,
    "notes" text
      );


alter table "public"."work_journal" enable row level security;

alter table "public"."bordereau_log" add column "statut" text default 'Bordereau envoyé'::text;

alter table "public"."bordereau_log" add column "statut_history" jsonb default '[]'::jsonb;

alter table "public"."contacts" add column "a_completer" boolean not null default false;

alter table "public"."contacts" add column "canal_acquisition" text;

alter table "public"."contacts" add column "code_postal" text;

alter table "public"."contacts" add column "date_relance" date;

alter table "public"."contacts" add column "kanban_checklist" jsonb default '[]'::jsonb;

alter table "public"."contacts" add column "kanban_col" text default 'prospect'::text;

alter table "public"."contacts" add column "linkedin" text;

alter table "public"."contacts" add column "prenom" text;

alter table "public"."contacts" add column "priority" text default 'normale'::text;

alter table "public"."contacts" add column "purge_date" timestamp with time zone;

alter table "public"."contacts" add column "qualification" text default 'qualifié'::text;

alter table "public"."contacts" add column "ville" text;

alter table "public"."contracts" drop column "signed_pdf_kdrive_url";

alter table "public"."contracts" add column "resiliation_alerte_at" timestamp with time zone;

alter table "public"."contracts" add column "resiliation_demande_at" timestamp with time zone;

alter table "public"."contracts" add column "resiliation_stripe_checked_at" timestamp with time zone;

alter table "public"."contracts" add column "resiliation_validee_at" timestamp with time zone;

alter table "public"."contracts" add column "resiliation_validee_by" uuid;

alter table "public"."contracts" add column "signed_pdf_contrat_url" text;

alter table "public"."mandats" add column "signed_pdf_url" text;

alter table "public"."profiles" add column "adresse" text;

alter table "public"."profiles" add column "adresse_pro" text;

alter table "public"."profiles" add column "clause_confidentialite_signee" boolean not null default false;

alter table "public"."profiles" add column "clause_signee_at" timestamp with time zone;

alter table "public"."profiles" add column "dci_parent_id" uuid;

alter table "public"."profiles" add column "denomination" text;

alter table "public"."profiles" add column "departement" text;

alter table "public"."profiles" add column "ics_token" uuid not null default gen_random_uuid();

alter table "public"."profiles" add column "limite_requetes_google_places" integer not null default 20;

alter table "public"."profiles" add column "nom" text;

alter table "public"."profiles" add column "numero_mandat" text;

alter table "public"."profiles" add column "profil_alerte_at" timestamp with time zone;

alter table "public"."profiles" add column "profil_revocation_flag" boolean not null default false;

alter table "public"."profiles" add column "rcpro_numero" text;

alter table "public"."profiles" add column "region" text;

alter table "public"."profiles" add column "role" text not null default 'user'::text;

alter table "public"."profiles" add column "secteur" text;

alter table "public"."profiles" add column "siret" text;

alter table "public"."profiles" add column "telephone" text;

alter table "public"."profiles" add column "tva" text;

alter table "public"."rate_limits" drop column "updated_at";

alter table "public"."rate_limits" alter column "count" set default 1;

alter table "public"."safe_connectors" add column "cat" text not null default 'autre'::text;

alter table "public"."safe_connectors" add column "cout" text;

alter table "public"."safe_connectors" add column "doc_url" text;

alter table "public"."safe_connectors" add column "donnees" text;

alter table "public"."safe_connectors" add column "ico" text not null default '🔌'::text;

alter table "public"."safe_connectors" add column "is_custom" boolean default false;

alter table "public"."safe_connectors" add column "limite" text;

alter table "public"."safe_connectors" add column "modules" text[] default '{}'::text[];

alter table "public"."safe_connectors" add column "usage_desc" text;

CREATE UNIQUE INDEX app_settings_pkey ON public.app_settings USING btree (key);

CREATE UNIQUE INDEX archived_users_pkey ON public.archived_users USING btree (id);

CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE UNIQUE INDEX cc_client_profiles_contact_id_key ON public.cc_client_profiles USING btree (contact_id);

CREATE UNIQUE INDEX cc_client_profiles_pkey ON public.cc_client_profiles USING btree (id);

CREATE UNIQUE INDEX cc_commandes_pkey ON public.cc_commandes USING btree (id);

CREATE UNIQUE INDEX cc_produits_pkey ON public.cc_produits USING btree (id);

CREATE UNIQUE INDEX chartes_usage_si_pkey ON public.chartes_usage_si USING btree (id);

CREATE UNIQUE INDEX clauses_confidentialite_pkey ON public.clauses_confidentialite USING btree (id);

CREATE UNIQUE INDEX clauses_confidentialite_user_id_key ON public.clauses_confidentialite USING btree (user_id);

CREATE INDEX cyber_audits_contact_id_idx ON public.cyber_audits USING btree (contact_id);

CREATE INDEX cyber_audits_contract_id_idx ON public.cyber_audits USING btree (contract_id);

CREATE INDEX cyber_audits_created_by_idx ON public.cyber_audits USING btree (created_by);

CREATE UNIQUE INDEX cyber_audits_pkey ON public.cyber_audits USING btree (id);

CREATE INDEX cyber_audits_statut_idx ON public.cyber_audits USING btree (statut);

CREATE UNIQUE INDEX cyber_client_audits_contact_id_item_key_key ON public.cyber_client_audits USING btree (contact_id, item_key);

CREATE UNIQUE INDEX cyber_client_audits_pkey ON public.cyber_client_audits USING btree (id);

CREATE UNIQUE INDEX cyber_client_incidents_pkey ON public.cyber_client_incidents USING btree (id);

CREATE UNIQUE INDEX cyber_client_plan_pkey ON public.cyber_client_plan USING btree (id);

CREATE UNIQUE INDEX cyber_client_profiles_contact_id_key ON public.cyber_client_profiles USING btree (contact_id);

CREATE UNIQUE INDEX cyber_client_profiles_pkey ON public.cyber_client_profiles USING btree (id);

CREATE UNIQUE INDEX dpo_aipd_pkey ON public.dpo_aipd USING btree (id);

CREATE INDEX dpo_aipd_traitement_idx ON public.dpo_aipd USING btree (traitement_id);

CREATE INDEX dpo_der_contact_idx ON public.dpo_der USING btree (contact_id);

CREATE INDEX dpo_der_date_limite_idx ON public.dpo_der USING btree (date_limite);

CREATE UNIQUE INDEX dpo_der_pkey ON public.dpo_der USING btree (id);

CREATE INDEX dpo_der_statut_idx ON public.dpo_der USING btree (statut);

CREATE UNIQUE INDEX dpo_notices_pkey ON public.dpo_notices USING btree (id);

CREATE UNIQUE INDEX dpo_soustraitants_pkey ON public.dpo_soustraitants USING btree (id);

CREATE INDEX dpo_trait_statut_idx ON public.dpo_traitements USING btree (statut);

CREATE UNIQUE INDEX dpo_traitements_pkey ON public.dpo_traitements USING btree (id);

CREATE UNIQUE INDEX dpo_transferts_pkey ON public.dpo_transferts USING btree (id);

CREATE INDEX dpo_viol_detection_idx ON public.dpo_violations USING btree (date_detection);

CREATE INDEX dpo_viol_statut_idx ON public.dpo_violations USING btree (statut);

CREATE UNIQUE INDEX dpo_violations_pkey ON public.dpo_violations USING btree (id);

CREATE UNIQUE INDEX etablissements_cibles_pkey ON public.etablissements_cibles USING btree (id);

CREATE UNIQUE INDEX etablissements_cibles_source_identifier_key ON public.etablissements_cibles USING btree (source, identifier);

CREATE UNIQUE INDEX factures_numero_key ON public.factures USING btree (numero);

CREATE UNIQUE INDEX factures_pkey ON public.factures USING btree (id);

CREATE UNIQUE INDEX factures_stripe_event_id_key ON public.factures USING btree (stripe_event_id);

CREATE UNIQUE INDEX fournisseurs_pkey ON public.fournisseurs USING btree (id);

CREATE INDEX idx_bordereau_log_statut ON public.bordereau_log USING btree (statut);

CREATE INDEX idx_contacts_created_by ON public.contacts USING btree (created_by);

CREATE INDEX idx_contacts_date_relance ON public.contacts USING btree (date_relance);

CREATE INDEX idx_contacts_kanban_col ON public.contacts USING btree (kanban_col);

CREATE INDEX idx_etab_cibles_lookup ON public.etablissements_cibles USING btree (source, identifier);

CREATE INDEX idx_etab_cibles_user ON public.etablissements_cibles USING btree (user_id, created_at DESC);

CREATE INDEX idx_etapes_contact ON public.tournee_etapes USING btree (contact_id) WHERE (contact_id IS NOT NULL);

CREATE INDEX idx_etapes_tournee_ordre ON public.tournee_etapes USING btree (tournee_id, ordre);

CREATE INDEX idx_incidents_nis2_detected_at ON public.incidents_nis2 USING btree (detected_at DESC);

CREATE INDEX idx_incidents_nis2_statut ON public.incidents_nis2 USING btree (statut);

CREATE INDEX idx_leads_anniversaire ON public.leads_medecins USING btree (date_naissance_praticien);

CREATE INDEX idx_leads_email ON public.leads_medecins USING btree (email_professionnel);

CREATE INDEX idx_leads_etape ON public.leads_medecins USING btree (etape_tunnel);

CREATE INDEX idx_notif_created ON public.notifications USING btree (created_at DESC);

CREATE INDEX idx_notif_read ON public.notifications USING btree (read_at) WHERE (read_at IS NULL);

CREATE INDEX idx_notif_type ON public.notifications USING btree (type);

CREATE INDEX idx_places_logs_month ON public.places_search_logs USING btree (created_at);

CREATE INDEX idx_places_logs_user_month ON public.places_search_logs USING btree (user_id, created_at);

CREATE INDEX idx_profiles_dci_parent ON public.profiles USING btree (dci_parent_id);

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);

CREATE INDEX idx_rgpd_lead_id ON public.registre_rgpd USING btree (lead_id);

CREATE INDEX idx_tournees_commercial_date ON public.tournees USING btree (commercial_id, date_tournee);

CREATE INDEX idx_tournees_date ON public.tournees USING btree (date_tournee);

CREATE INDEX idx_tournees_eco ON public.tournees USING btree (commercial_id, date_tournee, distance_totale_km) WHERE (distance_totale_km IS NOT NULL);

CREATE INDEX idx_tournees_expires ON public.tournees USING btree (expires_at);

CREATE UNIQUE INDEX incidents_nis2_pkey ON public.incidents_nis2 USING btree (id);

CREATE UNIQUE INDEX leads_medecins_email_professionnel_key ON public.leads_medecins USING btree (email_professionnel);

CREATE UNIQUE INDEX leads_medecins_pkey ON public.leads_medecins USING btree (id);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE UNIQUE INDEX places_search_logs_pkey ON public.places_search_logs USING btree (id);

CREATE UNIQUE INDEX registre_rgpd_pkey ON public.registre_rgpd USING btree (id);

CREATE UNIQUE INDEX relances_email_pkey ON public.relances_email USING btree (id);

CREATE UNIQUE INDEX safe_connector_secrets_pkey ON public.safe_connector_secrets USING btree (service_key);

CREATE UNIQUE INDEX seo_audits_contact_item_domain_idx ON public.seo_client_audits USING btree (contact_id, item_key, COALESCE(domaine_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE UNIQUE INDEX seo_client_audits_pkey ON public.seo_client_audits USING btree (id);

CREATE UNIQUE INDEX seo_client_mots_cles_pkey ON public.seo_client_mots_cles USING btree (id);

CREATE UNIQUE INDEX seo_client_profiles_contact_id_key ON public.seo_client_profiles USING btree (contact_id);

CREATE UNIQUE INDEX seo_client_profiles_pkey ON public.seo_client_profiles USING btree (id);

CREATE UNIQUE INDEX seo_domaines_contact_domaine_idx ON public.seo_domaines USING btree (contact_id, domaine);

CREATE UNIQUE INDEX seo_domaines_pkey ON public.seo_domaines USING btree (id);

CREATE UNIQUE INDEX social_client_profiles_contact_id_key ON public.social_client_profiles USING btree (contact_id);

CREATE UNIQUE INDEX social_client_profiles_pkey ON public.social_client_profiles USING btree (id);

CREATE UNIQUE INDEX social_posts_pkey ON public.social_posts USING btree (id);

CREATE UNIQUE INDEX tournee_etapes_pkey ON public.tournee_etapes USING btree (id);

CREATE UNIQUE INDEX tournee_etapes_tournee_id_ordre_key ON public.tournee_etapes USING btree (tournee_id, ordre);

CREATE UNIQUE INDEX tournees_pkey ON public.tournees USING btree (id);

CREATE INDEX work_journal_created_idx ON public.work_journal USING btree (created_at DESC);

CREATE UNIQUE INDEX work_journal_pkey ON public.work_journal USING btree (id);

alter table "public"."app_settings" add constraint "app_settings_pkey" PRIMARY KEY using index "app_settings_pkey";

alter table "public"."archived_users" add constraint "archived_users_pkey" PRIMARY KEY using index "archived_users_pkey";

alter table "public"."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY using index "audit_logs_pkey";

alter table "public"."cc_client_profiles" add constraint "cc_client_profiles_pkey" PRIMARY KEY using index "cc_client_profiles_pkey";

alter table "public"."cc_commandes" add constraint "cc_commandes_pkey" PRIMARY KEY using index "cc_commandes_pkey";

alter table "public"."cc_produits" add constraint "cc_produits_pkey" PRIMARY KEY using index "cc_produits_pkey";

alter table "public"."chartes_usage_si" add constraint "chartes_usage_si_pkey" PRIMARY KEY using index "chartes_usage_si_pkey";

alter table "public"."clauses_confidentialite" add constraint "clauses_confidentialite_pkey" PRIMARY KEY using index "clauses_confidentialite_pkey";

alter table "public"."cyber_audits" add constraint "cyber_audits_pkey" PRIMARY KEY using index "cyber_audits_pkey";

alter table "public"."cyber_client_audits" add constraint "cyber_client_audits_pkey" PRIMARY KEY using index "cyber_client_audits_pkey";

alter table "public"."cyber_client_incidents" add constraint "cyber_client_incidents_pkey" PRIMARY KEY using index "cyber_client_incidents_pkey";

alter table "public"."cyber_client_plan" add constraint "cyber_client_plan_pkey" PRIMARY KEY using index "cyber_client_plan_pkey";

alter table "public"."cyber_client_profiles" add constraint "cyber_client_profiles_pkey" PRIMARY KEY using index "cyber_client_profiles_pkey";

alter table "public"."dpo_aipd" add constraint "dpo_aipd_pkey" PRIMARY KEY using index "dpo_aipd_pkey";

alter table "public"."dpo_der" add constraint "dpo_der_pkey" PRIMARY KEY using index "dpo_der_pkey";

alter table "public"."dpo_notices" add constraint "dpo_notices_pkey" PRIMARY KEY using index "dpo_notices_pkey";

alter table "public"."dpo_soustraitants" add constraint "dpo_soustraitants_pkey" PRIMARY KEY using index "dpo_soustraitants_pkey";

alter table "public"."dpo_traitements" add constraint "dpo_traitements_pkey" PRIMARY KEY using index "dpo_traitements_pkey";

alter table "public"."dpo_transferts" add constraint "dpo_transferts_pkey" PRIMARY KEY using index "dpo_transferts_pkey";

alter table "public"."dpo_violations" add constraint "dpo_violations_pkey" PRIMARY KEY using index "dpo_violations_pkey";

alter table "public"."etablissements_cibles" add constraint "etablissements_cibles_pkey" PRIMARY KEY using index "etablissements_cibles_pkey";

alter table "public"."factures" add constraint "factures_pkey" PRIMARY KEY using index "factures_pkey";

alter table "public"."fournisseurs" add constraint "fournisseurs_pkey" PRIMARY KEY using index "fournisseurs_pkey";

alter table "public"."incidents_nis2" add constraint "incidents_nis2_pkey" PRIMARY KEY using index "incidents_nis2_pkey";

alter table "public"."leads_medecins" add constraint "leads_medecins_pkey" PRIMARY KEY using index "leads_medecins_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."places_search_logs" add constraint "places_search_logs_pkey" PRIMARY KEY using index "places_search_logs_pkey";

alter table "public"."registre_rgpd" add constraint "registre_rgpd_pkey" PRIMARY KEY using index "registre_rgpd_pkey";

alter table "public"."relances_email" add constraint "relances_email_pkey" PRIMARY KEY using index "relances_email_pkey";

alter table "public"."safe_connector_secrets" add constraint "safe_connector_secrets_pkey" PRIMARY KEY using index "safe_connector_secrets_pkey";

alter table "public"."seo_client_audits" add constraint "seo_client_audits_pkey" PRIMARY KEY using index "seo_client_audits_pkey";

alter table "public"."seo_client_mots_cles" add constraint "seo_client_mots_cles_pkey" PRIMARY KEY using index "seo_client_mots_cles_pkey";

alter table "public"."seo_client_profiles" add constraint "seo_client_profiles_pkey" PRIMARY KEY using index "seo_client_profiles_pkey";

alter table "public"."seo_domaines" add constraint "seo_domaines_pkey" PRIMARY KEY using index "seo_domaines_pkey";

alter table "public"."social_client_profiles" add constraint "social_client_profiles_pkey" PRIMARY KEY using index "social_client_profiles_pkey";

alter table "public"."social_posts" add constraint "social_posts_pkey" PRIMARY KEY using index "social_posts_pkey";

alter table "public"."tournee_etapes" add constraint "tournee_etapes_pkey" PRIMARY KEY using index "tournee_etapes_pkey";

alter table "public"."tournees" add constraint "tournees_pkey" PRIMARY KEY using index "tournees_pkey";

alter table "public"."work_journal" add constraint "work_journal_pkey" PRIMARY KEY using index "work_journal_pkey";

alter table "public"."archived_users" add constraint "archived_users_archived_by_fkey" FOREIGN KEY (archived_by) REFERENCES auth.users(id) not valid;

alter table "public"."archived_users" validate constraint "archived_users_archived_by_fkey";

alter table "public"."cc_client_profiles" add constraint "cc_client_profiles_contact_id_key" UNIQUE using index "cc_client_profiles_contact_id_key";

alter table "public"."chartes_usage_si" add constraint "chartes_usage_si_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chartes_usage_si" validate constraint "chartes_usage_si_user_id_fkey";

alter table "public"."clauses_confidentialite" add constraint "clauses_confidentialite_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."clauses_confidentialite" validate constraint "clauses_confidentialite_user_id_fkey";

alter table "public"."clauses_confidentialite" add constraint "clauses_confidentialite_user_id_key" UNIQUE using index "clauses_confidentialite_user_id_key";

alter table "public"."contacts" add constraint "contacts_qualification_check" CHECK ((qualification = ANY (ARRAY['non_qualifié'::text, 'qualifié'::text]))) not valid;

alter table "public"."contacts" validate constraint "contacts_qualification_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_contact_id_fkey";

alter table "public"."cyber_audits" add constraint "cyber_audits_contract_id_fkey" FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_contract_id_fkey";

alter table "public"."cyber_audits" add constraint "cyber_audits_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_created_by_fkey";

alter table "public"."cyber_audits" add constraint "cyber_audits_niveau_risque_check" CHECK ((niveau_risque = ANY (ARRAY['Critique'::text, 'Élevé'::text, 'Modéré'::text, 'Bon'::text, 'Excellent'::text]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_niveau_risque_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_pack_recommande_check" CHECK ((pack_recommande = ANY (ARRAY['S@FE Starter'::text, 'S@FE Visibilité+'::text, 'S@FE Conformité'::text, 'S@FE Protection'::text, 'S@FE Premium'::text, 'Audit approfondi'::text]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_pack_recommande_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q01_politique_ssi_check" CHECK ((q01_politique_ssi = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q01_politique_ssi_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q02_responsable_ssi_check" CHECK ((q02_responsable_ssi = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q02_responsable_ssi_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q03_formation_sensibilisation_check" CHECK ((q03_formation_sensibilisation = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q03_formation_sensibilisation_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q04_plan_continuite_check" CHECK ((q04_plan_continuite = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q04_plan_continuite_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q05_mots_de_passe_check" CHECK ((q05_mots_de_passe = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q05_mots_de_passe_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q06_mfa_actif_check" CHECK ((q06_mfa_actif = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q06_mfa_actif_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q07_gestion_droits_check" CHECK ((q07_gestion_droits = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q07_gestion_droits_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q08_comptes_depart_check" CHECK ((q08_comptes_depart = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q08_comptes_depart_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q09_antivirus_edr_check" CHECK ((q09_antivirus_edr = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q09_antivirus_edr_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q10_mises_a_jour_check" CHECK ((q10_mises_a_jour = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q10_mises_a_jour_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q11_sauvegarde_testee_check" CHECK ((q11_sauvegarde_testee = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q11_sauvegarde_testee_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q12_wifi_segmentation_check" CHECK ((q12_wifi_segmentation = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q12_wifi_segmentation_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q13_registre_traitements_check" CHECK ((q13_registre_traitements = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q13_registre_traitements_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q14_dpo_designe_check" CHECK ((q14_dpo_designe = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q14_dpo_designe_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q15_chiffrement_donnees_check" CHECK ((q15_chiffrement_donnees = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q15_chiffrement_donnees_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q16_sous_traitants_rgpd_check" CHECK ((q16_sous_traitants_rgpd = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q16_sous_traitants_rgpd_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q17_supervision_logs_check" CHECK ((q17_supervision_logs = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q17_supervision_logs_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q18_procedure_incident_check" CHECK ((q18_procedure_incident = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q18_procedure_incident_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q19_test_phishing_check" CHECK ((q19_test_phishing = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q19_test_phishing_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_q20_audit_precedent_check" CHECK ((q20_audit_precedent = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_q20_audit_precedent_check";

alter table "public"."cyber_audits" add constraint "cyber_audits_statut_check" CHECK ((statut = ANY (ARRAY['En cours'::text, 'Finalisé'::text, 'Transmis'::text, 'Archivé'::text]))) not valid;

alter table "public"."cyber_audits" validate constraint "cyber_audits_statut_check";

alter table "public"."cyber_client_audits" add constraint "cyber_client_audits_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE not valid;

alter table "public"."cyber_client_audits" validate constraint "cyber_client_audits_contact_id_fkey";

alter table "public"."cyber_client_audits" add constraint "cyber_client_audits_contact_id_item_key_key" UNIQUE using index "cyber_client_audits_contact_id_item_key_key";

alter table "public"."cyber_client_audits" add constraint "cyber_client_audits_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."cyber_client_audits" validate constraint "cyber_client_audits_created_by_fkey";

alter table "public"."cyber_client_audits" add constraint "cyber_client_audits_statut_check" CHECK ((statut = ANY (ARRAY['conforme'::text, 'partiel'::text, 'non_conforme'::text, 'na'::text, 'non_verifie'::text]))) not valid;

alter table "public"."cyber_client_audits" validate constraint "cyber_client_audits_statut_check";

alter table "public"."cyber_client_incidents" add constraint "cyber_client_incidents_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE not valid;

alter table "public"."cyber_client_incidents" validate constraint "cyber_client_incidents_contact_id_fkey";

alter table "public"."cyber_client_incidents" add constraint "cyber_client_incidents_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."cyber_client_incidents" validate constraint "cyber_client_incidents_created_by_fkey";

alter table "public"."cyber_client_incidents" add constraint "cyber_client_incidents_niveau_gravite_check" CHECK ((niveau_gravite = ANY (ARRAY['faible'::text, 'modere'::text, 'grave'::text, 'critique'::text]))) not valid;

alter table "public"."cyber_client_incidents" validate constraint "cyber_client_incidents_niveau_gravite_check";

alter table "public"."cyber_client_incidents" add constraint "cyber_client_incidents_statut_check" CHECK ((statut = ANY (ARRAY['ouvert'::text, 'en_cours'::text, 'resolu'::text, 'cloture'::text]))) not valid;

alter table "public"."cyber_client_incidents" validate constraint "cyber_client_incidents_statut_check";

alter table "public"."cyber_client_plan" add constraint "cyber_client_plan_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE not valid;

alter table "public"."cyber_client_plan" validate constraint "cyber_client_plan_contact_id_fkey";

alter table "public"."cyber_client_plan" add constraint "cyber_client_plan_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."cyber_client_plan" validate constraint "cyber_client_plan_created_by_fkey";

alter table "public"."cyber_client_plan" add constraint "cyber_client_plan_priorite_check" CHECK ((priorite = ANY (ARRAY['critique'::text, 'haute'::text, 'normale'::text, 'basse'::text]))) not valid;

alter table "public"."cyber_client_plan" validate constraint "cyber_client_plan_priorite_check";

alter table "public"."cyber_client_plan" add constraint "cyber_client_plan_statut_check" CHECK ((statut = ANY (ARRAY['a_faire'::text, 'en_cours'::text, 'fait'::text, 'abandonne'::text]))) not valid;

alter table "public"."cyber_client_plan" validate constraint "cyber_client_plan_statut_check";

alter table "public"."cyber_client_profiles" add constraint "cyber_client_profiles_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE not valid;

alter table "public"."cyber_client_profiles" validate constraint "cyber_client_profiles_contact_id_fkey";

alter table "public"."cyber_client_profiles" add constraint "cyber_client_profiles_contact_id_key" UNIQUE using index "cyber_client_profiles_contact_id_key";

alter table "public"."cyber_client_profiles" add constraint "cyber_client_profiles_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."cyber_client_profiles" validate constraint "cyber_client_profiles_created_by_fkey";

alter table "public"."dpo_aipd" add constraint "dpo_aipd_avis_dpo_check" CHECK ((avis_dpo = ANY (ARRAY['Favorable'::text, 'Réservé'::text, 'Défavorable'::text, 'En attente'::text]))) not valid;

alter table "public"."dpo_aipd" validate constraint "dpo_aipd_avis_dpo_check";

alter table "public"."dpo_aipd" add constraint "dpo_aipd_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."dpo_aipd" validate constraint "dpo_aipd_created_by_fkey";

alter table "public"."dpo_aipd" add constraint "dpo_aipd_statut_check" CHECK ((statut = ANY (ARRAY['En cours'::text, 'Finalisée'::text, 'Approuvée'::text, 'Archivée'::text]))) not valid;

alter table "public"."dpo_aipd" validate constraint "dpo_aipd_statut_check";

alter table "public"."dpo_aipd" add constraint "dpo_aipd_traitement_id_fkey" FOREIGN KEY (traitement_id) REFERENCES public.dpo_traitements(id) ON DELETE SET NULL not valid;

alter table "public"."dpo_aipd" validate constraint "dpo_aipd_traitement_id_fkey";

alter table "public"."dpo_der" add constraint "dpo_der_canal_reception_check" CHECK ((canal_reception = ANY (ARRAY['Email'::text, 'Formulaire'::text, 'Courrier'::text, 'Téléphone'::text]))) not valid;

alter table "public"."dpo_der" validate constraint "dpo_der_canal_reception_check";

alter table "public"."dpo_der" add constraint "dpo_der_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL not valid;

alter table "public"."dpo_der" validate constraint "dpo_der_contact_id_fkey";

alter table "public"."dpo_der" add constraint "dpo_der_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."dpo_der" validate constraint "dpo_der_created_by_fkey";

alter table "public"."dpo_der" add constraint "dpo_der_issue_check" CHECK ((issue = ANY (ARRAY['Accordée'::text, 'Refusée'::text, 'Partiellement accordée'::text, 'Données inexistantes'::text, 'En attente'::text]))) not valid;

alter table "public"."dpo_der" validate constraint "dpo_der_issue_check";

alter table "public"."dpo_der" add constraint "dpo_der_statut_check" CHECK ((statut = ANY (ARRAY['Reçue'::text, 'En cours'::text, 'En attente justificatif'::text, 'Clôturée'::text, 'Archivée'::text]))) not valid;

alter table "public"."dpo_der" validate constraint "dpo_der_statut_check";

alter table "public"."dpo_der" add constraint "dpo_der_type_droit_check" CHECK ((type_droit = ANY (ARRAY['Accès (Art.15)'::text, 'Rectification (Art.16)'::text, 'Effacement (Art.17)'::text, 'Portabilité (Art.20)'::text, 'Opposition (Art.21)'::text, 'Limitation (Art.18)'::text, 'Autre'::text]))) not valid;

alter table "public"."dpo_der" validate constraint "dpo_der_type_droit_check";

alter table "public"."dpo_notices" add constraint "dpo_notices_type_collecte_check" CHECK ((type_collecte = ANY (ARRAY['directe'::text, 'indirecte'::text]))) not valid;

alter table "public"."dpo_notices" validate constraint "dpo_notices_type_collecte_check";

alter table "public"."dpo_soustraitants" add constraint "dpo_soustraitants_statut_dpa_check" CHECK ((statut_dpa = ANY (ARRAY['À signer'::text, 'Signé'::text, 'Expiré'::text, 'Résilié'::text]))) not valid;

alter table "public"."dpo_soustraitants" validate constraint "dpo_soustraitants_statut_dpa_check";

alter table "public"."dpo_traitements" add constraint "dpo_traitements_aipd_requise_check" CHECK ((aipd_requise = ANY (ARRAY['Oui'::text, 'Non'::text, 'À évaluer'::text, 'Recommandée'::text]))) not valid;

alter table "public"."dpo_traitements" validate constraint "dpo_traitements_aipd_requise_check";

alter table "public"."dpo_traitements" add constraint "dpo_traitements_base_legale_check" CHECK ((base_legale = ANY (ARRAY['Consentement (Art.6§1a)'::text, 'Contrat (Art.6§1b)'::text, 'Obligation légale (Art.6§1c)'::text, 'Intérêt vital (Art.6§1d)'::text, 'Mission publique (Art.6§1e)'::text, 'Intérêt légitime (Art.6§1f)'::text]))) not valid;

alter table "public"."dpo_traitements" validate constraint "dpo_traitements_base_legale_check";

alter table "public"."dpo_traitements" add constraint "dpo_traitements_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."dpo_traitements" validate constraint "dpo_traitements_created_by_fkey";

alter table "public"."dpo_traitements" add constraint "dpo_traitements_statut_check" CHECK ((statut = ANY (ARRAY['Actif'::text, 'Suspendu'::text, 'Archivé'::text, 'En révision'::text]))) not valid;

alter table "public"."dpo_traitements" validate constraint "dpo_traitements_statut_check";

alter table "public"."dpo_transferts" add constraint "dpo_transferts_mecanisme_check" CHECK ((mecanisme = ANY (ARRAY['Décision d''adéquation (Art.45)'::text, 'Clauses contractuelles types — CCT (Art.46.2.c)'::text, 'Règles d''entreprise contraignantes — BCR (Art.47)'::text, 'Code de conduite approuvé (Art.46.2.e)'::text, 'Certification approuvée (Art.46.2.f)'::text, 'Consentement explicite (Art.49.1.a)'::text, 'Exécution d''un contrat (Art.49.1.b)'::text, 'Intérêt public (Art.49.1.d)'::text, 'Constatation / défense de droits (Art.49.1.e)'::text, 'Aucune garantie — à régulariser'::text]))) not valid;

alter table "public"."dpo_transferts" validate constraint "dpo_transferts_mecanisme_check";

alter table "public"."dpo_transferts" add constraint "dpo_transferts_statut_check" CHECK ((statut = ANY (ARRAY['Actif'::text, 'À régulariser'::text, 'Suspendu'::text, 'Clôturé'::text]))) not valid;

alter table "public"."dpo_transferts" validate constraint "dpo_transferts_statut_check";

alter table "public"."dpo_violations" add constraint "dpo_violations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."dpo_violations" validate constraint "dpo_violations_created_by_fkey";

alter table "public"."dpo_violations" add constraint "dpo_violations_niveau_gravite_check" CHECK ((niveau_gravite = ANY (ARRAY['Faible'::text, 'Modéré'::text, 'Sévère'::text, 'Critique'::text]))) not valid;

alter table "public"."dpo_violations" validate constraint "dpo_violations_niveau_gravite_check";

alter table "public"."dpo_violations" add constraint "dpo_violations_score_ampleur_check" CHECK (((score_ampleur >= 1) AND (score_ampleur <= 4))) not valid;

alter table "public"."dpo_violations" validate constraint "dpo_violations_score_ampleur_check";

alter table "public"."dpo_violations" add constraint "dpo_violations_score_consequences_check" CHECK (((score_consequences >= 1) AND (score_consequences <= 4))) not valid;

alter table "public"."dpo_violations" validate constraint "dpo_violations_score_consequences_check";

alter table "public"."dpo_violations" add constraint "dpo_violations_score_identification_check" CHECK (((score_identification >= 1) AND (score_identification <= 4))) not valid;

alter table "public"."dpo_violations" validate constraint "dpo_violations_score_identification_check";

alter table "public"."dpo_violations" add constraint "dpo_violations_score_nature_check" CHECK (((score_nature >= 1) AND (score_nature <= 4))) not valid;

alter table "public"."dpo_violations" validate constraint "dpo_violations_score_nature_check";

alter table "public"."dpo_violations" add constraint "dpo_violations_statut_check" CHECK ((statut = ANY (ARRAY['Détectée'::text, 'En analyse'::text, 'Notifiée CNIL'::text, 'Clôturée'::text, 'Archivée'::text]))) not valid;

alter table "public"."dpo_violations" validate constraint "dpo_violations_statut_check";

alter table "public"."etablissements_cibles" add constraint "etablissements_cibles_source_check" CHECK ((source = ANY (ARRAY['sirene'::text, 'google_places'::text]))) not valid;

alter table "public"."etablissements_cibles" validate constraint "etablissements_cibles_source_check";

alter table "public"."etablissements_cibles" add constraint "etablissements_cibles_source_identifier_key" UNIQUE using index "etablissements_cibles_source_identifier_key";

alter table "public"."etablissements_cibles" add constraint "etablissements_cibles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."etablissements_cibles" validate constraint "etablissements_cibles_user_id_fkey";

alter table "public"."factures" add constraint "factures_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL not valid;

alter table "public"."factures" validate constraint "factures_contact_id_fkey";

alter table "public"."factures" add constraint "factures_contract_id_fkey" FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL not valid;

alter table "public"."factures" validate constraint "factures_contract_id_fkey";

alter table "public"."factures" add constraint "factures_numero_key" UNIQUE using index "factures_numero_key";

alter table "public"."factures" add constraint "factures_stripe_event_id_key" UNIQUE using index "factures_stripe_event_id_key";

alter table "public"."fournisseurs" add constraint "fournisseurs_categorie_check" CHECK ((categorie = ANY (ARRAY['hebergeur'::text, 'sous-traitant'::text, 'editeur'::text, 'paiement'::text, 'communication'::text, 'securite'::text, 'autre'::text]))) not valid;

alter table "public"."fournisseurs" validate constraint "fournisseurs_categorie_check";

alter table "public"."fournisseurs" add constraint "fournisseurs_niveau_risque_check" CHECK ((niveau_risque = ANY (ARRAY['faible'::text, 'moyen'::text, 'eleve'::text]))) not valid;

alter table "public"."fournisseurs" validate constraint "fournisseurs_niveau_risque_check";

alter table "public"."incidents_nis2" add constraint "incidents_nis2_statut_check" CHECK ((statut = ANY (ARRAY['ouvert'::text, 'en_cours'::text, 'clos'::text]))) not valid;

alter table "public"."incidents_nis2" validate constraint "incidents_nis2_statut_check";

alter table "public"."incidents_nis2" add constraint "incidents_nis2_type_check" CHECK ((type = ANY (ARRAY['cyberattaque'::text, 'violation_donnees'::text, 'indisponibilite'::text, 'autre'::text]))) not valid;

alter table "public"."incidents_nis2" validate constraint "incidents_nis2_type_check";

alter table "public"."incidents_nis2" add constraint "incidents_nis2_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."incidents_nis2" validate constraint "incidents_nis2_user_id_fkey";

alter table "public"."leads_medecins" add constraint "leads_medecins_email_professionnel_key" UNIQUE using index "leads_medecins_email_professionnel_key";

alter table "public"."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_user_id_fkey";

alter table "public"."places_search_logs" add constraint "places_search_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."places_search_logs" validate constraint "places_search_logs_user_id_fkey";

alter table "public"."profiles" add constraint "profiles_dci_parent_id_fkey" FOREIGN KEY (dci_parent_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_dci_parent_id_fkey";

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'dci'::text, 'admin_candy'::text, 'super_admin'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

alter table "public"."registre_rgpd" add constraint "registre_rgpd_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES public.leads_medecins(id) ON DELETE CASCADE not valid;

alter table "public"."registre_rgpd" validate constraint "registre_rgpd_lead_id_fkey";

alter table "public"."relances_email" add constraint "relances_email_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES public.leads_medecins(id) ON DELETE CASCADE not valid;

alter table "public"."relances_email" validate constraint "relances_email_lead_id_fkey";

alter table "public"."safe_connector_secrets" add constraint "safe_connector_secrets_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) not valid;

alter table "public"."safe_connector_secrets" validate constraint "safe_connector_secrets_updated_by_fkey";

alter table "public"."seo_client_audits" add constraint "seo_client_audits_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE not valid;

alter table "public"."seo_client_audits" validate constraint "seo_client_audits_contact_id_fkey";

alter table "public"."seo_client_audits" add constraint "seo_client_audits_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."seo_client_audits" validate constraint "seo_client_audits_created_by_fkey";

alter table "public"."seo_client_audits" add constraint "seo_client_audits_domaine_id_fkey" FOREIGN KEY (domaine_id) REFERENCES public.seo_domaines(id) ON DELETE SET NULL not valid;

alter table "public"."seo_client_audits" validate constraint "seo_client_audits_domaine_id_fkey";

alter table "public"."seo_client_audits" add constraint "seo_client_audits_statut_check" CHECK ((statut = ANY (ARRAY['conforme'::text, 'partiel'::text, 'non_conforme'::text, 'na'::text, 'non_verifie'::text]))) not valid;

alter table "public"."seo_client_audits" validate constraint "seo_client_audits_statut_check";

alter table "public"."seo_client_mots_cles" add constraint "seo_client_mots_cles_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE not valid;

alter table "public"."seo_client_mots_cles" validate constraint "seo_client_mots_cles_contact_id_fkey";

alter table "public"."seo_client_mots_cles" add constraint "seo_client_mots_cles_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."seo_client_mots_cles" validate constraint "seo_client_mots_cles_created_by_fkey";

alter table "public"."seo_client_mots_cles" add constraint "seo_client_mots_cles_domaine_id_fkey" FOREIGN KEY (domaine_id) REFERENCES public.seo_domaines(id) ON DELETE SET NULL not valid;

alter table "public"."seo_client_mots_cles" validate constraint "seo_client_mots_cles_domaine_id_fkey";

alter table "public"."seo_client_mots_cles" add constraint "seo_client_mots_cles_type_mc_check" CHECK ((type_mc = ANY (ARRAY['principal'::text, 'secondaire'::text, 'longue_queue'::text]))) not valid;

alter table "public"."seo_client_mots_cles" validate constraint "seo_client_mots_cles_type_mc_check";

alter table "public"."seo_client_profiles" add constraint "seo_client_profiles_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE not valid;

alter table "public"."seo_client_profiles" validate constraint "seo_client_profiles_contact_id_fkey";

alter table "public"."seo_client_profiles" add constraint "seo_client_profiles_contact_id_key" UNIQUE using index "seo_client_profiles_contact_id_key";

alter table "public"."seo_client_profiles" add constraint "seo_client_profiles_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."seo_client_profiles" validate constraint "seo_client_profiles_created_by_fkey";

alter table "public"."seo_domaines" add constraint "seo_domaines_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE not valid;

alter table "public"."seo_domaines" validate constraint "seo_domaines_contact_id_fkey";

alter table "public"."social_client_profiles" add constraint "social_client_profiles_contact_id_key" UNIQUE using index "social_client_profiles_contact_id_key";

alter table "public"."tournee_etapes" add constraint "tournee_etapes_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL not valid;

alter table "public"."tournee_etapes" validate constraint "tournee_etapes_contact_id_fkey";

alter table "public"."tournee_etapes" add constraint "tournee_etapes_ordre_check" CHECK ((ordre >= 1)) not valid;

alter table "public"."tournee_etapes" validate constraint "tournee_etapes_ordre_check";

alter table "public"."tournee_etapes" add constraint "tournee_etapes_source_check" CHECK ((source = ANY (ARRAY['crm'::text, 'sirene'::text, 'google_places'::text]))) not valid;

alter table "public"."tournee_etapes" validate constraint "tournee_etapes_source_check";

alter table "public"."tournee_etapes" add constraint "tournee_etapes_tournee_id_fkey" FOREIGN KEY (tournee_id) REFERENCES public.tournees(id) ON DELETE CASCADE not valid;

alter table "public"."tournee_etapes" validate constraint "tournee_etapes_tournee_id_fkey";

alter table "public"."tournee_etapes" add constraint "tournee_etapes_tournee_id_ordre_key" UNIQUE using index "tournee_etapes_tournee_id_ordre_key";

alter table "public"."tournees" add constraint "tournees_commercial_id_fkey" FOREIGN KEY (commercial_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."tournees" validate constraint "tournees_commercial_id_fkey";

alter table "public"."tournees" add constraint "tournees_nb_etapes_max" CHECK ((nb_etapes <= 5)) not valid;

alter table "public"."tournees" validate constraint "tournees_nb_etapes_max";

alter table "public"."tournees" add constraint "tournees_statut_check" CHECK ((statut = ANY (ARRAY['planifiée'::text, 'en_cours'::text, 'terminée'::text, 'annulée'::text]))) not valid;

alter table "public"."tournees" validate constraint "tournees_statut_check";

alter table "public"."interactions" add constraint "interactions_type_check" CHECK ((type = ANY (ARRAY['Téléphone'::text, 'Email'::text, 'Visite'::text, 'LinkedIn'::text, 'Facebook'::text, 'Autre'::text]))) not valid;

alter table "public"."interactions" validate constraint "interactions_type_check";

alter table "public"."safe_connectors" add constraint "safe_connectors_statut_check" CHECK ((statut = ANY (ARRAY['non_configure'::text, 'configure'::text, 'actif'::text, 'simule'::text, 'desactive'::text]))) not valid;

alter table "public"."safe_connectors" validate constraint "safe_connectors_statut_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.audit_logs_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Le Journal RGPD est immuable : toute modification ou suppression est interdite (Article 30 RGPD).';
END;
$function$
;

DROP FUNCTION IF EXISTS public.check_profil_complet(uuid);

CREATE OR REPLACE FUNCTION public.check_profil_complet(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nom text; v_prenom text; v_adresse text; v_siret text;
begin
  select
    nom, prenom,
    coalesce(nullif(trim(adresse), ''), adresse_pro),
    coalesce(nullif(trim(siret), ''), siret)
  into v_nom, v_prenom, v_adresse, v_siret
  from profiles where id = p_user_id;

  return (
    v_nom is not null and trim(v_nom) <> '' and
    v_prenom is not null and trim(v_prenom) <> '' and
    v_adresse is not null and trim(v_adresse) <> '' and
    v_siret is not null and trim(v_siret) <> ''
  );
end;
$function$
;

DROP FUNCTION IF EXISTS public.check_resiliation_timeout();

CREATE OR REPLACE FUNCTION public.check_resiliation_timeout()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE contracts
  SET statut              = 'Erreur résiliation',
      resiliation_alerte_at = now()
  WHERE statut = 'Résiliation en attente Stripe'
    AND resiliation_validee_at < now() - interval '48 hours'
    AND resiliation_alerte_at IS NULL;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  SELECT NULL, 'resiliation_timeout_48h', 'contract', id,
         jsonb_build_object('stripe_subscription_id', stripe_subscription_id)
  FROM contracts
  WHERE statut = 'Erreur résiliation'
    AND resiliation_alerte_at >= now() - interval '1 minute';
END;
$function$
;

DROP FUNCTION IF EXISTS public.flag_profils_incomplets();

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
    and role in ('user','dci');
end;
$function$
;

DROP FUNCTION IF EXISTS public.fn_preview_purge_eligibles();

CREATE OR REPLACE FUNCTION public.fn_preview_purge_eligibles()
 RETURNS TABLE(contact_id uuid, nom text, entreprise text, email text, created_at timestamp with time zone, raison text, eligible_depuis date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY

  SELECT
    c.id,
    c.nom,
    c.entreprise,
    c.email,
    c.created_at,
    'Contrats terminés/résiliés depuis > 5 ans'::text,
    GREATEST(
      MAX(ct.date_echeance),
      MAX(ct."resilié_at"::date)
    ) AS eligible_depuis
  FROM contacts c
  JOIN contracts ct ON ct.contact_id = c.id
  WHERE c.purge_date IS NULL
    AND c.nom <> 'ANONYMISÉ'
  GROUP BY c.id, c.nom, c.entreprise, c.email, c.created_at
  HAVING
    COUNT(*) FILTER (WHERE ct.statut NOT IN ('Terminé','Résilié')) = 0
    AND GREATEST(
      MAX(ct.date_echeance),
      MAX(ct."resilié_at"::date)
    ) < CURRENT_DATE - INTERVAL '5 years'

  UNION ALL

  SELECT
    c.id,
    c.nom,
    c.entreprise,
    c.email,
    c.created_at,
    'Prospect sans activité depuis > 3 ans'::text,
    c.created_at::date
  FROM contacts c
  LEFT JOIN contracts ct ON ct.contact_id = c.id
  WHERE c.purge_date IS NULL
    AND c.nom <> 'ANONYMISÉ'
    AND ct.id IS NULL
    AND c.created_at < NOW() - INTERVAL '3 years'

  ORDER BY eligible_depuis NULLS LAST;
END;
$function$
;

DROP FUNCTION IF EXISTS public.fn_purge_contact(uuid);

CREATE OR REPLACE FUNCTION public.fn_purge_contact(p_contact_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nom       text;
  v_entreprise text;
BEGIN
  SELECT nom, entreprise INTO v_nom, v_entreprise
  FROM contacts WHERE id = p_contact_id;

  UPDATE contacts SET
    nom        = 'ANONYMISÉ',
    prenom     = NULL,
    email      = 'purge-' || p_contact_id::text || '@safe-purge.local',
    telephone  = NULL,
    linkedin   = NULL,
    adresse    = NULL,
    siret      = NULL,
    notes      = NULL,
    purge_date = NOW()
  WHERE id = p_contact_id;

  UPDATE interactions SET
    contenu = '[contenu anonymisé — purge RGPD ' || TO_CHAR(NOW(),'YYYY-MM-DD') || ']'
  WHERE contact_id = p_contact_id
    AND contenu IS NOT NULL
    AND contenu <> '';

  INSERT INTO audit_logs (
    user_id, user_role, action, entity_type, entity_id,
    module, criticite, resultat, donnees_concernees, details
  ) VALUES (
    NULL,
    'Système automatique',
    'purge_donnees_perimees',
    'contacts',
    p_contact_id,
    'RGPD',
    'Critique',
    'Succès',
    'nom, prénom, email, téléphone, LinkedIn, adresse, SIRET, notes, contenu interactions',
    jsonb_build_object(
      'contact_nom_original', v_nom,
      'contact_entreprise',   v_entreprise,
      'source',               'purge_automatique_rgpd'
    )
  );
END;
$function$
;

DROP FUNCTION IF EXISTS public.fn_purge_donnees_perimees(text);

CREATE OR REPLACE FUNCTION public.fn_purge_donnees_perimees(p_source text DEFAULT 'pg_cron'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row   record;
  v_count integer := 0;
BEGIN
  FOR v_row IN (SELECT contact_id FROM fn_preview_purge_eligibles()) LOOP
    PERFORM fn_purge_contact(v_row.contact_id);
    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    INSERT INTO audit_logs (
      user_id, user_role, action, entity_type,
      module, criticite, resultat, details
    ) VALUES (
      NULL, 'Système automatique', 'purge_donnees_perimees', 'contacts',
      'RGPD', 'Critique', 'Succès',
      jsonb_build_object('nb_contacts_purges', v_count, 'source', p_source)
    );
  END IF;

  RETURN v_count;
END;
$function$
;

DROP FUNCTION IF EXISTS public.get_anniversaires_du_jour();

CREATE OR REPLACE FUNCTION public.get_anniversaires_du_jour()
 RETURNS TABLE(lead_id uuid, prenom text, nom text, email text, specialite text, age integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    id,
    prenom_praticien,
    nom_praticien,
    email_professionnel,
    leads_medecins.specialite,
    DATE_PART('year', AGE(date_naissance_praticien))::INT AS age
  FROM leads_medecins
  WHERE
    EXTRACT(MONTH FROM date_naissance_praticien) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM date_naissance_praticien) = EXTRACT(DAY FROM CURRENT_DATE)
    AND date_naissance_praticien IS NOT NULL;
END;
$function$
;

DROP FUNCTION IF EXISTS public.get_my_role();

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text;
begin
  select role into v_role from profiles where id = auth.uid();
  return coalesce(v_role, 'user');
end;
$function$
;

DROP FUNCTION IF EXISTS public.get_team_ids();

CREATE OR REPLACE FUNCTION public.get_team_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ARRAY(SELECT id FROM profiles WHERE dci_parent_id = auth.uid());
$function$
;

DROP FUNCTION IF EXISTS public.get_user_email(uuid);

CREATE OR REPLACE FUNCTION public.get_user_email(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text;
begin
  -- Seuls les admins peuvent récupérer l'email d'un autre utilisateur
  if not is_admin() then
    return null;
  end if;
  select email into v_email from auth.users where id = p_user_id;
  return v_email;
end;
$function$
;

DROP FUNCTION IF EXISTS public.is_dci();

CREATE OR REPLACE FUNCTION public.is_dci()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role = 'dci' FROM profiles WHERE id = auth.uid()),
    false
  );
$function$
;

DROP FUNCTION IF EXISTS public.limite_km_tournee(uuid);

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
  IF v_role = 'dci'  THEN RETURN 200; END IF;
  RETURN 100;                                -- défaut NIV1 (role = 'user')
END;
$function$
;

DROP FUNCTION IF EXISTS public.purge_expired_tournees();

CREATE OR REPLACE FUNCTION public.purge_expired_tournees()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted integer;
BEGIN
  -- Les étapes sont supprimées en cascade (ON DELETE CASCADE)
  DELETE FROM tournees WHERE expires_at < now();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$function$
;

DROP FUNCTION IF EXISTS public.reset_test_data();

CREATE OR REPLACE FUNCTION public.reset_test_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reset_done text;
begin
  if not is_admin() then
    raise exception 'Accès refusé : super-administrateur uniquement.';
  end if;

  select value into v_reset_done from app_settings where key = 'reset_done';
  if v_reset_done = 'true' then
    raise exception 'La réinitialisation a déjà été effectuée.';
  end if;

  -- Supprimer dans l'ordre (FK oblige) — SANS les tâches
  -- WHERE true requis par pg_safeupdate
  delete from notifications        where true;
  delete from help_requests        where true;
  delete from bordereau_log        where true;
  delete from rgpd_log             where true;
  delete from interactions         where true;
  delete from contracts            where true;
  delete from contacts             where true;
  delete from mandat_otp           where true;
  delete from mandats              where true;
  delete from rate_limits          where true;
  delete from order_links          where true;

  -- Marquer comme fait
  update app_settings set value = 'true', updated_at = now() where key = 'reset_done';

  return jsonb_build_object('success', true, 'reset_at', now());
end;
$function$
;

DROP FUNCTION IF EXISTS public.set_contract_pdf_url(uuid, text);

CREATE OR REPLACE FUNCTION public.set_contract_pdf_url(p_contract_id uuid, p_pdf_url text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE contracts
  SET signed_pdf_contrat_url = p_pdf_url
  WHERE id = p_contract_id AND signed_pdf_contrat_url IS NULL;
$function$
;

create or replace view "public"."tournees_eco_bilan" as  SELECT t.commercial_id,
    p.prenom,
    p.nom,
    p.role,
    date_trunc('month'::text, (t.date_tournee)::timestamp with time zone) AS mois,
    count(*) AS nb_tournees,
    sum(t.nb_etapes) AS total_etapes,
    round(sum(t.distance_totale_km), 1) AS total_km,
    round(sum(t.score_co2_kg), 2) AS total_co2_kg,
    sum(
        CASE
            WHEN t.force_depassement THEN 1
            ELSE 0
        END) AS nb_depassements_forces
   FROM (public.tournees t
     JOIN public.profiles p ON ((p.id = t.commercial_id)))
  WHERE (t.statut <> 'annulée'::text)
  GROUP BY t.commercial_id, p.prenom, p.nom, p.role, (date_trunc('month'::text, (t.date_tournee)::timestamp with time zone));


CREATE OR REPLACE FUNCTION public.trg_notify_new_contract()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_contact_nom  text;
  v_contact_ent  text;
begin
  -- Récupérer le nom du contact associé
  select nom, entreprise
  into v_contact_nom, v_contact_ent
  from contacts
  where id = NEW.contact_id;

  -- Insérer une notification broadcast (user_id null = tous les admins)
  insert into notifications (type, titre, message, data)
  values (
    'new_contract',
    '📄 Nouveau contrat',
    coalesce(v_contact_ent, v_contact_nom, 'Contact inconnu')
      || ' — ' || coalesce(NEW.type, '')
      || (case when NEW.formule is not null then ' (' || NEW.formule || ')' else '' end),
    jsonb_build_object(
      'contract_id',  NEW.id,
      'contact_id',   NEW.contact_id,
      'contact_nom',  coalesce(v_contact_ent, v_contact_nom),
      'type',         NEW.type,
      'formule',      NEW.formule,
      'montant',      NEW.montant,
      'created_by',   NEW.created_by
    )
  );

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_update_profil_complet()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.profil_completed := check_profil_complet(new.id);
  if not new.profil_completed and new.profil_alerte_at is null then
    new.profil_alerte_at := now();
  end if;
  if new.profil_completed then
    new.profil_alerte_at := null;
    new.profil_revocation_flag := false;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_planifier_relance()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Nouvelle prise de contact : planifier relance J+3
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.etape_tunnel IS DISTINCT FROM NEW.etape_tunnel))
     AND NEW.etape_tunnel = 'Prise de contact'
  THEN
    INSERT INTO relances_email (lead_id, type_relance, date_envoi_prevu, statut)
    VALUES (
      NEW.id,
      'j3_post_contact',
      now() + INTERVAL '3 days',
      'en_attente'
    );
  END IF;

  -- Démo effectuée : planifier relance devis J+1
  IF TG_OP = 'UPDATE' AND OLD.etape_tunnel IS DISTINCT FROM NEW.etape_tunnel
     AND NEW.etape_tunnel = 'Démo effectuée'
  THEN
    -- Annuler relances précédentes
    UPDATE relances_email
    SET statut = 'annulé'
    WHERE lead_id = NEW.id AND statut = 'en_attente';

    INSERT INTO relances_email (lead_id, type_relance, date_envoi_prevu, statut)
    VALUES (
      NEW.id,
      'j1_post_demo',
      now() + INTERVAL '1 day',
      'en_attente'
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_rgpd_creation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO registre_rgpd (lead_id, type_evenement, description, source)
  VALUES (
    NEW.id,
    'COLLECTE_DONNEES',
    'Données collectées le ' || to_char(now(), 'DD/MM/YYYY à HH24:MI') ||
    ' via formulaire Landing Page. Consentement RGPD : ' ||
    CASE WHEN NEW.consentement_rgpd THEN 'accordé' ELSE 'non accordé' END ||
    '. Email : ' || NEW.email_professionnel,
    'formulaire_landing_page'
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_rgpd_modification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Log si changement d'étape
  IF OLD.etape_tunnel IS DISTINCT FROM NEW.etape_tunnel THEN
    INSERT INTO registre_rgpd (lead_id, type_evenement, description, source)
    VALUES (
      NEW.id,
      'MODIFICATION_ETAPE',
      'Étape modifiée le ' || to_char(now(), 'DD/MM/YYYY à HH24:MI') ||
      ' : "' || OLD.etape_tunnel || '" → "' || NEW.etape_tunnel || '"',
      'crm_backoffice'
    );
  END IF;

  -- Log si modification des données personnelles
  IF OLD.email_professionnel IS DISTINCT FROM NEW.email_professionnel
    OR OLD.telephone IS DISTINCT FROM NEW.telephone
    OR OLD.nom_praticien IS DISTINCT FROM NEW.nom_praticien
  THEN
    INSERT INTO registre_rgpd (lead_id, type_evenement, description, source)
    VALUES (
      NEW.id,
      'MODIFICATION_DONNEES',
      'Données personnelles modifiées le ' || to_char(now(), 'DD/MM/YYYY à HH24:MI'),
      'crm_backoffice'
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_cyber_audits_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_dpo_notices_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_dpo_soustraitants_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_dpo_transferts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_dpo_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

create or replace view "public"."v_equipe_dci" as  SELECT p.id AS member_id,
    p.prenom,
    p.nom,
    p.role,
    p.profil_completed AS profil_complet,
    p.dci_parent_id,
    parent.prenom AS dci_prenom,
    parent.nom AS dci_nom,
    count(DISTINCT ct.id) AS nb_contrats,
    COALESCE(sum(ct.montant), (0)::numeric) AS ca_total
   FROM ((public.profiles p
     LEFT JOIN public.profiles parent ON ((parent.id = p.dci_parent_id)))
     LEFT JOIN public.contracts ct ON (((ct.created_by = p.id) AND (ct.statut <> 'Terminé'::text))))
  GROUP BY p.id, p.prenom, p.nom, p.role, p.profil_completed, p.dci_parent_id, parent.prenom, parent.nom;


DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, prenom text, nom text, telephone text, adresse text, siret text, rcpro_numero text, numero_mandat text, role text, is_admin boolean, profil_completed boolean, profil_revocation_flag boolean, dci_parent_id uuid, region text, banned_until timestamp with time zone, created_at timestamp with time zone, limite_requetes_google_places integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : super-administrateur uniquement.';
  END IF;

  RETURN QUERY
    SELECT
      u.id,
      u.email::text,
      p.prenom,
      p.nom,
      p.telephone,
      p.adresse,
      p.siret,
      p.rcpro_numero,
      p.numero_mandat,
      p.role,
      COALESCE(p.is_admin, false)                        AS is_admin,
      COALESCE(p.profil_completed, false)                AS profil_completed,
      COALESCE(p.profil_revocation_flag, false)          AS profil_revocation_flag,
      p.dci_parent_id,
      p.region,
      u.banned_until,
      u.created_at,
      COALESCE(p.limite_requetes_google_places, 20)      AS limite_requetes_google_places
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$function$
;

DROP FUNCTION IF EXISTS public.get_order_by_token(text);

DROP FUNCTION IF EXISTS public.get_order_by_token(text);

CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order record;
BEGIN
    -- 1. On cherche le contrat via son identifiant ID
    SELECT * INTO v_order FROM public.contracts WHERE id::text = p_token;

    -- 2. Si aucun contrat n'est trouvé
    IF v_order IS NULL THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    -- 3. CORRECTION : On utilise la colonne "statut" (en français)
    -- Adaptez 'paid' ou 'paye' selon ce que vous écrivez dans votre base quand c'est réglé
    IF v_order.statut = 'paid' OR v_order.statut = 'paye' THEN
        RETURN jsonb_build_object('error', 'already_paid');
    END IF;

    -- 4. Si le lien a expiré (plus de 7 jours)
    IF v_order.created_at < NOW() - INTERVAL '7 days' THEN
        RETURN jsonb_build_object('error', 'expired');
    END IF;

    -- 5. Si tout est OK, on renvoie les données
    RETURN to_jsonb(v_order);
END;
$function$
;

DROP FUNCTION IF EXISTS public.get_pending_bordereaux(text);

CREATE OR REPLACE FUNCTION public.get_pending_bordereaux(p_periode text)
 RETURNS TABLE(user_id uuid, prenom text, email text, periode text, sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_admin() then
    raise exception 'Accès refusé : super-administrateur uniquement.';
  end if;

  return query
    select
      p.id          as user_id,
      p.prenom,
      au.email,
      p_periode     as periode,
      bl.sent_at
    from profiles p
    join auth.users au on au.id = p.id
    left join bordereau_log bl
      on bl.user_id = p.id and bl.periode = p_periode
    where p.is_admin = false
    order by p.prenom;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_admin_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (new.is_admin is distinct from old.is_admin)
  or (new.role     is distinct from old.role) then

    if not is_admin() then
      raise exception
        'Accès refusé : seul un administrateur peut modifier les droits ou le rôle (is_admin / role).';
    end if;

    if auth.uid() = old.id
       and (new.is_admin is distinct from old.is_admin)
       and not new.is_admin
    then
      raise exception
        'Vous ne pouvez pas retirer vos propres droits d''administrateur.';
    end if;

  end if;

  return new;
end;
$function$
;

create or replace view "public"."v_mandats" as  SELECT id,
    created_at,
    user_id,
    numero,
    prenom,
    nom,
    adresse,
    code_postal,
    ville,
    region,
    siret,
    rsac_numero,
    rsac_greffe,
    rcpro_assureur,
    rcpro_numero,
    rcpro_echeance,
    has_rcpro,
    signed_at,
    otp_verified_at,
    doc_hash,
    statut,
    resilie_at,
    resilie_motif,
    grille_version,
    grille_acceptee_at
   FROM public.mandats m;


grant delete on table "public"."app_settings" to "anon";

grant insert on table "public"."app_settings" to "anon";

grant references on table "public"."app_settings" to "anon";

grant select on table "public"."app_settings" to "anon";

grant trigger on table "public"."app_settings" to "anon";

grant truncate on table "public"."app_settings" to "anon";

grant update on table "public"."app_settings" to "anon";

grant delete on table "public"."app_settings" to "authenticated";

grant insert on table "public"."app_settings" to "authenticated";

grant references on table "public"."app_settings" to "authenticated";

grant select on table "public"."app_settings" to "authenticated";

grant trigger on table "public"."app_settings" to "authenticated";

grant truncate on table "public"."app_settings" to "authenticated";

grant update on table "public"."app_settings" to "authenticated";

grant delete on table "public"."app_settings" to "service_role";

grant insert on table "public"."app_settings" to "service_role";

grant references on table "public"."app_settings" to "service_role";

grant select on table "public"."app_settings" to "service_role";

grant trigger on table "public"."app_settings" to "service_role";

grant truncate on table "public"."app_settings" to "service_role";

grant update on table "public"."app_settings" to "service_role";

grant delete on table "public"."archived_users" to "anon";

grant insert on table "public"."archived_users" to "anon";

grant references on table "public"."archived_users" to "anon";

grant select on table "public"."archived_users" to "anon";

grant trigger on table "public"."archived_users" to "anon";

grant truncate on table "public"."archived_users" to "anon";

grant update on table "public"."archived_users" to "anon";

grant delete on table "public"."archived_users" to "authenticated";

grant insert on table "public"."archived_users" to "authenticated";

grant references on table "public"."archived_users" to "authenticated";

grant select on table "public"."archived_users" to "authenticated";

grant trigger on table "public"."archived_users" to "authenticated";

grant truncate on table "public"."archived_users" to "authenticated";

grant update on table "public"."archived_users" to "authenticated";

grant delete on table "public"."archived_users" to "service_role";

grant insert on table "public"."archived_users" to "service_role";

grant references on table "public"."archived_users" to "service_role";

grant select on table "public"."archived_users" to "service_role";

grant trigger on table "public"."archived_users" to "service_role";

grant truncate on table "public"."archived_users" to "service_role";

grant update on table "public"."archived_users" to "service_role";

grant delete on table "public"."audit_access_log" to "anon";

grant insert on table "public"."audit_access_log" to "anon";

grant select on table "public"."audit_access_log" to "anon";

grant update on table "public"."audit_access_log" to "anon";

grant delete on table "public"."audit_access_log" to "authenticated";

grant insert on table "public"."audit_access_log" to "authenticated";

grant select on table "public"."audit_access_log" to "authenticated";

grant update on table "public"."audit_access_log" to "authenticated";

grant delete on table "public"."audit_access_log" to "service_role";

grant insert on table "public"."audit_access_log" to "service_role";

grant select on table "public"."audit_access_log" to "service_role";

grant update on table "public"."audit_access_log" to "service_role";

grant delete on table "public"."audit_logs" to "anon";

grant insert on table "public"."audit_logs" to "anon";

grant references on table "public"."audit_logs" to "anon";

grant select on table "public"."audit_logs" to "anon";

grant trigger on table "public"."audit_logs" to "anon";

grant truncate on table "public"."audit_logs" to "anon";

grant update on table "public"."audit_logs" to "anon";

grant delete on table "public"."audit_logs" to "authenticated";

grant insert on table "public"."audit_logs" to "authenticated";

grant references on table "public"."audit_logs" to "authenticated";

grant select on table "public"."audit_logs" to "authenticated";

grant trigger on table "public"."audit_logs" to "authenticated";

grant truncate on table "public"."audit_logs" to "authenticated";

grant update on table "public"."audit_logs" to "authenticated";

grant delete on table "public"."audit_logs" to "service_role";

grant insert on table "public"."audit_logs" to "service_role";

grant references on table "public"."audit_logs" to "service_role";

grant select on table "public"."audit_logs" to "service_role";

grant trigger on table "public"."audit_logs" to "service_role";

grant truncate on table "public"."audit_logs" to "service_role";

grant update on table "public"."audit_logs" to "service_role";

grant delete on table "public"."bookings" to "anon";

grant insert on table "public"."bookings" to "anon";

grant select on table "public"."bookings" to "anon";

grant update on table "public"."bookings" to "anon";

grant delete on table "public"."bookings" to "authenticated";

grant insert on table "public"."bookings" to "authenticated";

grant select on table "public"."bookings" to "authenticated";

grant update on table "public"."bookings" to "authenticated";

grant delete on table "public"."bookings" to "service_role";

grant insert on table "public"."bookings" to "service_role";

grant select on table "public"."bookings" to "service_role";

grant update on table "public"."bookings" to "service_role";

grant delete on table "public"."bordereau_log" to "anon";

grant insert on table "public"."bordereau_log" to "anon";

grant select on table "public"."bordereau_log" to "anon";

grant update on table "public"."bordereau_log" to "anon";

grant delete on table "public"."bordereau_log" to "authenticated";

grant insert on table "public"."bordereau_log" to "authenticated";

grant select on table "public"."bordereau_log" to "authenticated";

grant update on table "public"."bordereau_log" to "authenticated";

grant delete on table "public"."bordereau_log" to "service_role";

grant insert on table "public"."bordereau_log" to "service_role";

grant select on table "public"."bordereau_log" to "service_role";

grant update on table "public"."bordereau_log" to "service_role";

grant delete on table "public"."cc_client_profiles" to "anon";

grant insert on table "public"."cc_client_profiles" to "anon";

grant references on table "public"."cc_client_profiles" to "anon";

grant select on table "public"."cc_client_profiles" to "anon";

grant trigger on table "public"."cc_client_profiles" to "anon";

grant truncate on table "public"."cc_client_profiles" to "anon";

grant update on table "public"."cc_client_profiles" to "anon";

grant delete on table "public"."cc_client_profiles" to "authenticated";

grant insert on table "public"."cc_client_profiles" to "authenticated";

grant references on table "public"."cc_client_profiles" to "authenticated";

grant select on table "public"."cc_client_profiles" to "authenticated";

grant trigger on table "public"."cc_client_profiles" to "authenticated";

grant truncate on table "public"."cc_client_profiles" to "authenticated";

grant update on table "public"."cc_client_profiles" to "authenticated";

grant delete on table "public"."cc_client_profiles" to "service_role";

grant insert on table "public"."cc_client_profiles" to "service_role";

grant references on table "public"."cc_client_profiles" to "service_role";

grant select on table "public"."cc_client_profiles" to "service_role";

grant trigger on table "public"."cc_client_profiles" to "service_role";

grant truncate on table "public"."cc_client_profiles" to "service_role";

grant update on table "public"."cc_client_profiles" to "service_role";

grant delete on table "public"."cc_commandes" to "anon";

grant insert on table "public"."cc_commandes" to "anon";

grant references on table "public"."cc_commandes" to "anon";

grant select on table "public"."cc_commandes" to "anon";

grant trigger on table "public"."cc_commandes" to "anon";

grant truncate on table "public"."cc_commandes" to "anon";

grant update on table "public"."cc_commandes" to "anon";

grant delete on table "public"."cc_commandes" to "authenticated";

grant insert on table "public"."cc_commandes" to "authenticated";

grant references on table "public"."cc_commandes" to "authenticated";

grant select on table "public"."cc_commandes" to "authenticated";

grant trigger on table "public"."cc_commandes" to "authenticated";

grant truncate on table "public"."cc_commandes" to "authenticated";

grant update on table "public"."cc_commandes" to "authenticated";

grant delete on table "public"."cc_commandes" to "service_role";

grant insert on table "public"."cc_commandes" to "service_role";

grant references on table "public"."cc_commandes" to "service_role";

grant select on table "public"."cc_commandes" to "service_role";

grant trigger on table "public"."cc_commandes" to "service_role";

grant truncate on table "public"."cc_commandes" to "service_role";

grant update on table "public"."cc_commandes" to "service_role";

grant delete on table "public"."cc_produits" to "anon";

grant insert on table "public"."cc_produits" to "anon";

grant references on table "public"."cc_produits" to "anon";

grant select on table "public"."cc_produits" to "anon";

grant trigger on table "public"."cc_produits" to "anon";

grant truncate on table "public"."cc_produits" to "anon";

grant update on table "public"."cc_produits" to "anon";

grant delete on table "public"."cc_produits" to "authenticated";

grant insert on table "public"."cc_produits" to "authenticated";

grant references on table "public"."cc_produits" to "authenticated";

grant select on table "public"."cc_produits" to "authenticated";

grant trigger on table "public"."cc_produits" to "authenticated";

grant truncate on table "public"."cc_produits" to "authenticated";

grant update on table "public"."cc_produits" to "authenticated";

grant delete on table "public"."cc_produits" to "service_role";

grant insert on table "public"."cc_produits" to "service_role";

grant references on table "public"."cc_produits" to "service_role";

grant select on table "public"."cc_produits" to "service_role";

grant trigger on table "public"."cc_produits" to "service_role";

grant truncate on table "public"."cc_produits" to "service_role";

grant update on table "public"."cc_produits" to "service_role";

grant delete on table "public"."chartes_usage_si" to "anon";

grant insert on table "public"."chartes_usage_si" to "anon";

grant references on table "public"."chartes_usage_si" to "anon";

grant select on table "public"."chartes_usage_si" to "anon";

grant trigger on table "public"."chartes_usage_si" to "anon";

grant truncate on table "public"."chartes_usage_si" to "anon";

grant update on table "public"."chartes_usage_si" to "anon";

grant delete on table "public"."chartes_usage_si" to "authenticated";

grant insert on table "public"."chartes_usage_si" to "authenticated";

grant references on table "public"."chartes_usage_si" to "authenticated";

grant select on table "public"."chartes_usage_si" to "authenticated";

grant trigger on table "public"."chartes_usage_si" to "authenticated";

grant truncate on table "public"."chartes_usage_si" to "authenticated";

grant update on table "public"."chartes_usage_si" to "authenticated";

grant delete on table "public"."chartes_usage_si" to "service_role";

grant insert on table "public"."chartes_usage_si" to "service_role";

grant references on table "public"."chartes_usage_si" to "service_role";

grant select on table "public"."chartes_usage_si" to "service_role";

grant trigger on table "public"."chartes_usage_si" to "service_role";

grant truncate on table "public"."chartes_usage_si" to "service_role";

grant update on table "public"."chartes_usage_si" to "service_role";

grant delete on table "public"."clauses_confidentialite" to "authenticated";

grant insert on table "public"."clauses_confidentialite" to "authenticated";

grant references on table "public"."clauses_confidentialite" to "authenticated";

grant select on table "public"."clauses_confidentialite" to "authenticated";

grant trigger on table "public"."clauses_confidentialite" to "authenticated";

grant truncate on table "public"."clauses_confidentialite" to "authenticated";

grant update on table "public"."clauses_confidentialite" to "authenticated";

grant delete on table "public"."clauses_confidentialite" to "service_role";

grant insert on table "public"."clauses_confidentialite" to "service_role";

grant references on table "public"."clauses_confidentialite" to "service_role";

grant select on table "public"."clauses_confidentialite" to "service_role";

grant trigger on table "public"."clauses_confidentialite" to "service_role";

grant truncate on table "public"."clauses_confidentialite" to "service_role";

grant update on table "public"."clauses_confidentialite" to "service_role";

grant delete on table "public"."contacts" to "anon";

grant insert on table "public"."contacts" to "anon";

grant select on table "public"."contacts" to "anon";

grant update on table "public"."contacts" to "anon";

grant delete on table "public"."contacts" to "authenticated";

grant insert on table "public"."contacts" to "authenticated";

grant select on table "public"."contacts" to "authenticated";

grant update on table "public"."contacts" to "authenticated";

grant delete on table "public"."contacts" to "service_role";

grant insert on table "public"."contacts" to "service_role";

grant select on table "public"."contacts" to "service_role";

grant update on table "public"."contacts" to "service_role";

grant delete on table "public"."contracts" to "anon";

grant insert on table "public"."contracts" to "anon";

grant select on table "public"."contracts" to "anon";

grant update on table "public"."contracts" to "anon";

grant delete on table "public"."contracts" to "authenticated";

grant insert on table "public"."contracts" to "authenticated";

grant select on table "public"."contracts" to "authenticated";

grant update on table "public"."contracts" to "authenticated";

grant delete on table "public"."contracts" to "service_role";

grant insert on table "public"."contracts" to "service_role";

grant select on table "public"."contracts" to "service_role";

grant update on table "public"."contracts" to "service_role";

grant delete on table "public"."cyber_audits" to "anon";

grant insert on table "public"."cyber_audits" to "anon";

grant references on table "public"."cyber_audits" to "anon";

grant select on table "public"."cyber_audits" to "anon";

grant trigger on table "public"."cyber_audits" to "anon";

grant truncate on table "public"."cyber_audits" to "anon";

grant update on table "public"."cyber_audits" to "anon";

grant delete on table "public"."cyber_audits" to "authenticated";

grant insert on table "public"."cyber_audits" to "authenticated";

grant references on table "public"."cyber_audits" to "authenticated";

grant select on table "public"."cyber_audits" to "authenticated";

grant trigger on table "public"."cyber_audits" to "authenticated";

grant truncate on table "public"."cyber_audits" to "authenticated";

grant update on table "public"."cyber_audits" to "authenticated";

grant delete on table "public"."cyber_audits" to "service_role";

grant insert on table "public"."cyber_audits" to "service_role";

grant references on table "public"."cyber_audits" to "service_role";

grant select on table "public"."cyber_audits" to "service_role";

grant trigger on table "public"."cyber_audits" to "service_role";

grant truncate on table "public"."cyber_audits" to "service_role";

grant update on table "public"."cyber_audits" to "service_role";

grant delete on table "public"."cyber_client_audits" to "anon";

grant insert on table "public"."cyber_client_audits" to "anon";

grant references on table "public"."cyber_client_audits" to "anon";

grant select on table "public"."cyber_client_audits" to "anon";

grant trigger on table "public"."cyber_client_audits" to "anon";

grant truncate on table "public"."cyber_client_audits" to "anon";

grant update on table "public"."cyber_client_audits" to "anon";

grant delete on table "public"."cyber_client_audits" to "authenticated";

grant insert on table "public"."cyber_client_audits" to "authenticated";

grant references on table "public"."cyber_client_audits" to "authenticated";

grant select on table "public"."cyber_client_audits" to "authenticated";

grant trigger on table "public"."cyber_client_audits" to "authenticated";

grant truncate on table "public"."cyber_client_audits" to "authenticated";

grant update on table "public"."cyber_client_audits" to "authenticated";

grant delete on table "public"."cyber_client_audits" to "service_role";

grant insert on table "public"."cyber_client_audits" to "service_role";

grant references on table "public"."cyber_client_audits" to "service_role";

grant select on table "public"."cyber_client_audits" to "service_role";

grant trigger on table "public"."cyber_client_audits" to "service_role";

grant truncate on table "public"."cyber_client_audits" to "service_role";

grant update on table "public"."cyber_client_audits" to "service_role";

grant delete on table "public"."cyber_client_incidents" to "anon";

grant insert on table "public"."cyber_client_incidents" to "anon";

grant references on table "public"."cyber_client_incidents" to "anon";

grant select on table "public"."cyber_client_incidents" to "anon";

grant trigger on table "public"."cyber_client_incidents" to "anon";

grant truncate on table "public"."cyber_client_incidents" to "anon";

grant update on table "public"."cyber_client_incidents" to "anon";

grant delete on table "public"."cyber_client_incidents" to "authenticated";

grant insert on table "public"."cyber_client_incidents" to "authenticated";

grant references on table "public"."cyber_client_incidents" to "authenticated";

grant select on table "public"."cyber_client_incidents" to "authenticated";

grant trigger on table "public"."cyber_client_incidents" to "authenticated";

grant truncate on table "public"."cyber_client_incidents" to "authenticated";

grant update on table "public"."cyber_client_incidents" to "authenticated";

grant delete on table "public"."cyber_client_incidents" to "service_role";

grant insert on table "public"."cyber_client_incidents" to "service_role";

grant references on table "public"."cyber_client_incidents" to "service_role";

grant select on table "public"."cyber_client_incidents" to "service_role";

grant trigger on table "public"."cyber_client_incidents" to "service_role";

grant truncate on table "public"."cyber_client_incidents" to "service_role";

grant update on table "public"."cyber_client_incidents" to "service_role";

grant delete on table "public"."cyber_client_plan" to "anon";

grant insert on table "public"."cyber_client_plan" to "anon";

grant references on table "public"."cyber_client_plan" to "anon";

grant select on table "public"."cyber_client_plan" to "anon";

grant trigger on table "public"."cyber_client_plan" to "anon";

grant truncate on table "public"."cyber_client_plan" to "anon";

grant update on table "public"."cyber_client_plan" to "anon";

grant delete on table "public"."cyber_client_plan" to "authenticated";

grant insert on table "public"."cyber_client_plan" to "authenticated";

grant references on table "public"."cyber_client_plan" to "authenticated";

grant select on table "public"."cyber_client_plan" to "authenticated";

grant trigger on table "public"."cyber_client_plan" to "authenticated";

grant truncate on table "public"."cyber_client_plan" to "authenticated";

grant update on table "public"."cyber_client_plan" to "authenticated";

grant delete on table "public"."cyber_client_plan" to "service_role";

grant insert on table "public"."cyber_client_plan" to "service_role";

grant references on table "public"."cyber_client_plan" to "service_role";

grant select on table "public"."cyber_client_plan" to "service_role";

grant trigger on table "public"."cyber_client_plan" to "service_role";

grant truncate on table "public"."cyber_client_plan" to "service_role";

grant update on table "public"."cyber_client_plan" to "service_role";

grant delete on table "public"."cyber_client_profiles" to "anon";

grant insert on table "public"."cyber_client_profiles" to "anon";

grant references on table "public"."cyber_client_profiles" to "anon";

grant select on table "public"."cyber_client_profiles" to "anon";

grant trigger on table "public"."cyber_client_profiles" to "anon";

grant truncate on table "public"."cyber_client_profiles" to "anon";

grant update on table "public"."cyber_client_profiles" to "anon";

grant delete on table "public"."cyber_client_profiles" to "authenticated";

grant insert on table "public"."cyber_client_profiles" to "authenticated";

grant references on table "public"."cyber_client_profiles" to "authenticated";

grant select on table "public"."cyber_client_profiles" to "authenticated";

grant trigger on table "public"."cyber_client_profiles" to "authenticated";

grant truncate on table "public"."cyber_client_profiles" to "authenticated";

grant update on table "public"."cyber_client_profiles" to "authenticated";

grant delete on table "public"."cyber_client_profiles" to "service_role";

grant insert on table "public"."cyber_client_profiles" to "service_role";

grant references on table "public"."cyber_client_profiles" to "service_role";

grant select on table "public"."cyber_client_profiles" to "service_role";

grant trigger on table "public"."cyber_client_profiles" to "service_role";

grant truncate on table "public"."cyber_client_profiles" to "service_role";

grant update on table "public"."cyber_client_profiles" to "service_role";

grant delete on table "public"."dpo_aipd" to "anon";

grant insert on table "public"."dpo_aipd" to "anon";

grant references on table "public"."dpo_aipd" to "anon";

grant select on table "public"."dpo_aipd" to "anon";

grant trigger on table "public"."dpo_aipd" to "anon";

grant truncate on table "public"."dpo_aipd" to "anon";

grant update on table "public"."dpo_aipd" to "anon";

grant delete on table "public"."dpo_aipd" to "authenticated";

grant insert on table "public"."dpo_aipd" to "authenticated";

grant references on table "public"."dpo_aipd" to "authenticated";

grant select on table "public"."dpo_aipd" to "authenticated";

grant trigger on table "public"."dpo_aipd" to "authenticated";

grant truncate on table "public"."dpo_aipd" to "authenticated";

grant update on table "public"."dpo_aipd" to "authenticated";

grant delete on table "public"."dpo_aipd" to "service_role";

grant insert on table "public"."dpo_aipd" to "service_role";

grant references on table "public"."dpo_aipd" to "service_role";

grant select on table "public"."dpo_aipd" to "service_role";

grant trigger on table "public"."dpo_aipd" to "service_role";

grant truncate on table "public"."dpo_aipd" to "service_role";

grant update on table "public"."dpo_aipd" to "service_role";

grant delete on table "public"."dpo_client_audit_items" to "anon";

grant insert on table "public"."dpo_client_audit_items" to "anon";

grant select on table "public"."dpo_client_audit_items" to "anon";

grant update on table "public"."dpo_client_audit_items" to "anon";

grant delete on table "public"."dpo_client_audit_items" to "authenticated";

grant insert on table "public"."dpo_client_audit_items" to "authenticated";

grant select on table "public"."dpo_client_audit_items" to "authenticated";

grant update on table "public"."dpo_client_audit_items" to "authenticated";

grant delete on table "public"."dpo_client_audit_items" to "service_role";

grant insert on table "public"."dpo_client_audit_items" to "service_role";

grant select on table "public"."dpo_client_audit_items" to "service_role";

grant update on table "public"."dpo_client_audit_items" to "service_role";

grant delete on table "public"."dpo_client_consentements" to "anon";

grant insert on table "public"."dpo_client_consentements" to "anon";

grant select on table "public"."dpo_client_consentements" to "anon";

grant update on table "public"."dpo_client_consentements" to "anon";

grant delete on table "public"."dpo_client_consentements" to "authenticated";

grant insert on table "public"."dpo_client_consentements" to "authenticated";

grant select on table "public"."dpo_client_consentements" to "authenticated";

grant update on table "public"."dpo_client_consentements" to "authenticated";

grant delete on table "public"."dpo_client_consentements" to "service_role";

grant insert on table "public"."dpo_client_consentements" to "service_role";

grant select on table "public"."dpo_client_consentements" to "service_role";

grant update on table "public"."dpo_client_consentements" to "service_role";

grant delete on table "public"."dpo_client_demandes" to "anon";

grant insert on table "public"."dpo_client_demandes" to "anon";

grant select on table "public"."dpo_client_demandes" to "anon";

grant update on table "public"."dpo_client_demandes" to "anon";

grant delete on table "public"."dpo_client_demandes" to "authenticated";

grant insert on table "public"."dpo_client_demandes" to "authenticated";

grant select on table "public"."dpo_client_demandes" to "authenticated";

grant update on table "public"."dpo_client_demandes" to "authenticated";

grant delete on table "public"."dpo_client_demandes" to "service_role";

grant insert on table "public"."dpo_client_demandes" to "service_role";

grant select on table "public"."dpo_client_demandes" to "service_role";

grant update on table "public"."dpo_client_demandes" to "service_role";

grant delete on table "public"."dpo_client_documents" to "anon";

grant insert on table "public"."dpo_client_documents" to "anon";

grant select on table "public"."dpo_client_documents" to "anon";

grant update on table "public"."dpo_client_documents" to "anon";

grant delete on table "public"."dpo_client_documents" to "authenticated";

grant insert on table "public"."dpo_client_documents" to "authenticated";

grant select on table "public"."dpo_client_documents" to "authenticated";

grant update on table "public"."dpo_client_documents" to "authenticated";

grant delete on table "public"."dpo_client_documents" to "service_role";

grant insert on table "public"."dpo_client_documents" to "service_role";

grant select on table "public"."dpo_client_documents" to "service_role";

grant update on table "public"."dpo_client_documents" to "service_role";

grant delete on table "public"."dpo_client_profiles" to "anon";

grant insert on table "public"."dpo_client_profiles" to "anon";

grant select on table "public"."dpo_client_profiles" to "anon";

grant update on table "public"."dpo_client_profiles" to "anon";

grant delete on table "public"."dpo_client_profiles" to "authenticated";

grant insert on table "public"."dpo_client_profiles" to "authenticated";

grant select on table "public"."dpo_client_profiles" to "authenticated";

grant update on table "public"."dpo_client_profiles" to "authenticated";

grant delete on table "public"."dpo_client_profiles" to "service_role";

grant insert on table "public"."dpo_client_profiles" to "service_role";

grant select on table "public"."dpo_client_profiles" to "service_role";

grant update on table "public"."dpo_client_profiles" to "service_role";

grant delete on table "public"."dpo_client_traitements" to "anon";

grant insert on table "public"."dpo_client_traitements" to "anon";

grant select on table "public"."dpo_client_traitements" to "anon";

grant update on table "public"."dpo_client_traitements" to "anon";

grant delete on table "public"."dpo_client_traitements" to "authenticated";

grant insert on table "public"."dpo_client_traitements" to "authenticated";

grant select on table "public"."dpo_client_traitements" to "authenticated";

grant update on table "public"."dpo_client_traitements" to "authenticated";

grant delete on table "public"."dpo_client_traitements" to "service_role";

grant insert on table "public"."dpo_client_traitements" to "service_role";

grant select on table "public"."dpo_client_traitements" to "service_role";

grant update on table "public"."dpo_client_traitements" to "service_role";

grant delete on table "public"."dpo_client_violations" to "anon";

grant insert on table "public"."dpo_client_violations" to "anon";

grant select on table "public"."dpo_client_violations" to "anon";

grant update on table "public"."dpo_client_violations" to "anon";

grant delete on table "public"."dpo_client_violations" to "authenticated";

grant insert on table "public"."dpo_client_violations" to "authenticated";

grant select on table "public"."dpo_client_violations" to "authenticated";

grant update on table "public"."dpo_client_violations" to "authenticated";

grant delete on table "public"."dpo_client_violations" to "service_role";

grant insert on table "public"."dpo_client_violations" to "service_role";

grant select on table "public"."dpo_client_violations" to "service_role";

grant update on table "public"."dpo_client_violations" to "service_role";

grant delete on table "public"."dpo_der" to "anon";

grant insert on table "public"."dpo_der" to "anon";

grant references on table "public"."dpo_der" to "anon";

grant select on table "public"."dpo_der" to "anon";

grant trigger on table "public"."dpo_der" to "anon";

grant truncate on table "public"."dpo_der" to "anon";

grant update on table "public"."dpo_der" to "anon";

grant delete on table "public"."dpo_der" to "authenticated";

grant insert on table "public"."dpo_der" to "authenticated";

grant references on table "public"."dpo_der" to "authenticated";

grant select on table "public"."dpo_der" to "authenticated";

grant trigger on table "public"."dpo_der" to "authenticated";

grant truncate on table "public"."dpo_der" to "authenticated";

grant update on table "public"."dpo_der" to "authenticated";

grant delete on table "public"."dpo_der" to "service_role";

grant insert on table "public"."dpo_der" to "service_role";

grant references on table "public"."dpo_der" to "service_role";

grant select on table "public"."dpo_der" to "service_role";

grant trigger on table "public"."dpo_der" to "service_role";

grant truncate on table "public"."dpo_der" to "service_role";

grant update on table "public"."dpo_der" to "service_role";

grant delete on table "public"."dpo_notices" to "anon";

grant insert on table "public"."dpo_notices" to "anon";

grant references on table "public"."dpo_notices" to "anon";

grant select on table "public"."dpo_notices" to "anon";

grant trigger on table "public"."dpo_notices" to "anon";

grant truncate on table "public"."dpo_notices" to "anon";

grant update on table "public"."dpo_notices" to "anon";

grant delete on table "public"."dpo_notices" to "authenticated";

grant insert on table "public"."dpo_notices" to "authenticated";

grant references on table "public"."dpo_notices" to "authenticated";

grant select on table "public"."dpo_notices" to "authenticated";

grant trigger on table "public"."dpo_notices" to "authenticated";

grant truncate on table "public"."dpo_notices" to "authenticated";

grant update on table "public"."dpo_notices" to "authenticated";

grant delete on table "public"."dpo_notices" to "service_role";

grant insert on table "public"."dpo_notices" to "service_role";

grant references on table "public"."dpo_notices" to "service_role";

grant select on table "public"."dpo_notices" to "service_role";

grant trigger on table "public"."dpo_notices" to "service_role";

grant truncate on table "public"."dpo_notices" to "service_role";

grant update on table "public"."dpo_notices" to "service_role";

grant delete on table "public"."dpo_soustraitants" to "anon";

grant insert on table "public"."dpo_soustraitants" to "anon";

grant references on table "public"."dpo_soustraitants" to "anon";

grant select on table "public"."dpo_soustraitants" to "anon";

grant trigger on table "public"."dpo_soustraitants" to "anon";

grant truncate on table "public"."dpo_soustraitants" to "anon";

grant update on table "public"."dpo_soustraitants" to "anon";

grant delete on table "public"."dpo_soustraitants" to "authenticated";

grant insert on table "public"."dpo_soustraitants" to "authenticated";

grant references on table "public"."dpo_soustraitants" to "authenticated";

grant select on table "public"."dpo_soustraitants" to "authenticated";

grant trigger on table "public"."dpo_soustraitants" to "authenticated";

grant truncate on table "public"."dpo_soustraitants" to "authenticated";

grant update on table "public"."dpo_soustraitants" to "authenticated";

grant delete on table "public"."dpo_soustraitants" to "service_role";

grant insert on table "public"."dpo_soustraitants" to "service_role";

grant references on table "public"."dpo_soustraitants" to "service_role";

grant select on table "public"."dpo_soustraitants" to "service_role";

grant trigger on table "public"."dpo_soustraitants" to "service_role";

grant truncate on table "public"."dpo_soustraitants" to "service_role";

grant update on table "public"."dpo_soustraitants" to "service_role";

grant delete on table "public"."dpo_traitements" to "anon";

grant insert on table "public"."dpo_traitements" to "anon";

grant references on table "public"."dpo_traitements" to "anon";

grant select on table "public"."dpo_traitements" to "anon";

grant trigger on table "public"."dpo_traitements" to "anon";

grant truncate on table "public"."dpo_traitements" to "anon";

grant update on table "public"."dpo_traitements" to "anon";

grant delete on table "public"."dpo_traitements" to "authenticated";

grant insert on table "public"."dpo_traitements" to "authenticated";

grant references on table "public"."dpo_traitements" to "authenticated";

grant select on table "public"."dpo_traitements" to "authenticated";

grant trigger on table "public"."dpo_traitements" to "authenticated";

grant truncate on table "public"."dpo_traitements" to "authenticated";

grant update on table "public"."dpo_traitements" to "authenticated";

grant delete on table "public"."dpo_traitements" to "service_role";

grant insert on table "public"."dpo_traitements" to "service_role";

grant references on table "public"."dpo_traitements" to "service_role";

grant select on table "public"."dpo_traitements" to "service_role";

grant trigger on table "public"."dpo_traitements" to "service_role";

grant truncate on table "public"."dpo_traitements" to "service_role";

grant update on table "public"."dpo_traitements" to "service_role";

grant delete on table "public"."dpo_transferts" to "anon";

grant insert on table "public"."dpo_transferts" to "anon";

grant references on table "public"."dpo_transferts" to "anon";

grant select on table "public"."dpo_transferts" to "anon";

grant trigger on table "public"."dpo_transferts" to "anon";

grant truncate on table "public"."dpo_transferts" to "anon";

grant update on table "public"."dpo_transferts" to "anon";

grant delete on table "public"."dpo_transferts" to "authenticated";

grant insert on table "public"."dpo_transferts" to "authenticated";

grant references on table "public"."dpo_transferts" to "authenticated";

grant select on table "public"."dpo_transferts" to "authenticated";

grant trigger on table "public"."dpo_transferts" to "authenticated";

grant truncate on table "public"."dpo_transferts" to "authenticated";

grant update on table "public"."dpo_transferts" to "authenticated";

grant delete on table "public"."dpo_transferts" to "service_role";

grant insert on table "public"."dpo_transferts" to "service_role";

grant references on table "public"."dpo_transferts" to "service_role";

grant select on table "public"."dpo_transferts" to "service_role";

grant trigger on table "public"."dpo_transferts" to "service_role";

grant truncate on table "public"."dpo_transferts" to "service_role";

grant update on table "public"."dpo_transferts" to "service_role";

grant delete on table "public"."dpo_violations" to "anon";

grant insert on table "public"."dpo_violations" to "anon";

grant references on table "public"."dpo_violations" to "anon";

grant select on table "public"."dpo_violations" to "anon";

grant trigger on table "public"."dpo_violations" to "anon";

grant truncate on table "public"."dpo_violations" to "anon";

grant update on table "public"."dpo_violations" to "anon";

grant delete on table "public"."dpo_violations" to "authenticated";

grant insert on table "public"."dpo_violations" to "authenticated";

grant references on table "public"."dpo_violations" to "authenticated";

grant select on table "public"."dpo_violations" to "authenticated";

grant trigger on table "public"."dpo_violations" to "authenticated";

grant truncate on table "public"."dpo_violations" to "authenticated";

grant update on table "public"."dpo_violations" to "authenticated";

grant delete on table "public"."dpo_violations" to "service_role";

grant insert on table "public"."dpo_violations" to "service_role";

grant references on table "public"."dpo_violations" to "service_role";

grant select on table "public"."dpo_violations" to "service_role";

grant trigger on table "public"."dpo_violations" to "service_role";

grant truncate on table "public"."dpo_violations" to "service_role";

grant update on table "public"."dpo_violations" to "service_role";

grant delete on table "public"."etablissements_cibles" to "anon";

grant insert on table "public"."etablissements_cibles" to "anon";

grant references on table "public"."etablissements_cibles" to "anon";

grant select on table "public"."etablissements_cibles" to "anon";

grant trigger on table "public"."etablissements_cibles" to "anon";

grant truncate on table "public"."etablissements_cibles" to "anon";

grant update on table "public"."etablissements_cibles" to "anon";

grant delete on table "public"."etablissements_cibles" to "authenticated";

grant insert on table "public"."etablissements_cibles" to "authenticated";

grant references on table "public"."etablissements_cibles" to "authenticated";

grant select on table "public"."etablissements_cibles" to "authenticated";

grant trigger on table "public"."etablissements_cibles" to "authenticated";

grant truncate on table "public"."etablissements_cibles" to "authenticated";

grant update on table "public"."etablissements_cibles" to "authenticated";

grant delete on table "public"."etablissements_cibles" to "service_role";

grant insert on table "public"."etablissements_cibles" to "service_role";

grant references on table "public"."etablissements_cibles" to "service_role";

grant select on table "public"."etablissements_cibles" to "service_role";

grant trigger on table "public"."etablissements_cibles" to "service_role";

grant truncate on table "public"."etablissements_cibles" to "service_role";

grant update on table "public"."etablissements_cibles" to "service_role";

grant delete on table "public"."factures" to "anon";

grant insert on table "public"."factures" to "anon";

grant references on table "public"."factures" to "anon";

grant select on table "public"."factures" to "anon";

grant trigger on table "public"."factures" to "anon";

grant truncate on table "public"."factures" to "anon";

grant update on table "public"."factures" to "anon";

grant delete on table "public"."factures" to "authenticated";

grant insert on table "public"."factures" to "authenticated";

grant references on table "public"."factures" to "authenticated";

grant select on table "public"."factures" to "authenticated";

grant trigger on table "public"."factures" to "authenticated";

grant truncate on table "public"."factures" to "authenticated";

grant update on table "public"."factures" to "authenticated";

grant delete on table "public"."factures" to "service_role";

grant insert on table "public"."factures" to "service_role";

grant references on table "public"."factures" to "service_role";

grant select on table "public"."factures" to "service_role";

grant trigger on table "public"."factures" to "service_role";

grant truncate on table "public"."factures" to "service_role";

grant update on table "public"."factures" to "service_role";

grant delete on table "public"."fournisseurs" to "anon";

grant insert on table "public"."fournisseurs" to "anon";

grant references on table "public"."fournisseurs" to "anon";

grant select on table "public"."fournisseurs" to "anon";

grant trigger on table "public"."fournisseurs" to "anon";

grant truncate on table "public"."fournisseurs" to "anon";

grant update on table "public"."fournisseurs" to "anon";

grant delete on table "public"."fournisseurs" to "authenticated";

grant insert on table "public"."fournisseurs" to "authenticated";

grant references on table "public"."fournisseurs" to "authenticated";

grant select on table "public"."fournisseurs" to "authenticated";

grant trigger on table "public"."fournisseurs" to "authenticated";

grant truncate on table "public"."fournisseurs" to "authenticated";

grant update on table "public"."fournisseurs" to "authenticated";

grant delete on table "public"."fournisseurs" to "service_role";

grant insert on table "public"."fournisseurs" to "service_role";

grant references on table "public"."fournisseurs" to "service_role";

grant select on table "public"."fournisseurs" to "service_role";

grant trigger on table "public"."fournisseurs" to "service_role";

grant truncate on table "public"."fournisseurs" to "service_role";

grant update on table "public"."fournisseurs" to "service_role";

grant delete on table "public"."help_requests" to "anon";

grant insert on table "public"."help_requests" to "anon";

grant select on table "public"."help_requests" to "anon";

grant update on table "public"."help_requests" to "anon";

grant delete on table "public"."help_requests" to "authenticated";

grant insert on table "public"."help_requests" to "authenticated";

grant select on table "public"."help_requests" to "authenticated";

grant update on table "public"."help_requests" to "authenticated";

grant delete on table "public"."help_requests" to "service_role";

grant insert on table "public"."help_requests" to "service_role";

grant select on table "public"."help_requests" to "service_role";

grant update on table "public"."help_requests" to "service_role";

grant delete on table "public"."incidents_nis2" to "anon";

grant insert on table "public"."incidents_nis2" to "anon";

grant references on table "public"."incidents_nis2" to "anon";

grant select on table "public"."incidents_nis2" to "anon";

grant trigger on table "public"."incidents_nis2" to "anon";

grant truncate on table "public"."incidents_nis2" to "anon";

grant update on table "public"."incidents_nis2" to "anon";

grant delete on table "public"."incidents_nis2" to "authenticated";

grant insert on table "public"."incidents_nis2" to "authenticated";

grant references on table "public"."incidents_nis2" to "authenticated";

grant select on table "public"."incidents_nis2" to "authenticated";

grant trigger on table "public"."incidents_nis2" to "authenticated";

grant truncate on table "public"."incidents_nis2" to "authenticated";

grant update on table "public"."incidents_nis2" to "authenticated";

grant delete on table "public"."incidents_nis2" to "service_role";

grant insert on table "public"."incidents_nis2" to "service_role";

grant references on table "public"."incidents_nis2" to "service_role";

grant select on table "public"."incidents_nis2" to "service_role";

grant trigger on table "public"."incidents_nis2" to "service_role";

grant truncate on table "public"."incidents_nis2" to "service_role";

grant update on table "public"."incidents_nis2" to "service_role";

grant delete on table "public"."interactions" to "anon";

grant insert on table "public"."interactions" to "anon";

grant select on table "public"."interactions" to "anon";

grant update on table "public"."interactions" to "anon";

grant delete on table "public"."interactions" to "authenticated";

grant insert on table "public"."interactions" to "authenticated";

grant select on table "public"."interactions" to "authenticated";

grant update on table "public"."interactions" to "authenticated";

grant delete on table "public"."interactions" to "service_role";

grant insert on table "public"."interactions" to "service_role";

grant select on table "public"."interactions" to "service_role";

grant update on table "public"."interactions" to "service_role";

grant delete on table "public"."leads_medecins" to "anon";

grant insert on table "public"."leads_medecins" to "anon";

grant references on table "public"."leads_medecins" to "anon";

grant select on table "public"."leads_medecins" to "anon";

grant trigger on table "public"."leads_medecins" to "anon";

grant truncate on table "public"."leads_medecins" to "anon";

grant update on table "public"."leads_medecins" to "anon";

grant delete on table "public"."leads_medecins" to "authenticated";

grant insert on table "public"."leads_medecins" to "authenticated";

grant references on table "public"."leads_medecins" to "authenticated";

grant select on table "public"."leads_medecins" to "authenticated";

grant trigger on table "public"."leads_medecins" to "authenticated";

grant truncate on table "public"."leads_medecins" to "authenticated";

grant update on table "public"."leads_medecins" to "authenticated";

grant delete on table "public"."leads_medecins" to "service_role";

grant insert on table "public"."leads_medecins" to "service_role";

grant references on table "public"."leads_medecins" to "service_role";

grant select on table "public"."leads_medecins" to "service_role";

grant trigger on table "public"."leads_medecins" to "service_role";

grant truncate on table "public"."leads_medecins" to "service_role";

grant update on table "public"."leads_medecins" to "service_role";

grant delete on table "public"."login_alerts" to "anon";

grant insert on table "public"."login_alerts" to "anon";

grant select on table "public"."login_alerts" to "anon";

grant update on table "public"."login_alerts" to "anon";

grant delete on table "public"."login_alerts" to "authenticated";

grant insert on table "public"."login_alerts" to "authenticated";

grant select on table "public"."login_alerts" to "authenticated";

grant update on table "public"."login_alerts" to "authenticated";

grant delete on table "public"."login_alerts" to "service_role";

grant insert on table "public"."login_alerts" to "service_role";

grant select on table "public"."login_alerts" to "service_role";

grant update on table "public"."login_alerts" to "service_role";

grant delete on table "public"."login_attempts" to "anon";

grant insert on table "public"."login_attempts" to "anon";

grant select on table "public"."login_attempts" to "anon";

grant update on table "public"."login_attempts" to "anon";

grant delete on table "public"."login_attempts" to "authenticated";

grant insert on table "public"."login_attempts" to "authenticated";

grant select on table "public"."login_attempts" to "authenticated";

grant update on table "public"."login_attempts" to "authenticated";

grant delete on table "public"."login_attempts" to "service_role";

grant insert on table "public"."login_attempts" to "service_role";

grant select on table "public"."login_attempts" to "service_role";

grant update on table "public"."login_attempts" to "service_role";

grant delete on table "public"."login_audit" to "anon";

grant insert on table "public"."login_audit" to "anon";

grant select on table "public"."login_audit" to "anon";

grant update on table "public"."login_audit" to "anon";

grant delete on table "public"."login_audit" to "authenticated";

grant insert on table "public"."login_audit" to "authenticated";

grant select on table "public"."login_audit" to "authenticated";

grant update on table "public"."login_audit" to "authenticated";

grant delete on table "public"."login_audit" to "service_role";

grant insert on table "public"."login_audit" to "service_role";

grant select on table "public"."login_audit" to "service_role";

grant update on table "public"."login_audit" to "service_role";

grant delete on table "public"."mandat_otp" to "anon";

grant insert on table "public"."mandat_otp" to "anon";

grant select on table "public"."mandat_otp" to "anon";

grant update on table "public"."mandat_otp" to "anon";

grant delete on table "public"."mandat_otp" to "authenticated";

grant insert on table "public"."mandat_otp" to "authenticated";

grant select on table "public"."mandat_otp" to "authenticated";

grant update on table "public"."mandat_otp" to "authenticated";

grant delete on table "public"."mandat_otp" to "service_role";

grant insert on table "public"."mandat_otp" to "service_role";

grant select on table "public"."mandat_otp" to "service_role";

grant update on table "public"."mandat_otp" to "service_role";

grant delete on table "public"."mandats" to "anon";

grant insert on table "public"."mandats" to "anon";

grant select on table "public"."mandats" to "anon";

grant update on table "public"."mandats" to "anon";

grant delete on table "public"."mandats" to "authenticated";

grant insert on table "public"."mandats" to "authenticated";

grant select on table "public"."mandats" to "authenticated";

grant update on table "public"."mandats" to "authenticated";

grant delete on table "public"."mandats" to "service_role";

grant insert on table "public"."mandats" to "service_role";

grant select on table "public"."mandats" to "service_role";

grant update on table "public"."mandats" to "service_role";

grant delete on table "public"."messages" to "anon";

grant insert on table "public"."messages" to "anon";

grant select on table "public"."messages" to "anon";

grant update on table "public"."messages" to "anon";

grant delete on table "public"."messages" to "authenticated";

grant insert on table "public"."messages" to "authenticated";

grant select on table "public"."messages" to "authenticated";

grant update on table "public"."messages" to "authenticated";

grant delete on table "public"."messages" to "service_role";

grant insert on table "public"."messages" to "service_role";

grant select on table "public"."messages" to "service_role";

grant update on table "public"."messages" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."objectifs" to "anon";

grant insert on table "public"."objectifs" to "anon";

grant select on table "public"."objectifs" to "anon";

grant update on table "public"."objectifs" to "anon";

grant delete on table "public"."objectifs" to "authenticated";

grant insert on table "public"."objectifs" to "authenticated";

grant select on table "public"."objectifs" to "authenticated";

grant update on table "public"."objectifs" to "authenticated";

grant delete on table "public"."objectifs" to "service_role";

grant insert on table "public"."objectifs" to "service_role";

grant select on table "public"."objectifs" to "service_role";

grant update on table "public"."objectifs" to "service_role";

grant delete on table "public"."places_search_logs" to "anon";

grant insert on table "public"."places_search_logs" to "anon";

grant references on table "public"."places_search_logs" to "anon";

grant select on table "public"."places_search_logs" to "anon";

grant trigger on table "public"."places_search_logs" to "anon";

grant truncate on table "public"."places_search_logs" to "anon";

grant update on table "public"."places_search_logs" to "anon";

grant delete on table "public"."places_search_logs" to "authenticated";

grant insert on table "public"."places_search_logs" to "authenticated";

grant references on table "public"."places_search_logs" to "authenticated";

grant select on table "public"."places_search_logs" to "authenticated";

grant trigger on table "public"."places_search_logs" to "authenticated";

grant truncate on table "public"."places_search_logs" to "authenticated";

grant update on table "public"."places_search_logs" to "authenticated";

grant delete on table "public"."places_search_logs" to "service_role";

grant insert on table "public"."places_search_logs" to "service_role";

grant references on table "public"."places_search_logs" to "service_role";

grant select on table "public"."places_search_logs" to "service_role";

grant trigger on table "public"."places_search_logs" to "service_role";

grant truncate on table "public"."places_search_logs" to "service_role";

grant update on table "public"."places_search_logs" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."rate_limits" to "anon";

grant insert on table "public"."rate_limits" to "anon";

grant select on table "public"."rate_limits" to "anon";

grant update on table "public"."rate_limits" to "anon";

grant delete on table "public"."rate_limits" to "authenticated";

grant insert on table "public"."rate_limits" to "authenticated";

grant select on table "public"."rate_limits" to "authenticated";

grant update on table "public"."rate_limits" to "authenticated";

grant delete on table "public"."rate_limits" to "service_role";

grant insert on table "public"."rate_limits" to "service_role";

grant select on table "public"."rate_limits" to "service_role";

grant update on table "public"."rate_limits" to "service_role";

grant delete on table "public"."registre_rgpd" to "anon";

grant insert on table "public"."registre_rgpd" to "anon";

grant references on table "public"."registre_rgpd" to "anon";

grant select on table "public"."registre_rgpd" to "anon";

grant trigger on table "public"."registre_rgpd" to "anon";

grant truncate on table "public"."registre_rgpd" to "anon";

grant update on table "public"."registre_rgpd" to "anon";

grant delete on table "public"."registre_rgpd" to "authenticated";

grant insert on table "public"."registre_rgpd" to "authenticated";

grant references on table "public"."registre_rgpd" to "authenticated";

grant select on table "public"."registre_rgpd" to "authenticated";

grant trigger on table "public"."registre_rgpd" to "authenticated";

grant truncate on table "public"."registre_rgpd" to "authenticated";

grant update on table "public"."registre_rgpd" to "authenticated";

grant delete on table "public"."registre_rgpd" to "service_role";

grant insert on table "public"."registre_rgpd" to "service_role";

grant references on table "public"."registre_rgpd" to "service_role";

grant select on table "public"."registre_rgpd" to "service_role";

grant trigger on table "public"."registre_rgpd" to "service_role";

grant truncate on table "public"."registre_rgpd" to "service_role";

grant update on table "public"."registre_rgpd" to "service_role";

grant delete on table "public"."relances_email" to "anon";

grant insert on table "public"."relances_email" to "anon";

grant references on table "public"."relances_email" to "anon";

grant select on table "public"."relances_email" to "anon";

grant trigger on table "public"."relances_email" to "anon";

grant truncate on table "public"."relances_email" to "anon";

grant update on table "public"."relances_email" to "anon";

grant delete on table "public"."relances_email" to "authenticated";

grant insert on table "public"."relances_email" to "authenticated";

grant references on table "public"."relances_email" to "authenticated";

grant select on table "public"."relances_email" to "authenticated";

grant trigger on table "public"."relances_email" to "authenticated";

grant truncate on table "public"."relances_email" to "authenticated";

grant update on table "public"."relances_email" to "authenticated";

grant delete on table "public"."relances_email" to "service_role";

grant insert on table "public"."relances_email" to "service_role";

grant references on table "public"."relances_email" to "service_role";

grant select on table "public"."relances_email" to "service_role";

grant trigger on table "public"."relances_email" to "service_role";

grant truncate on table "public"."relances_email" to "service_role";

grant update on table "public"."relances_email" to "service_role";

grant delete on table "public"."rgpd_log" to "anon";

grant insert on table "public"."rgpd_log" to "anon";

grant select on table "public"."rgpd_log" to "anon";

grant update on table "public"."rgpd_log" to "anon";

grant delete on table "public"."rgpd_log" to "authenticated";

grant insert on table "public"."rgpd_log" to "authenticated";

grant select on table "public"."rgpd_log" to "authenticated";

grant update on table "public"."rgpd_log" to "authenticated";

grant delete on table "public"."rgpd_log" to "service_role";

grant insert on table "public"."rgpd_log" to "service_role";

grant select on table "public"."rgpd_log" to "service_role";

grant update on table "public"."rgpd_log" to "service_role";

grant delete on table "public"."safe_connector_secrets" to "anon";

grant insert on table "public"."safe_connector_secrets" to "anon";

grant references on table "public"."safe_connector_secrets" to "anon";

grant select on table "public"."safe_connector_secrets" to "anon";

grant trigger on table "public"."safe_connector_secrets" to "anon";

grant truncate on table "public"."safe_connector_secrets" to "anon";

grant update on table "public"."safe_connector_secrets" to "anon";

grant delete on table "public"."safe_connector_secrets" to "authenticated";

grant insert on table "public"."safe_connector_secrets" to "authenticated";

grant references on table "public"."safe_connector_secrets" to "authenticated";

grant select on table "public"."safe_connector_secrets" to "authenticated";

grant trigger on table "public"."safe_connector_secrets" to "authenticated";

grant truncate on table "public"."safe_connector_secrets" to "authenticated";

grant update on table "public"."safe_connector_secrets" to "authenticated";

grant delete on table "public"."safe_connector_secrets" to "service_role";

grant insert on table "public"."safe_connector_secrets" to "service_role";

grant references on table "public"."safe_connector_secrets" to "service_role";

grant select on table "public"."safe_connector_secrets" to "service_role";

grant trigger on table "public"."safe_connector_secrets" to "service_role";

grant truncate on table "public"."safe_connector_secrets" to "service_role";

grant update on table "public"."safe_connector_secrets" to "service_role";

grant delete on table "public"."safe_connectors" to "anon";

grant insert on table "public"."safe_connectors" to "anon";

grant select on table "public"."safe_connectors" to "anon";

grant update on table "public"."safe_connectors" to "anon";

grant delete on table "public"."safe_connectors" to "authenticated";

grant insert on table "public"."safe_connectors" to "authenticated";

grant select on table "public"."safe_connectors" to "authenticated";

grant update on table "public"."safe_connectors" to "authenticated";

grant delete on table "public"."safe_connectors" to "service_role";

grant insert on table "public"."safe_connectors" to "service_role";

grant select on table "public"."safe_connectors" to "service_role";

grant update on table "public"."safe_connectors" to "service_role";

grant delete on table "public"."safe_connectors_log" to "anon";

grant insert on table "public"."safe_connectors_log" to "anon";

grant select on table "public"."safe_connectors_log" to "anon";

grant update on table "public"."safe_connectors_log" to "anon";

grant delete on table "public"."safe_connectors_log" to "authenticated";

grant insert on table "public"."safe_connectors_log" to "authenticated";

grant select on table "public"."safe_connectors_log" to "authenticated";

grant update on table "public"."safe_connectors_log" to "authenticated";

grant delete on table "public"."safe_connectors_log" to "service_role";

grant insert on table "public"."safe_connectors_log" to "service_role";

grant select on table "public"."safe_connectors_log" to "service_role";

grant update on table "public"."safe_connectors_log" to "service_role";

grant delete on table "public"."seo_client_audits" to "anon";

grant insert on table "public"."seo_client_audits" to "anon";

grant references on table "public"."seo_client_audits" to "anon";

grant select on table "public"."seo_client_audits" to "anon";

grant trigger on table "public"."seo_client_audits" to "anon";

grant truncate on table "public"."seo_client_audits" to "anon";

grant update on table "public"."seo_client_audits" to "anon";

grant delete on table "public"."seo_client_audits" to "authenticated";

grant insert on table "public"."seo_client_audits" to "authenticated";

grant references on table "public"."seo_client_audits" to "authenticated";

grant select on table "public"."seo_client_audits" to "authenticated";

grant trigger on table "public"."seo_client_audits" to "authenticated";

grant truncate on table "public"."seo_client_audits" to "authenticated";

grant update on table "public"."seo_client_audits" to "authenticated";

grant delete on table "public"."seo_client_audits" to "service_role";

grant insert on table "public"."seo_client_audits" to "service_role";

grant references on table "public"."seo_client_audits" to "service_role";

grant select on table "public"."seo_client_audits" to "service_role";

grant trigger on table "public"."seo_client_audits" to "service_role";

grant truncate on table "public"."seo_client_audits" to "service_role";

grant update on table "public"."seo_client_audits" to "service_role";

grant delete on table "public"."seo_client_mots_cles" to "anon";

grant insert on table "public"."seo_client_mots_cles" to "anon";

grant references on table "public"."seo_client_mots_cles" to "anon";

grant select on table "public"."seo_client_mots_cles" to "anon";

grant trigger on table "public"."seo_client_mots_cles" to "anon";

grant truncate on table "public"."seo_client_mots_cles" to "anon";

grant update on table "public"."seo_client_mots_cles" to "anon";

grant delete on table "public"."seo_client_mots_cles" to "authenticated";

grant insert on table "public"."seo_client_mots_cles" to "authenticated";

grant references on table "public"."seo_client_mots_cles" to "authenticated";

grant select on table "public"."seo_client_mots_cles" to "authenticated";

grant trigger on table "public"."seo_client_mots_cles" to "authenticated";

grant truncate on table "public"."seo_client_mots_cles" to "authenticated";

grant update on table "public"."seo_client_mots_cles" to "authenticated";

grant delete on table "public"."seo_client_mots_cles" to "service_role";

grant insert on table "public"."seo_client_mots_cles" to "service_role";

grant references on table "public"."seo_client_mots_cles" to "service_role";

grant select on table "public"."seo_client_mots_cles" to "service_role";

grant trigger on table "public"."seo_client_mots_cles" to "service_role";

grant truncate on table "public"."seo_client_mots_cles" to "service_role";

grant update on table "public"."seo_client_mots_cles" to "service_role";

grant delete on table "public"."seo_client_profiles" to "anon";

grant insert on table "public"."seo_client_profiles" to "anon";

grant references on table "public"."seo_client_profiles" to "anon";

grant select on table "public"."seo_client_profiles" to "anon";

grant trigger on table "public"."seo_client_profiles" to "anon";

grant truncate on table "public"."seo_client_profiles" to "anon";

grant update on table "public"."seo_client_profiles" to "anon";

grant delete on table "public"."seo_client_profiles" to "authenticated";

grant insert on table "public"."seo_client_profiles" to "authenticated";

grant references on table "public"."seo_client_profiles" to "authenticated";

grant select on table "public"."seo_client_profiles" to "authenticated";

grant trigger on table "public"."seo_client_profiles" to "authenticated";

grant truncate on table "public"."seo_client_profiles" to "authenticated";

grant update on table "public"."seo_client_profiles" to "authenticated";

grant delete on table "public"."seo_client_profiles" to "service_role";

grant insert on table "public"."seo_client_profiles" to "service_role";

grant references on table "public"."seo_client_profiles" to "service_role";

grant select on table "public"."seo_client_profiles" to "service_role";

grant trigger on table "public"."seo_client_profiles" to "service_role";

grant truncate on table "public"."seo_client_profiles" to "service_role";

grant update on table "public"."seo_client_profiles" to "service_role";

grant delete on table "public"."seo_domaines" to "anon";

grant insert on table "public"."seo_domaines" to "anon";

grant references on table "public"."seo_domaines" to "anon";

grant select on table "public"."seo_domaines" to "anon";

grant trigger on table "public"."seo_domaines" to "anon";

grant truncate on table "public"."seo_domaines" to "anon";

grant update on table "public"."seo_domaines" to "anon";

grant delete on table "public"."seo_domaines" to "authenticated";

grant insert on table "public"."seo_domaines" to "authenticated";

grant references on table "public"."seo_domaines" to "authenticated";

grant select on table "public"."seo_domaines" to "authenticated";

grant trigger on table "public"."seo_domaines" to "authenticated";

grant truncate on table "public"."seo_domaines" to "authenticated";

grant update on table "public"."seo_domaines" to "authenticated";

grant delete on table "public"."seo_domaines" to "service_role";

grant insert on table "public"."seo_domaines" to "service_role";

grant references on table "public"."seo_domaines" to "service_role";

grant select on table "public"."seo_domaines" to "service_role";

grant trigger on table "public"."seo_domaines" to "service_role";

grant truncate on table "public"."seo_domaines" to "service_role";

grant update on table "public"."seo_domaines" to "service_role";

grant delete on table "public"."social_client_profiles" to "anon";

grant insert on table "public"."social_client_profiles" to "anon";

grant references on table "public"."social_client_profiles" to "anon";

grant select on table "public"."social_client_profiles" to "anon";

grant trigger on table "public"."social_client_profiles" to "anon";

grant truncate on table "public"."social_client_profiles" to "anon";

grant update on table "public"."social_client_profiles" to "anon";

grant delete on table "public"."social_client_profiles" to "authenticated";

grant insert on table "public"."social_client_profiles" to "authenticated";

grant references on table "public"."social_client_profiles" to "authenticated";

grant select on table "public"."social_client_profiles" to "authenticated";

grant trigger on table "public"."social_client_profiles" to "authenticated";

grant truncate on table "public"."social_client_profiles" to "authenticated";

grant update on table "public"."social_client_profiles" to "authenticated";

grant delete on table "public"."social_client_profiles" to "service_role";

grant insert on table "public"."social_client_profiles" to "service_role";

grant references on table "public"."social_client_profiles" to "service_role";

grant select on table "public"."social_client_profiles" to "service_role";

grant trigger on table "public"."social_client_profiles" to "service_role";

grant truncate on table "public"."social_client_profiles" to "service_role";

grant update on table "public"."social_client_profiles" to "service_role";

grant delete on table "public"."social_posts" to "anon";

grant insert on table "public"."social_posts" to "anon";

grant references on table "public"."social_posts" to "anon";

grant select on table "public"."social_posts" to "anon";

grant trigger on table "public"."social_posts" to "anon";

grant truncate on table "public"."social_posts" to "anon";

grant update on table "public"."social_posts" to "anon";

grant delete on table "public"."social_posts" to "authenticated";

grant insert on table "public"."social_posts" to "authenticated";

grant references on table "public"."social_posts" to "authenticated";

grant select on table "public"."social_posts" to "authenticated";

grant trigger on table "public"."social_posts" to "authenticated";

grant truncate on table "public"."social_posts" to "authenticated";

grant update on table "public"."social_posts" to "authenticated";

grant delete on table "public"."social_posts" to "service_role";

grant insert on table "public"."social_posts" to "service_role";

grant references on table "public"."social_posts" to "service_role";

grant select on table "public"."social_posts" to "service_role";

grant trigger on table "public"."social_posts" to "service_role";

grant truncate on table "public"."social_posts" to "service_role";

grant update on table "public"."social_posts" to "service_role";

grant delete on table "public"."tasks" to "anon";

grant insert on table "public"."tasks" to "anon";

grant select on table "public"."tasks" to "anon";

grant update on table "public"."tasks" to "anon";

grant delete on table "public"."tasks" to "authenticated";

grant insert on table "public"."tasks" to "authenticated";

grant select on table "public"."tasks" to "authenticated";

grant update on table "public"."tasks" to "authenticated";

grant delete on table "public"."tasks" to "service_role";

grant insert on table "public"."tasks" to "service_role";

grant select on table "public"."tasks" to "service_role";

grant update on table "public"."tasks" to "service_role";

grant delete on table "public"."totp_audit" to "anon";

grant insert on table "public"."totp_audit" to "anon";

grant select on table "public"."totp_audit" to "anon";

grant update on table "public"."totp_audit" to "anon";

grant delete on table "public"."totp_audit" to "authenticated";

grant insert on table "public"."totp_audit" to "authenticated";

grant select on table "public"."totp_audit" to "authenticated";

grant update on table "public"."totp_audit" to "authenticated";

grant delete on table "public"."totp_audit" to "service_role";

grant insert on table "public"."totp_audit" to "service_role";

grant select on table "public"."totp_audit" to "service_role";

grant update on table "public"."totp_audit" to "service_role";

grant delete on table "public"."tournee_etapes" to "anon";

grant insert on table "public"."tournee_etapes" to "anon";

grant references on table "public"."tournee_etapes" to "anon";

grant select on table "public"."tournee_etapes" to "anon";

grant trigger on table "public"."tournee_etapes" to "anon";

grant truncate on table "public"."tournee_etapes" to "anon";

grant update on table "public"."tournee_etapes" to "anon";

grant delete on table "public"."tournee_etapes" to "authenticated";

grant insert on table "public"."tournee_etapes" to "authenticated";

grant references on table "public"."tournee_etapes" to "authenticated";

grant select on table "public"."tournee_etapes" to "authenticated";

grant trigger on table "public"."tournee_etapes" to "authenticated";

grant truncate on table "public"."tournee_etapes" to "authenticated";

grant update on table "public"."tournee_etapes" to "authenticated";

grant delete on table "public"."tournee_etapes" to "service_role";

grant insert on table "public"."tournee_etapes" to "service_role";

grant references on table "public"."tournee_etapes" to "service_role";

grant select on table "public"."tournee_etapes" to "service_role";

grant trigger on table "public"."tournee_etapes" to "service_role";

grant truncate on table "public"."tournee_etapes" to "service_role";

grant update on table "public"."tournee_etapes" to "service_role";

grant delete on table "public"."tournees" to "anon";

grant insert on table "public"."tournees" to "anon";

grant references on table "public"."tournees" to "anon";

grant select on table "public"."tournees" to "anon";

grant trigger on table "public"."tournees" to "anon";

grant truncate on table "public"."tournees" to "anon";

grant update on table "public"."tournees" to "anon";

grant delete on table "public"."tournees" to "authenticated";

grant insert on table "public"."tournees" to "authenticated";

grant references on table "public"."tournees" to "authenticated";

grant select on table "public"."tournees" to "authenticated";

grant trigger on table "public"."tournees" to "authenticated";

grant truncate on table "public"."tournees" to "authenticated";

grant update on table "public"."tournees" to "authenticated";

grant delete on table "public"."tournees" to "service_role";

grant insert on table "public"."tournees" to "service_role";

grant references on table "public"."tournees" to "service_role";

grant select on table "public"."tournees" to "service_role";

grant trigger on table "public"."tournees" to "service_role";

grant truncate on table "public"."tournees" to "service_role";

grant update on table "public"."tournees" to "service_role";

grant delete on table "public"."work_journal" to "anon";

grant insert on table "public"."work_journal" to "anon";

grant references on table "public"."work_journal" to "anon";

grant select on table "public"."work_journal" to "anon";

grant trigger on table "public"."work_journal" to "anon";

grant truncate on table "public"."work_journal" to "anon";

grant update on table "public"."work_journal" to "anon";

grant delete on table "public"."work_journal" to "authenticated";

grant insert on table "public"."work_journal" to "authenticated";

grant references on table "public"."work_journal" to "authenticated";

grant select on table "public"."work_journal" to "authenticated";

grant trigger on table "public"."work_journal" to "authenticated";

grant truncate on table "public"."work_journal" to "authenticated";

grant update on table "public"."work_journal" to "authenticated";

grant delete on table "public"."work_journal" to "service_role";

grant insert on table "public"."work_journal" to "service_role";

grant references on table "public"."work_journal" to "service_role";

grant select on table "public"."work_journal" to "service_role";

grant trigger on table "public"."work_journal" to "service_role";

grant truncate on table "public"."work_journal" to "service_role";

grant update on table "public"."work_journal" to "service_role";


  create policy "app_settings_admin"
  on "public"."app_settings"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "Admins peuvent insérer les archives"
  on "public"."archived_users"
  as permissive
  for insert
  to public
with check (public.is_admin());



  create policy "Admins peuvent lire les archives"
  on "public"."archived_users"
  as permissive
  for select
  to public
using (public.is_admin());



  create policy "audit_access_log_read_dpo"
  on "public"."audit_access_log"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin_candy'::text]))))));



  create policy "audit_insert_auth"
  on "public"."audit_logs"
  as permissive
  for insert
  to authenticated
with check (((user_id = auth.uid()) OR public.is_admin()));



  create policy "audit_select_admin"
  on "public"."audit_logs"
  as permissive
  for select
  to public
using (public.is_admin());



  create policy "audit_select_own"
  on "public"."audit_logs"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "cc_profiles_auth"
  on "public"."cc_client_profiles"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "cc_commandes_auth"
  on "public"."cc_commandes"
  as permissive
  for all
  to authenticated
using ((auth.uid() IS NOT NULL))
with check ((auth.uid() IS NOT NULL));



  create policy "cc_produits_auth"
  on "public"."cc_produits"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "users_insert_own_charte"
  on "public"."chartes_usage_si"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "users_read_own_charte"
  on "public"."chartes_usage_si"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "clause_insert"
  on "public"."clauses_confidentialite"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "clause_select"
  on "public"."clauses_confidentialite"
  as permissive
  for select
  to authenticated
using (((user_id = auth.uid()) OR public.is_admin()));



  create policy "contacts_select"
  on "public"."contacts"
  as permissive
  for select
  to authenticated
using ((public.is_admin() OR (created_by = auth.uid()) OR (public.is_dci() AND (created_by = ANY (public.get_team_ids())))));



  create policy "contracts_select"
  on "public"."contracts"
  as permissive
  for select
  to authenticated
using ((public.is_admin() OR (created_by = auth.uid()) OR (public.is_dci() AND (created_by = ANY (public.get_team_ids())))));



  create policy "Insertion propre"
  on "public"."cyber_audits"
  as permissive
  for insert
  to public
with check ((auth.uid() = created_by));



  create policy "Lecture propre"
  on "public"."cyber_audits"
  as permissive
  for select
  to public
using ((auth.uid() = created_by));



  create policy "Mise à jour propre"
  on "public"."cyber_audits"
  as permissive
  for update
  to public
using ((auth.uid() = created_by));



  create policy "Suppression propre"
  on "public"."cyber_audits"
  as permissive
  for delete
  to public
using ((auth.uid() = created_by));



  create policy "auth_cyber_audits"
  on "public"."cyber_client_audits"
  as permissive
  for all
  to authenticated
using ((auth.uid() = created_by))
with check ((auth.uid() = created_by));



  create policy "auth_cyber_incidents"
  on "public"."cyber_client_incidents"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "auth_cyber_plan"
  on "public"."cyber_client_plan"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "auth_cyber_profiles"
  on "public"."cyber_client_profiles"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "del_dpo_aipd"
  on "public"."dpo_aipd"
  as permissive
  for delete
  to public
using ((auth.uid() = created_by));



  create policy "ins_dpo_aipd"
  on "public"."dpo_aipd"
  as permissive
  for insert
  to public
with check ((auth.uid() = created_by));



  create policy "sel_dpo_aipd"
  on "public"."dpo_aipd"
  as permissive
  for select
  to public
using ((auth.uid() = created_by));



  create policy "upd_dpo_aipd"
  on "public"."dpo_aipd"
  as permissive
  for update
  to public
using ((auth.uid() = created_by));



  create policy "del_dpo_der"
  on "public"."dpo_der"
  as permissive
  for delete
  to public
using ((auth.uid() = created_by));



  create policy "ins_dpo_der"
  on "public"."dpo_der"
  as permissive
  for insert
  to public
with check ((auth.uid() = created_by));



  create policy "sel_dpo_der"
  on "public"."dpo_der"
  as permissive
  for select
  to public
using ((auth.uid() = created_by));



  create policy "upd_dpo_der"
  on "public"."dpo_der"
  as permissive
  for update
  to public
using ((auth.uid() = created_by));



  create policy "auth_only"
  on "public"."dpo_notices"
  as permissive
  for all
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "auth_only"
  on "public"."dpo_soustraitants"
  as permissive
  for all
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "del_dpo_traitements"
  on "public"."dpo_traitements"
  as permissive
  for delete
  to public
using ((auth.uid() = created_by));



  create policy "ins_dpo_traitements"
  on "public"."dpo_traitements"
  as permissive
  for insert
  to public
with check ((auth.uid() = created_by));



  create policy "sel_dpo_traitements"
  on "public"."dpo_traitements"
  as permissive
  for select
  to public
using ((auth.uid() = created_by));



  create policy "upd_dpo_traitements"
  on "public"."dpo_traitements"
  as permissive
  for update
  to public
using ((auth.uid() = created_by));



  create policy "auth_only"
  on "public"."dpo_transferts"
  as permissive
  for all
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "del_dpo_violations"
  on "public"."dpo_violations"
  as permissive
  for delete
  to public
using ((auth.uid() = created_by));



  create policy "ins_dpo_violations"
  on "public"."dpo_violations"
  as permissive
  for insert
  to public
with check ((auth.uid() = created_by));



  create policy "sel_dpo_violations"
  on "public"."dpo_violations"
  as permissive
  for select
  to public
using ((auth.uid() = created_by));



  create policy "upd_dpo_violations"
  on "public"."dpo_violations"
  as permissive
  for update
  to public
using ((auth.uid() = created_by));



  create policy "etab_cibles_insert"
  on "public"."etablissements_cibles"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "etab_cibles_select"
  on "public"."etablissements_cibles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "admins_factures_select"
  on "public"."factures"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));



  create policy "admins_all_fournisseurs"
  on "public"."fournisseurs"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "admins_all_incidents"
  on "public"."incidents_nis2"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "leads_admin_only"
  on "public"."leads_medecins"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "public_insert_leads"
  on "public"."leads_medecins"
  as permissive
  for insert
  to anon
with check ((consentement_rgpd = true));



  create policy "notif_insert"
  on "public"."notifications"
  as permissive
  for insert
  to authenticated
with check (public.is_admin());



  create policy "notif_select"
  on "public"."notifications"
  as permissive
  for select
  to authenticated
using ((public.is_admin() AND ((user_id IS NULL) OR (user_id = auth.uid()))));



  create policy "notif_update"
  on "public"."notifications"
  as permissive
  for update
  to authenticated
using (public.is_admin());



  create policy "user_read_own_places_logs"
  on "public"."places_search_logs"
  as permissive
  for select
  to authenticated
using (((user_id = auth.uid()) OR public.is_admin()));



  create policy "rate_limits_read"
  on "public"."rate_limits"
  as permissive
  for select
  to authenticated
using ((action ~~ (('%'::text || (auth.uid())::text) || '%'::text)));



  create policy "rate_limits_service"
  on "public"."rate_limits"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "registre_rgpd_admin_only"
  on "public"."registre_rgpd"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "service_insert_rgpd"
  on "public"."registre_rgpd"
  as permissive
  for insert
  to anon
with check (true);



  create policy "relances_admin_only"
  on "public"."relances_email"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "auth_seo_audits"
  on "public"."seo_client_audits"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "auth_seo_mots_cles"
  on "public"."seo_client_mots_cles"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "auth_seo_profiles"
  on "public"."seo_client_profiles"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "auth_all"
  on "public"."seo_domaines"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "social_profiles_auth"
  on "public"."social_client_profiles"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "social_posts_auth"
  on "public"."social_posts"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "tasks_delete"
  on "public"."tasks"
  as permissive
  for delete
  to authenticated
using (((created_by = auth.uid()) OR public.is_admin()));



  create policy "tasks_insert"
  on "public"."tasks"
  as permissive
  for insert
  to authenticated
with check (((created_by = auth.uid()) OR public.is_admin()));



  create policy "tasks_select"
  on "public"."tasks"
  as permissive
  for select
  to authenticated
using ((public.is_admin() OR (created_by = auth.uid()) OR (public.is_dci() AND (created_by = ANY (public.get_team_ids())))));



  create policy "tasks_update"
  on "public"."tasks"
  as permissive
  for update
  to authenticated
using ((public.is_admin() OR (created_by = auth.uid()) OR (public.is_dci() AND (created_by = ANY (public.get_team_ids())))))
with check ((public.is_admin() OR (created_by = auth.uid()) OR (public.is_dci() AND (created_by = ANY (public.get_team_ids())))));



  create policy "totp_audit_read_super_admin"
  on "public"."totp_audit"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text)))));



  create policy "etapes_delete"
  on "public"."tournee_etapes"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.tournees t
  WHERE ((t.id = tournee_etapes.tournee_id) AND ((t.commercial_id = auth.uid()) OR public.is_admin())))));



  create policy "etapes_insert"
  on "public"."tournee_etapes"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.tournees t
  WHERE ((t.id = tournee_etapes.tournee_id) AND (t.commercial_id = auth.uid())))));



  create policy "etapes_select"
  on "public"."tournee_etapes"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.tournees t
  WHERE ((t.id = tournee_etapes.tournee_id) AND ((t.commercial_id = auth.uid()) OR public.is_admin())))));



  create policy "etapes_update"
  on "public"."tournee_etapes"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.tournees t
  WHERE ((t.id = tournee_etapes.tournee_id) AND ((t.commercial_id = auth.uid()) OR public.is_admin())))));



  create policy "tournees_delete"
  on "public"."tournees"
  as permissive
  for delete
  to authenticated
using (((commercial_id = auth.uid()) OR public.is_admin()));



  create policy "tournees_insert"
  on "public"."tournees"
  as permissive
  for insert
  to authenticated
with check ((commercial_id = auth.uid()));



  create policy "tournees_select"
  on "public"."tournees"
  as permissive
  for select
  to authenticated
using (((commercial_id = auth.uid()) OR public.is_admin()));



  create policy "tournees_update"
  on "public"."tournees"
  as permissive
  for update
  to authenticated
using (((commercial_id = auth.uid()) OR public.is_admin()))
with check (((commercial_id = auth.uid()) OR public.is_admin()));



  create policy "auth_all"
  on "public"."work_journal"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "rgpd_log_select"
  on "public"."rgpd_log"
  as permissive
  for select
  to authenticated
using ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = rgpd_log.contact_id) AND (c.created_by = auth.uid()))))));


CREATE TRIGGER prevent_audit_log_delete BEFORE DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.audit_logs_immutable();

CREATE TRIGGER prevent_audit_log_update BEFORE UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.audit_logs_immutable();

CREATE TRIGGER on_new_contract AFTER INSERT ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_contract();

CREATE TRIGGER cyber_audits_updated_at BEFORE UPDATE ON public.cyber_audits FOR EACH ROW EXECUTE FUNCTION public.update_cyber_audits_updated_at();

CREATE TRIGGER dpo_aipd_upd BEFORE UPDATE ON public.dpo_aipd FOR EACH ROW EXECUTE FUNCTION public.update_dpo_updated_at();

CREATE TRIGGER dpo_der_upd BEFORE UPDATE ON public.dpo_der FOR EACH ROW EXECUTE FUNCTION public.update_dpo_updated_at();

CREATE TRIGGER trg_dpo_notices_updated_at BEFORE UPDATE ON public.dpo_notices FOR EACH ROW EXECUTE FUNCTION public.update_dpo_notices_updated_at();

CREATE TRIGGER trg_dpo_soustraitants_updated_at BEFORE UPDATE ON public.dpo_soustraitants FOR EACH ROW EXECUTE FUNCTION public.update_dpo_soustraitants_updated_at();

CREATE TRIGGER dpo_traitements_upd BEFORE UPDATE ON public.dpo_traitements FOR EACH ROW EXECUTE FUNCTION public.update_dpo_updated_at();

CREATE TRIGGER trg_dpo_transferts_updated_at BEFORE UPDATE ON public.dpo_transferts FOR EACH ROW EXECUTE FUNCTION public.update_dpo_transferts_updated_at();

CREATE TRIGGER dpo_violations_upd BEFORE UPDATE ON public.dpo_violations FOR EACH ROW EXECUTE FUNCTION public.update_dpo_updated_at();

CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads_medecins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_planifier_relance_insert AFTER INSERT ON public.leads_medecins FOR EACH ROW EXECUTE FUNCTION public.trigger_planifier_relance();

CREATE TRIGGER trg_planifier_relance_update AFTER UPDATE ON public.leads_medecins FOR EACH ROW EXECUTE FUNCTION public.trigger_planifier_relance();

CREATE TRIGGER trg_rgpd_on_insert AFTER INSERT ON public.leads_medecins FOR EACH ROW EXECUTE FUNCTION public.trigger_rgpd_creation();

CREATE TRIGGER trg_rgpd_on_update AFTER UPDATE ON public.leads_medecins FOR EACH ROW EXECUTE FUNCTION public.trigger_rgpd_modification();

CREATE TRIGGER on_profile_update_complet BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_update_profil_complet();


  create policy "Admin lecture archive"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'archives'::text) AND public.is_admin()));



  create policy "Admin upload archive"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'archives'::text) AND public.is_admin()));



  create policy "contrats_pdf_read_auth"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'contrats-pdf'::text));



  create policy "mandats_pdf_upload"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'contrats-pdf'::text) AND ((storage.foldername(name))[1] = 'PDF'::text)));



  create policy "upload_bdc_anon"
  on "storage"."objects"
  as permissive
  for insert
  to anon
with check (((bucket_id = 'contrats-pdf'::text) AND ((storage.foldername(name))[1] = 'PDF'::text)));




revoke references on table "public"."clauses_confidentialite" from "anon";

revoke trigger on table "public"."clauses_confidentialite" from "anon";

revoke truncate on table "public"."clauses_confidentialite" from "anon";

drop view if exists "public"."tournees_eco_bilan";

drop view if exists "public"."v_equipe_dci";

drop view if exists "public"."v_interactions";

create or replace view "public"."tournees_eco_bilan" as  SELECT t.commercial_id,
    p.prenom,
    p.nom,
    p.role,
    date_trunc('month'::text, (t.date_tournee)::timestamp with time zone) AS mois,
    count(*) AS nb_tournees,
    sum(t.nb_etapes) AS total_etapes,
    round(sum(t.distance_totale_km), 1) AS total_km,
    round(sum(t.score_co2_kg), 2) AS total_co2_kg,
    sum(
        CASE
            WHEN t.force_depassement THEN 1
            ELSE 0
        END) AS nb_depassements_forces
   FROM (public.tournees t
     JOIN public.profiles p ON ((p.id = t.commercial_id)))
  WHERE (t.statut <> 'annulée'::text)
  GROUP BY t.commercial_id, p.prenom, p.nom, p.role, (date_trunc('month'::text, (t.date_tournee)::timestamp with time zone));


create or replace view "public"."v_equipe_dci" as  SELECT p.id AS member_id,
    p.prenom,
    p.nom,
    p.role,
    p.profil_completed AS profil_complet,
    p.dci_parent_id,
    parent.prenom AS dci_prenom,
    parent.nom AS dci_nom,
    count(DISTINCT ct.id) AS nb_contrats,
    COALESCE(sum(ct.montant), (0)::numeric) AS ca_total
   FROM ((public.profiles p
     LEFT JOIN public.profiles parent ON ((parent.id = p.dci_parent_id)))
     LEFT JOIN public.contracts ct ON (((ct.created_by = p.id) AND (ct.statut <> 'Terminé'::text))))
  GROUP BY p.id, p.prenom, p.nom, p.role, p.profil_completed, p.dci_parent_id, parent.prenom, parent.nom;


create or replace view "public"."v_interactions" as  SELECT i.id,
    i.created_at,
    i.created_by,
    i.contact_id,
    i.type,
    i.date,
    i.objet,
    i.contenu,
    i.suite_a_donner,
    c.nom AS contact_nom,
    c.entreprise AS contact_entreprise,
    c.statut AS contact_statut,
    c.rgpd_ko AS contact_rgpd_ko
   FROM (public.interactions i
     JOIN public.contacts c ON ((c.id = i.contact_id)));



