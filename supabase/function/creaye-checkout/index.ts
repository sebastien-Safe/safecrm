import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type"
};

function json(b: unknown, s = 200) {
  return new Response(
    JSON.stringify(b),
    { status: s, headers: { ...H, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: H });
  }
  if (req.method !== "POST") {
    return json({ error: "bad_method" }, 405);
  }

  const SK = Deno.env.get("STRIPE_SECRET_KEY");
  const SU = Deno.env.get("SUPABASE_URL")!;
  const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!SK) return json({ error: "no_stripe_key" }, 500);

  const sb = createClient(SU, SR);
  const stripe = new Stripe(SK, { apiVersion: "2024-04-10" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const cid = body.contract_id;
  if (!cid) return json({ error: "no_id" }, 400);

  const { data: ct, error: e1 } = await sb
    .from("contracts")
    .select("*")
    .eq("id", cid)
    .single();
  if (e1 || !ct) return json({ error: "not_found" }, 404);

  const raw = Number(ct.montant || 0);
  const setup = Number(ct.frais_mise_en_place || 0);
  const rem = Number(ct.remise || 0);
  const m = setup > 0 ? raw : Math.max(0, raw - rem);
  const s = setup > 0 ? Math.max(0, setup - rem) : 0;
  const r = ct.recurrence === "Mensuel";
  const n = (ct.type || "Prestation") +
    (ct.formule ? " - " + ct.formule : "");
  const ok = "https://crm.safe-digitalisation.fr" +
    "/order.html?id=" + cid + "&status=success";
  const ko = "https://crm.safe-digitalisation.fr" +
    "/order.html?id=" + cid + "&status=cancel";

  try {
    let ss;
    if (r) {
      const li: any[] = [
        {
          price_data: {
            currency: "eur",
            product_data: { name: n + " - Mensuel TTC" },
            unit_amount: Math.round(m * 120),
            recurring: { interval: "month" }
          },
          quantity: 1
        }
      ];
      if (s > 0) {
        li.push({
          price_data: {
            currency: "eur",
            product_data: { name: n + " - MeP TTC" },
            unit_amount: Math.round(s * 120)
          },
          quantity: 1
        });
      }
      ss = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: li,
        success_url: ok,
        cancel_url: ko,
        metadata: { contract_id: cid }
      });
    } else {
      ss = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: { name: n + " TTC" },
              unit_amount: Math.round((m + s) * 120)
            },
            quantity: 1
          }
        ],
        success_url: ok,
        cancel_url: ko,
        metadata: { contract_id: cid }
      });
    }
    return json({ url: ss.url });
  } catch (e: any) {
    return json(
      { error: "stripe_error", details: e.message },
      502
    );
  }
});
