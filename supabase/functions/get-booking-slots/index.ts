// Edge Function publique — Créneaux disponibles d'un commercial
// GET /functions/v1/get-booking-slots?token=BOOKING_TOKEN&days=30

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const CORS = {
  "Access-Control-Allow-Origin": "https://crm.safe-digitalisation.fr",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Jours fériés français pour une année donnée (algorithme Meeus/Jones/Butcher)
function feriesFR(year: number): Set<string> {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  const paques = new Date(year, month - 1, day);

  const offset = (d: Date, n: number) => {
    const x = new Date(d); x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  };

  return new Set([
    `${year}-01-01`, `${year}-05-01`, `${year}-05-08`,
    `${year}-07-14`, `${year}-08-15`, `${year}-11-01`,
    `${year}-11-11`, `${year}-12-25`,
    offset(paques, 1),   // Lundi de Pâques
    offset(paques, 39),  // Ascension
    offset(paques, 50),  // Lundi de Pentecôte
  ]);
}

const JOURS = ["dim","lun","mar","mer","jeu","ven","sam"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url   = new URL(req.url);
  const token = url.searchParams.get("token");
  const days  = Math.min(parseInt(url.searchParams.get("days") ?? "30"), 60);

  if (!token) return new Response(JSON.stringify({ error: "token manquant" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: profile } = await sb
    .from("profiles")
    .select("id, prenom, nom, availability")
    .eq("booking_token", token)
    .maybeSingle();

  if (!profile) return new Response(JSON.stringify({ error: "Token invalide" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });

  const avail: Record<string, { enabled: boolean; start: string; end: string; pause_start?: string; pause_end?: string }> = profile.availability || {};

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().slice(0, 10);
  const endDate  = new Date(today); endDate.setDate(today.getDate() + days);
  const endISO   = endDate.toISOString().slice(0, 10);

  // Créneaux déjà pris (bookings + tâches RDV)
  const [{ data: bookings }, { data: tasks }] = await Promise.all([
    sb.from("bookings").select("date, heure").eq("commercial_id", profile.id).eq("statut", "confirmé").gte("date", todayISO).lte("date", endISO),
    sb.from("tasks").select("rdv_date, rdv_heure").eq("created_by", profile.id).in("type_tache", ["RDV visio", "RDV terrain"]).neq("statut", "Terminé").gte("rdv_date", todayISO).lte("rdv_date", endISO),
  ]);

  const occupied: Record<string, Set<string>> = {};
  (bookings || []).forEach(b => { (occupied[b.date] ??= new Set()).add(b.heure.slice(0, 5)); });
  (tasks    || []).forEach(t => { if (t.rdv_date && t.rdv_heure) (occupied[t.rdv_date] ??= new Set()).add(t.rdv_heure.slice(0, 5)); });

  // Jours fériés sur la période (peut couvrir 2 années)
  const feries = new Set([...feriesFR(today.getFullYear()), ...feriesFR(today.getFullYear() + 1)]);

  const slots: { date: string; heure: string }[] = [];

  for (let i = 0; i < days; i++) {
    const d   = new Date(today); d.setDate(today.getDate() + i);
    const dow = d.getDay(); // 0=dim, 6=sam
    if (dow === 0 || dow === 6) continue;

    const iso  = d.toISOString().slice(0, 10);
    if (feries.has(iso)) continue;

    const conf = avail[JOURS[dow]];
    if (!conf?.enabled) continue;

    const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
    const startMin = toMin(conf.start);
    const endMin   = toMin(conf.end);
    const psMin    = conf.pause_start ? toMin(conf.pause_start) : null;
    const peMin    = conf.pause_end   ? toMin(conf.pause_end)   : null;

    for (let cur = startMin; cur + 60 <= endMin; cur += 60) {
      if (psMin !== null && peMin !== null && cur >= psMin && cur < peMin) continue;
      const slot = `${String(Math.floor(cur / 60)).padStart(2,"0")}:${String(cur % 60).padStart(2,"0")}`;
      if (!occupied[iso]?.has(slot)) slots.push({ date: iso, heure: slot });
    }
  }

  return new Response(JSON.stringify({ commercial: { prenom: profile.prenom, nom: profile.nom }, slots }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
