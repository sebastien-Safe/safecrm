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

  // Auth : utilisateur authentifié uniquement
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

  // Récupérer le contrat
  const { data: ct, error: ctErr } = await sb
    .from("contracts")
    .select("id, statut, stripe_subscription_id, recurrence")
    .eq("id", body.contract_id)
    .single();

  if (ctErr || !ct) return json({ error: "contract_not_found" }, 404);
  if (ct.recurrence !== "Mensuel") return json({ error: "not_a_subscription" }, 400);
  if (!ct.stripe_subscription_id) return json({ error: "no_subscription_id" }, 400);
  if (ct.statut === "Résilié") return json({ error: "already_cancelled" }, 409);

  // Résilier dans Stripe (fin de période en cours)
  try {
    await stripe.subscriptions.update(ct.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  } catch (e) {
    console.error("Stripe cancel error:", e);
    return json({ error: "stripe_error", details: (e as Error).message }, 502);
  }

  // Mettre à jour le statut dans Supabase
  const { error: upErr } = await sb
    .from("contracts")
    .update({ statut: "Résilié" })
    .eq("id", ct.id);

  if (upErr) return json({ error: "db_update_failed" }, 500);

  return json({ success: true, message: "Abonnement résilié en fin de période." });
});
