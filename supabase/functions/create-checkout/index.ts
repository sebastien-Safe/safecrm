// On cible "denonext" pour que esm.sh s'adapte à Deno v2
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4?target=denonext";
import Stripe from "https://esm.sh/stripe@14.5.0?target=denonext";

const H = {
  "Access-Control-Allow-Origin": "https://crm.safe-digitalisation.fr",
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

  const SK  = Deno.env.get("STRIPE_SECRET_KEY");
  const SU  = Deno.env.get("SUPABASE_URL")!;
  const SR  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const TVA = Number(Deno.env.get("TVA_MULTIPLIER") ?? 120); // HT€ × TVA → centimes TTC (120 = 20 % TVA)
  if (!SK) return json({ error: "no_stripe_key" }, 500);

  const sb = createClient(SU, SR);
  const stripe = new Stripe(SK, { apiVersion: "2024-04-10" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  // ── Dossier victime 17Cyber : paiement ponctuel TTC, avec option 3x sans frais ──
  if (body.cybervictim_lead_id) {
    const { data: lead, error: eLead } = await sb
      .from("cybervictim_leads")
      .select("id, first_name, last_name, product_id, cybervictim_products(alert_type, price_ttc)")
      .eq("id", body.cybervictim_lead_id)
      .single();
    if (eLead || !lead) return json({ error: "not_found" }, 404);

    const product = lead.cybervictim_products;
    const priceTtc = Number(product?.price_ttc || 0);
    if (!priceTtc) return json({ error: "no_price" }, 400);

    const okV = "https://crm.safe-digitalisation.fr/?v=victimes17&payment=success&lead=" + lead.id;
    const koV = "https://crm.safe-digitalisation.fr/?v=victimes17&payment=cancel&lead=" + lead.id;

    try {
      const ss = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        payment_method_options: {
          card: { installments: { enabled: true } } // paiement en plusieurs fois (dont 3x) si la carte du client est éligible
        },
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: { name: `${product.alert_type} — Intervention S@FE 17Cyber (${lead.first_name} ${lead.last_name})` },
              unit_amount: Math.round(priceTtc * 100)
            },
            quantity: 1
          }
        ],
        success_url: okV,
        cancel_url: koV,
        metadata: { cybervictim_lead_id: lead.id }
      });
      return json({ url: ss.url });
    } catch (e: any) {
      return json(
        { error: "stripe_error", details: e.message },
        502
      );
    }
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
            unit_amount: Math.round(m * TVA),
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
            unit_amount: Math.round(s * TVA)
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
              unit_amount: Math.round((m + s) * TVA)
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
