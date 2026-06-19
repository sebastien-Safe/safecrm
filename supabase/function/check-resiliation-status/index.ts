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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const SB_URL     = Deno.env.get("SUPABASE_URL")!;
  const SB_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!STRIPE_KEY) return json({ error: "stripe_not_configured" }, 500);

  const sb     = createClient(SB_URL, SB_KEY);
  const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-04-10" });

  // Vérification admin (sauf appel service_role interne)
  const token = authHeader.replace("Bearer ", "");
  const isCron = token === SB_KEY;
  if (!isCron) {
    const { data: { user }, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !user) return json({ error: "unauthorized" }, 401);
    const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return json({ error: "forbidden" }, 403);
  }

  const now = new Date();

  // Contrats en "Résiliation en attente Stripe"
  const { data: contrats } = await sb
    .from("contracts")
    .select("id, stripe_subscription_id, resiliation_validee_at, resiliation_alerte_at")
    .eq("statut", "Résiliation en attente Stripe");

  if (!contrats?.length) return json({ checked: 0, updated: 0 });

  let updated = 0;
  const results: { id: string; action: string }[] = [];

  for (const ct of contrats) {
    if (!ct.stripe_subscription_id) continue;

    const valideeAt  = ct.resiliation_validee_at ? new Date(ct.resiliation_validee_at) : null;
    const depasse48h = valideeAt && (now.getTime() - valideeAt.getTime()) > 48 * 3600 * 1000;

    try {
      const sub = await stripe.subscriptions.retrieve(ct.stripe_subscription_id);

      if (sub.status === "canceled" || sub.cancel_at_period_end) {
        // Stripe confirme → Résilié
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10)
          : null;

        await sb.from("contracts").update({
          statut:                        "Résilié",
          resilié_at:                    now.toISOString(),
          date_echeance:                 periodEnd,
          resiliation_stripe_checked_at: now.toISOString(),
          resiliation_alerte_at:         null,
        }).eq("id", ct.id);

        await sb.from("audit_logs").insert({
          user_id: null, action: "resiliation_confirmee_stripe",
          entity_type: "contract", entity_id: ct.id,
          details: { period_end: periodEnd, stripe_status: sub.status },
        });

        results.push({ id: ct.id, action: "confirmed" });
        updated++;
      } else if (depasse48h && !ct.resiliation_alerte_at) {
        // 48h dépassées sans confirmation → Erreur résiliation
        await sb.from("contracts").update({
          statut:                        "Erreur résiliation",
          resiliation_alerte_at:         now.toISOString(),
          resiliation_stripe_checked_at: now.toISOString(),
        }).eq("id", ct.id);

        await sb.from("audit_logs").insert({
          user_id: null, action: "resiliation_timeout_48h",
          entity_type: "contract", entity_id: ct.id,
          details: { stripe_status: sub.status, stripe_subscription_id: ct.stripe_subscription_id },
        });

        results.push({ id: ct.id, action: "timeout_48h" });
        updated++;
      } else {
        // En attente normale, Stripe pas encore confirmé
        await sb.from("contracts").update({
          resiliation_stripe_checked_at: now.toISOString(),
        }).eq("id", ct.id);
        results.push({ id: ct.id, action: "pending" });
      }
    } catch (e) {
      console.error(`Stripe error for contract ${ct.id}:`, e);
      results.push({ id: ct.id, action: "stripe_error" });
    }
  }

  return json({ checked: contrats.length, updated, results });
});
