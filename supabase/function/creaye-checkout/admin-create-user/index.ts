import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const SU = Deno.env.get("SUPABASE_URL")!;
  const SK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!SU || !SK) {
    return json({ error: "missing_supabase_env" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "forbidden" }, 403);
  }

  const sbUser = createClient(SU, SK);
  const sbAdmin = createClient(SU, SK, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: caller } = await sbUser.auth.getUser(token);
  if (!caller?.user) {
    return json({ error: "forbidden" }, 403);
  }

  const { data: profile } = await sbUser
    .from("profiles")
    .select("is_admin")
    .eq("id", caller.user.id)
    .single();
  if (!profile?.is_admin) {
    return json({ error: "forbidden" }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const email = body.email;
  const password = body.password;
  const prenom = body.prenom || null;
  const isAdmin = body.is_admin || false;

  if (!email) return json({ error: "invalid_email" }, 400);
  if (!password || password.length < 8) {
    return json({ error: "password_too_short" }, 400);
  }

  const { data: newUser, error: createErr } =
    await sbAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { prenom },
    });

  if (createErr) {
    return json({
      error: "create_failed",
      details: createErr.message
    }, 400);
  }

  if (newUser?.user?.id) {
    await sbUser.from("profiles").upsert({
      id: newUser.user.id,
      prenom,
      is_admin: isAdmin,
      denomination: body.denomination || null,
      siret: body.siret || null,
      adresse_pro: body.adresse_pro || null,
      tva: body.tva || null,
    });
  }

  return json({ id: newUser?.user?.id, email });
});
