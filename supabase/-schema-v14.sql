-- =========================================================
-- S@FE CRM — Mise à jour v14
-- Tunnel de paiement Stripe (bon de commande → signature
-- en ligne → paiement → contrat "Signé")
-- =========================================================

create table if not exists order_links (
  id                  uuid primary key default gen_random_uuid(),
  contract_id         uuid not null references contracts(id) on delete cascade,
  token               text unique not null default encode(gen_random_bytes(32), 'hex'),
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '7 days'),

  -- Snapshot du contrat (le client voit ces données même si le contrat change après)
  client_name         text,
  client_email        text,
  client_entreprise   text,
  client_siret        text,
  produit             text,
  formule             text,
  montant             numeric(10,2),
  frais_mise_en_place numeric(10,2) default 0,
  remise              numeric(10,2) default 0,
  recurrence          text,
  engagement_mois     integer default 0,

  -- Consentement (preuve juridique)
  consent_cgv_at      timestamptz,
  consent_rgpd_at     timestamptz,
  consent_ip          text,
  consent_user_agent  text,

  -- Stripe
  stripe_session_id   text,
  stripe_subscription_id text,
  stripe_payment_status text default 'pending',
  paid_at             timestamptz,

  status              text not null default 'pending'
    check (status in ('pending','consented','paid','expired','cancelled'))
);

alter table order_links enable row level security;

create policy "ol_insert" on order_links for insert to authenticated
  with check (created_by = auth.uid() or is_admin());
create policy "ol_select" on order_links for select to authenticated
  using (created_by = auth.uid() or is_admin());
create policy "ol_update" on order_links for update to authenticated
  using (created_by = auth.uid() or is_admin());

-- RPC publique : récupère un bon de commande par token (pour order.html, appelé avec anon key)
create or replace function get_order_by_token(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select json_build_object(
    'id', ol.id, 'token', ol.token, 'status', ol.status,
    'expires_at', ol.expires_at,
    'client_name', ol.client_name, 'client_email', ol.client_email,
    'client_entreprise', ol.client_entreprise, 'client_siret', ol.client_siret,
    'produit', ol.produit, 'formule', ol.formule,
    'montant', ol.montant, 'frais_mise_en_place', ol.frais_mise_en_place,
    'remise', ol.remise, 'recurrence', ol.recurrence,
    'engagement_mois', ol.engagement_mois,
    'paid_at', ol.paid_at
  ) into v from order_links ol where ol.token = p_token;
  if v is null then return json_build_object('error','not_found'); end if;
  if (v->>'expires_at')::timestamptz < now() then return json_build_object('error','expired'); end if;
  if v->>'status' = 'paid' then return json_build_object('error','already_paid','paid_at',v->>'paid_at'); end if;
  return v;
end; $$;

grant execute on function get_order_by_token(text) to anon, authenticated;

create index if not exists order_links_token_idx on order_links (token);
create index if not exists order_links_contract_idx on order_links (contract_id);
