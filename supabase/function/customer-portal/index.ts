// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=denonext";
import Stripe from "https://esm.sh/stripe@14?target=denonext";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const SB_URL     = Deno.env.get("SUPABASE_URL")!;
  const SB_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!STRIPE_KEY) return json({ error: "stripe_not_configured" }, 500);

  const sb     = createClient(SB_URL, SB_KEY);
  const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-04-10" });

  let body: { contract_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body.contract_id) return json({ error: "missing_contract_id" }, 400);

  // Récupérer le contrat + l'order_link pour avoir le stripe customer
  const { data: ct, error: ctErr } = await sb
    .from("contracts")
    .select("id, recurrence, statut, stripe_subscription_id")
    .eq("id", body.contract_id)
    .single();

  if (ctErr || !ct) return json({ error: "contract_not_found" }, 404);
  if (ct.recurrence !== "Mensuel") return json({ error: "not_a_subscription" }, 400);
  if (!ct.stripe_subscription_id) return json({ error: "no_subscription_id" }, 400);

  // Récupérer le customer_id depuis Stripe via la subscription
  let customerId: string;
  try {
    const sub = await stripe.subscriptions.retrieve(ct.stripe_subscription_id);
    customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  } catch (e) {
    return json({ error: "stripe_error", details: (e as Error).message }, 502);
  }

  // Générer le lien du portail client
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "https://safe-digitalisation.fr",
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: "portal_error", details: (e as Error).message }, 502);
  }
});
