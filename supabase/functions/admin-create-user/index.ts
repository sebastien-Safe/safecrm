import { createClient } from "@supabase/supabase-js";

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

function getJwtAal(token: string): string {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
    const { aal } = JSON.parse(atob(pad));
    return aal || 'aal1';
  } catch { return 'aal1'; }
}

// Changement ici : Deno.serve au lieu de serve
Deno.serve(async (req) => {
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

  if (getJwtAal(token) !== 'aal2') {
    return json({ error: "mfa_required", message: "Authentification à deux facteurs requise pour créer un utilisateur." }, 403);
  }

  let body: { action?: string; user_id?: string; new_password?: string; email?: string; password?: string; prenom?: string; is_admin?: boolean; denomination?: string; siret?: string; adresse_pro?: string; tva?: string; numero_mandat?: string; dci_parent_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // ── CAS 1 : réinitialisation du mot de passe d'un utilisateur existant ──
  if (body.action === "reset_password") {
    const userId      = body.user_id;
    const newPassword = body.new_password;

    if (!userId)                           return json({ error: "missing_user_id" }, 400);
    if (!newPassword || newPassword.length < 8) return json({ error: "password_too_short" }, 400);

    const { error: updateErr } = await sbAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updateErr) return json({ error: "reset_failed", details: updateErr.message }, 400);

    return json({ ok: true });
  }

  // ── CAS 2 : création d'un nouvel utilisateur ──
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
      numero_mandat: body.numero_mandat || null,
      dci_parent_id: body.dci_parent_id || null,
    });
  }

  return json({ id: newUser?.user?.id, email });
});