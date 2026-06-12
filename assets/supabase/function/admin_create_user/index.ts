// =========================================================
// Edge Function : admin-create-user
// =========================================================
// Crée un nouvel utilisateur Supabase Auth + son profil
// associé, en utilisant l'API Auth Admin officielle (qui
// requiert la service_role_key — d'où la nécessité d'une
// Edge Function, on ne peut pas l'appeler depuis le navigateur).
//
// L'appelant doit être un super-administrateur (vérification
// via la table profiles).
//
// Aucun secret supplémentaire à configurer : SUPABASE_URL et
// SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement aux
// Edge Functions par la plateforme.
//
// Déploiement :
//   supabase functions deploy admin-create-user
// =========================================================

// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json({ error: "missing_supabase_env" }, 500);
  }

  // ---- 1. Identifier l'appelant (JWT utilisateur) et vérifier qu'il est admin ----
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "unauthorized" }, 401);

  // Vérifie que cet utilisateur est admin via la table profiles
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: profile, error: profErr } = await adminClient
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (profErr || !profile?.is_admin) {
    return json({ error: "forbidden", reason: "super_admin_required" }, 403);
  }

  // ---- 2. Lecture et validation du payload ----
  let payload: { email?: string; password?: string; prenom?: string; is_admin?: boolean };
  try { payload = await req.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  const email = (payload.email || "").trim().toLowerCase();
  const password = payload.password || "";
  const prenom = (payload.prenom || "").trim() || null;
  const makeAdmin = !!payload.is_admin;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid_email" }, 400);
  if (password.length < 8)                                  return json({ error: "password_too_short" }, 400);

  // ---- 3. Création via l'API Auth Admin officielle ----
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // confirmé d'emblée (créé par un admin)
    user_metadata: prenom ? { prenom } : undefined,
  });
  if (createErr || !created?.user) {
    return json({ error: "create_failed", details: createErr?.message || "unknown" }, 502);
  }

  // ---- 4. Création du profil associé ----
  const { error: upsertErr } = await adminClient
    .from("profiles")
    .upsert({ id: created.user.id, prenom, is_admin: makeAdmin }, { onConflict: "id" });
  if (upsertErr) {
    // L'utilisateur Auth est créé mais le profil a échoué — on tente de rollback
    try { await adminClient.auth.admin.deleteUser(created.user.id); } catch (_) {}
    return json({ error: "profile_insert_failed", details: upsertErr.message }, 502);
  }

  return json({
    ok: true,
    user: {
      id: created.user.id,
      email: created.user.email,
      prenom,
      is_admin: makeAdmin,
    },
  });
});
