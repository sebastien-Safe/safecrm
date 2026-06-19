// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=denonext";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_ATTEMPTS  = 5;
const BAN_DURATION  = "30m";   // ban temporaire 30 minutes
const MAX_IP_HOUR   = 30;      // max appels par IP par heure (anti-abus)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")    return json({ error: "method_not_allowed" }, 405);

  const SB_URL = Deno.env.get("SUPABASE_URL")!;
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb     = createClient(SB_URL, SB_KEY);

  let body: { email?: string };
  try { body = await req.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  const email = (body.email || "").trim().toLowerCase();
  if (!email) return json({ error: "missing_email" }, 400);

  // ── Rate limit par IP (anti-abus : empêcher de locker tous les comptes) ──
  const ip       = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rlKey    = `loginfail_ip:${ip}`;
  const rlWindow = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();

  const { data: rl } = await sb.from("rate_limits")
    .select("count, window_at").eq("action", rlKey).maybeSingle();

  if (rl && rl.window_at?.slice(0, 13) === rlWindow.slice(0, 13)) {
    if (rl.count >= MAX_IP_HOUR) return json({ error: "rate_limit" }, 429);
    await sb.from("rate_limits").update({ count: rl.count + 1 }).eq("action", rlKey);
  } else {
    await sb.from("rate_limits").upsert({ action: rlKey, count: 1, window_at: rlWindow }, { onConflict: "action" });
  }

  // ── Retrouver l'utilisateur via son email ──
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const user = users?.find((u) => u.email?.toLowerCase() === email);

  // Email inconnu : ne pas révéler l'information, incrémenter quand même côté local
  if (!user) return json({ attempts: 1, banned: false, remaining: MAX_ATTEMPTS - 1 });

  // ── Incrémenter le compteur en base ──
  const { data: existing } = await sb.from("login_attempts")
    .select("attempts").eq("email", email).maybeSingle();

  const newAttempts = (existing?.attempts ?? 0) + 1;

  await sb.from("login_attempts").upsert({
    email,
    attempts:        newAttempts,
    last_attempt_at: new Date().toISOString(),
    locked_at:       newAttempts >= MAX_ATTEMPTS ? new Date().toISOString() : null,
  }, { onConflict: "email" });

  // ── Bannissement temporaire au 5ᵉ échec ──
  if (newAttempts >= MAX_ATTEMPTS) {
    await sb.auth.admin.updateUserById(user.id, { ban_duration: BAN_DURATION });
    return json({ attempts: newAttempts, banned: true, remaining: 0 });
  }

  return json({ attempts: newAttempts, banned: false, remaining: MAX_ATTEMPTS - newAttempts });
});
