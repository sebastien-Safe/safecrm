// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4?target=denonext";
import Stripe from "https://esm.sh/stripe@14.5.0?target=denonext";

const cors = {
  "Access-Control-Allow-Origin": "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function getJwtAal(token: string): string {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
    const { aal } = JSON.parse(atob(pad));
    return aal || 'aal1';
  } catch { return 'aal1'; }
}

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

  // Vérifier que l'appelant est administrateur
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await sb.from("profiles").select("is_admin, prenom").eq("id", user.id).single();
  if (!profile?.is_admin) return json({ error: "forbidden", message: "Seul un administrateur peut valider une résiliation." }, 403);

  if (getJwtAal(token) !== 'aal2') {
    return json({ error: "mfa_required", message: "Authentification à deux facteurs requise pour résilier un abonnement." }, 403);
  }

  let body: { contract_id?: string; cancelled_by?: string; resync?: boolean };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body.contract_id) return json({ error: "missing_contract_id" }, 400);

  // Rate limiting : max 5 résiliations par heure par admin
  const rlKey    = `cancel:${user.id}`;
  const rlWindow = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();
  const { data: rl } = await sb.from("rate_limits").select("count, window_at").eq("action", rlKey).maybeSingle();
  if (rl && rl.window_at?.slice(0, 13) === rlWindow.slice(0, 13)) {
    if (rl.count >= 5) return json({ error: "rate_limit_exceeded" }, 429);
    await sb.from("rate_limits").update({ count: rl.count + 1 }).eq("action", rlKey);
  } else {
    await sb.from("rate_limits").upsert({ user_id: user.id, action: rlKey, count: 1, window_at: rlWindow });
  }

  // Récupérer le contrat
  const { data: ct, error: ctErr } = await sb
    .from("contracts")
    .select("id, statut, stripe_subscription_id, recurrence, contact_id, created_by, resiliation_demande_at")
    .eq("id", body.contract_id)
    .single();

  if (ctErr || !ct) return json({ error: "contract_not_found" }, 404);
  if (ct.recurrence !== "Mensuel") return json({ error: "not_a_subscription" }, 400);
  if (!ct.stripe_subscription_id) return json({ error: "no_subscription_id" }, 400);

  const statuts_ok = ["Demande de résiliation", "Résiliation en attente Stripe", "Erreur résiliation", "Contrat en cours"];
  if (!body.resync && !statuts_ok.includes(ct.statut)) {
    return json({ error: "invalid_statut", statut: ct.statut }, 409);
  }

  const now = new Date().toISOString();

  // Passer en "Résiliation en attente Stripe"
  await sb.from("contracts").update({
    statut:                "Résiliation en attente Stripe",
    resiliation_validee_by: user.id,
    resiliation_validee_at: now,
    resiliation_alerte_at:  null,
  }).eq("id", ct.id);

  // Appeler Stripe
  let periodEnd: string | null = null;
  try {
    const sub = await stripe.subscriptions.retrieve(ct.stripe_subscription_id);

    // Abonnement déjà annulé côté Stripe
    if (sub.status === "canceled" || sub.cancel_at_period_end) {
      periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10)
        : null;
    } else {
      const updated = await stripe.subscriptions.update(ct.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      periodEnd = new Date(updated.current_period_end * 1000).toISOString().slice(0, 10);
    }
  } catch (e) {
    console.error("Stripe cancel error:", e);
    await sb.from("contracts").update({ statut: "Erreur résiliation" }).eq("id", ct.id);
    await sb.from("audit_logs").insert({
      user_id: user.id, action: "resiliation_erreur_stripe",
      entity_type: "contract", entity_id: ct.id,
      details: { error: (e as Error).message, stripe_subscription_id: ct.stripe_subscription_id },
    });
    return json({ error: "stripe_error", details: (e as Error).message }, 502);
  }

  // Stripe OK → statut "Résilié"
  await sb.from("contracts").update({
    statut:                        "Résilié",
    resilié_at:                    now,
    date_echeance:                 periodEnd,
    resiliation_stripe_checked_at: now,
  }).eq("id", ct.id);

  // Interaction automatique
  const cancelledBy = body.cancelled_by || profile?.prenom || "Admin";
  await sb.from("interactions").insert({
    contact_id:     ct.contact_id,
    created_by:     ct.created_by,
    type:           "Autre",
    date:           now.slice(0, 10),
    objet:          "Résiliation abonnement validée",
    contenu:        `Résiliation validée par ${cancelledBy} (admin). Fin effective le ${periodEnd || "fin de période en cours"}. Stripe arrêtera le prélèvement automatiquement.`,
    suite_a_donner: "Vérifier la satisfaction client — proposer une alternative si pertinent.",
  });

  // Audit log
  await sb.from("audit_logs").insert({
    user_id:     user.id,
    action:      "resiliation_validee",
    entity_type: "contract",
    entity_id:   ct.id,
    details: {
      par:                  cancelledBy,
      period_end:           periodEnd,
      stripe_subscription_id: ct.stripe_subscription_id,
      demande_at:           ct.resiliation_demande_at,
    },
  });

  return json({
    success: true,
    message: "Résiliation enregistrée. L'abonnement se terminera le " + periodEnd,
    period_end: periodEnd,
  });
});
