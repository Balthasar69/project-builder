// Holt die Daten des zum Projekt gehoerenden Steuerboards (Boards/Spalten,
// Aufgabenkarten mit Beschreibung und Kommentaren, Gruendercoach-Chat,
// 4DX-Reviews), damit sie in den Businessplan einfliessen. Das Steuerboard
// ist eine eigene App mit eigener Datenbank; der Zugriff laeuft ueber den
// Export-Zweig "GET /api/config?bpExport" (Repo Steuerboard, api/config.js),
// geschuetzt mit demselben Secret wie die Gegenrichtung
// (BUSINESSPLAN_LESE_SECRET). Fehler sind NIE fatal: ohne Steuerboard-Daten
// entsteht der Businessplan trotzdem, nur eben ohne diesen Teil.

import { Project } from "@/lib/types";

export interface SteuerboardKarte {
  title: string;
  description?: string;
  status: string;
  assignee?: string;
  team?: string;
  dueDate?: string;
  comments?: { author?: string; text?: string; ts?: string }[];
  createdBy?: string;
  createdAt?: string;
}

export interface SteuerboardExport {
  projectName?: string | null;
  stage?: number | null;
  projectContext?: string | null;
  columns: string[];
  people: string[];
  wig?: {
    formulierung?: string;
    leadMassnahmen?: { text?: string }[];
    aktuellerStand?: number;
    [key: string]: unknown;
  } | null;
  tasks: SteuerboardKarte[];
  coach: { rolle: string; author?: string | null; text: string; ts: string }[];
  wigReviews: { data: Record<string, unknown>; createdAt: string }[];
}

/** Liefert den Steuerboard-Export oder null (nicht vorhanden / nicht erreichbar). */
export async function ladeSteuerboardExport(project: Project): Promise<SteuerboardExport | null> {
  const secret = process.env.BUSINESSPLAN_LESE_SECRET;
  const basis = project.steuerboard?.url?.trim();
  if (!secret || !basis) return null;

  const url = `${basis.replace(/\/+$/, "")}/api/config?bpExport=1`;
  try {
    const res = await fetch(url, {
      headers: { "x-businessplan-secret": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<SteuerboardExport> & { ok?: boolean };
    if (!body || body.ok === false) return null;
    return {
      projectName: body.projectName ?? null,
      stage: body.stage ?? null,
      projectContext: body.projectContext ?? null,
      columns: Array.isArray(body.columns) ? body.columns : [],
      people: Array.isArray(body.people) ? body.people : [],
      wig: body.wig ?? null,
      tasks: Array.isArray(body.tasks) ? body.tasks : [],
      coach: Array.isArray(body.coach) ? body.coach : [],
      wigReviews: Array.isArray(body.wigReviews) ? body.wigReviews : [],
    };
  } catch {
    return null;
  }
}
