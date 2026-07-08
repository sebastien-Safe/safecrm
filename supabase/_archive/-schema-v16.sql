-- =========================================================
-- S@FE CRM — Mise à jour v16
-- Résiliation abonnement Stripe depuis la fiche contrat
-- =========================================================

-- Ajouter stripe_subscription_id sur contracts
alter table contracts
  add column if not exists stripe_subscription_id text;

-- Propager le stripe_subscription_id depuis order_links vers contracts
-- (pour les abonnements déjà payés)
update contracts ct
set stripe_subscription_id = ol.stripe_subscription_id
from order_links ol
where ol.contract_id = ct.id
  and ol.stripe_subscription_id is not null
  and ct.stripe_subscription_id is null;

-- Index
create index if not exists idx_contracts_stripe_sub
  on contracts(stripe_subscription_id)
  where stripe_subscription_id is not null;

