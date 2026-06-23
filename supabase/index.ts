// deno-lint-ignore-file
// 1. Suppression du module 'serve' obsolète et ajout de ?target=deno sur Supabase
// On cible "denonext" pour que esm.sh s'adapte à Deno v2
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=denonext";
import Stripe from "https://esm.sh/stripe@14?target=denonext";

const cors = {
  "Access-Control-Allow-Origin": "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// 2. Utilisation de Deno.serve au lieu de serve
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const SB_URL = Deno.env.get("SUPABASE_URL")!;
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!STRIPE_KEY) return json({ error: "stripe_not_configured" }, 500);

  const sb = createClient(SB_URL, SB_KEY);
  const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-04-10" });

  let body: { token?: string; consent_cgv?: boolean; consent_rgpd?: boolean };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  if (!body.token) return json({ error: "missing_token" }, 400);
  if (!body.consent_cgv || !body.consent_rgpd) return json({ error: "consent_required" }, 400);

  // 0. Rate limiting : max 5 tentatives par IP par heure
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
  const rlKey = `checkout:${clientIp}`;
  const rlWindow = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();

  const { data: rl } = await sb
    .from("rate_limits")
    .select("count, window_at")
    .eq("action", rlKey)
    .maybeSingle();

  if (rl && rl.window_at?.slice(0, 13) === rlWindow.slice(0, 13)) {
    if (rl.count >= 5) return json({ error: "rate_limit_exceeded" }, 429);
    await sb.from("rate_limits")
      .update({ count: rl.count + 1 })
      .eq("action", rlKey);
  } else {
    await sb.from("rate_limits")
      .upsert({ user_id: "00000000-0000-0000-0000-000000000000", action: rlKey, count: 1, window_at: rlWindow });
  }

  // 1. Récupère le bon de commande
  const { data: ol, error: olErr } = await sb
    .from("order_links").select("*").eq("token", body.token).single();
  if (olErr || !ol) return json({ error: "not_found" }, 404);
  if (ol.status === "paid") return json({ error: "already_paid" }, 409);
  if (new Date(ol.expires_at) < new Date()) return json({ error: "expired" }, 410);

  // 2. Enregistre le consentement
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  const now = new Date().toISOString();
  await sb.from("order_links").update({
    consent_cgv_at: now, consent_rgpd_at: now,
    consent_ip: ip, consent_user_agent: ua,
    status: "consented",
  }).eq("id", ol.id);

  // 3. Construction de la session Stripe Checkout
  const montant = Math.max(0, Number(ol.montant || 0) - Number(ol.remise || 0));
  const setup = Number(ol.frais_mise_en_place || 0);
  const isRecurrent = ol.recurrence === "Mensuel";
  const orderPageBase = Deno.env.get("ORDER_PAGE_URL") || "https://crm.safe-digitalisation.fr/order.html";
  const successUrl = `${orderPageBase}?token=${ol.token}&status=success`;
  const cancelUrl = `${orderPageBase}?token=${ol.token}&status=cancel`;

  try {
    let session;
    const productName = `${ol.produit || "Prestation"}${ol.formule ? " — " + ol.formule : ""}`;

    if (isRecurrent) {
      // Abonnement mensuel (+ frais MeP en one-shot sur la 1ère facture si > 0)
      const lineItems: any[] = [
        {
          price_data: {
            currency: "eur",
            product_data: { name: `${productName} — Abonnement mensuel` },
            unit_amount: Math.round(montant * 100),
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ];
      if (setup > 0) {
        lineItems.push({
          price_data: {
            currency: "eur",
            product_data: { name: `${productName} — Frais de mise en service` },
            unit_amount: Math.round(setup * 100),
          },
          quantity: 1,
        });
      }
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["sepa_debit"], // SEPA obligatoire pour les abonnements
        customer_email: ol.client_email || undefined,
        line_items: lineItems,
        subscription_data: {
          metadata: { order_link_id: ol.id, contract_id: ol.contract_id },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { order_link_id: ol.id, contract_id: ol.contract_id, token: ol.token },
      });
    } else {
      // Paiement unique (audit, pack, option)
      const totalUnique = montant + setup;
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"], // CB + Apple Pay + Google Pay (wallets auto via card)
        customer_email: ol.client_email || undefined,
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: { name: productName },
            unit_amount: Math.round(totalUnique * 100),
          },
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { order_link_id: ol.id, contract_id: ol.contract_id, token: ol.token },
      });
    }

    await sb.from("order_links").update({ stripe_session_id: session.id }).eq("id", ol.id);
    return json({ url: session.url });

  } catch (e) {
    console.error("Stripe error:", e);
    return json({ error: "stripe_error", details: (e as Error).message }, 502);
  }
});
