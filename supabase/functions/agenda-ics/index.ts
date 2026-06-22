import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Formate une date ISO en YYYYMMDD pour iCal
function toICalDate(iso: string): string {
  return iso.replace(/-/g, "").slice(0, 8);
}

// Formate une datetime ISO en YYYYMMDDTHHmmssZ pour iCal
function toICalDateTime(date: string, heure?: string | null): string {
  if (heure) {
    const h = heure.slice(0, 5).replace(":", "");
    return `${toICalDate(date)}T${h}00`;
  }
  return `${toICalDate(date)}T000000Z`;
}

// Échappe les caractères spéciaux iCal
function esc(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Génère un UID stable par tâche
function uid(taskId: string, domain: string): string {
  return `task-${taskId}@${domain}`;
}

serve(async (req) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get("uid");

  if (!userId) {
    return new Response("Paramètre uid manquant", { status: 400 });
  }

  const SB_URL = Deno.env.get("SUPABASE_URL")!;
  const SB_SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SB_URL, SB_SRV);

  const { data: tasks, error } = await sb
    .from("tasks")
    .select("id, titre, description, type_tache, echeance, rdv_date, rdv_heure, rdv_lieu, statut, priorite")
    .eq("created_by", userId)
    .neq("statut", "Terminé")
    .order("echeance", { ascending: true, nullsFirst: false });

  if (error) {
    return new Response("Erreur Supabase", { status: 500 });
  }

  const domain = new URL(SB_URL).hostname;
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const vevents = (tasks || [])
    .filter((t) => t.rdv_date || t.echeance)
    .map((t) => {
      const isRdv = t.type_tache === "RDV visio" || t.type_tache === "RDV terrain";
      const dateRef = t.rdv_date || t.echeance;
      const summary = esc(t.titre || "Tâche");
      const desc = esc([t.description, t.rdv_lieu ? `📍 ${t.rdv_lieu}` : ""].filter(Boolean).join(" | "));
      const location = t.rdv_lieu ? esc(t.rdv_lieu) : "";

      let dtstart: string;
      let dtend: string;
      let allDay = false;

      if (isRdv && t.rdv_heure) {
        dtstart = toICalDateTime(dateRef, t.rdv_heure);
        // RDV d'1h par défaut
        const [hh, mm] = t.rdv_heure.slice(0, 5).split(":").map(Number);
        const endH = String(hh + 1).padStart(2, "0");
        dtend = `${toICalDate(dateRef)}T${endH}${String(mm).padStart(2, "0")}00`;
      } else {
        allDay = true;
        dtstart = toICalDate(dateRef);
        // Jour suivant pour les événements toute la journée
        const d = new Date(dateRef);
        d.setDate(d.getDate() + 1);
        dtend = d.toISOString().replace(/-/g, "").slice(0, 8);
      }

      const priority = t.priorite === "Haute" ? "1" : t.priorite === "Basse" ? "9" : "5";

      return [
        "BEGIN:VEVENT",
        `UID:${uid(t.id, domain)}`,
        `DTSTAMP:${now}`,
        allDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`,
        allDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`,
        `SUMMARY:${summary}`,
        desc ? `DESCRIPTION:${desc}` : "",
        location ? `LOCATION:${location}` : "",
        `PRIORITY:${priority}`,
        `STATUS:${t.statut === "En cours" ? "IN-PROCESS" : "NEEDS-ACTION"}`,
        "END:VEVENT",
      ].filter(Boolean).join("\r\n");
    });

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//S@FE CRM//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:S@FE CRM — Mes tâches`,
    "X-WR-TIMEZONE:Europe/Paris",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=safe-crm.ics",
      "Cache-Control": "no-cache",
    },
  });
});
