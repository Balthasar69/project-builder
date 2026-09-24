import { NextRequest, NextResponse } from "next/server";
import {
  ensureBitrixGroupId,
  getProject,
  listTaskNotesForSlug,
  setProjektZusammenfassung,
} from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { listTasks } from "@/lib/bitrix24";
import {
  erstelleProjektZusammenfassung,
  ZusammenfassungAufgabe,
  ZusammenfassungError,
} from "@/lib/projektZusammenfassung";
import { PHASES, Project } from "@/lib/types";
import { SessionPayload } from "@/lib/session";

// Der Aufruf bei Groq/Claude braucht wegen der Laenge der Ausarbeitung
// spuerbar laenger als die kurze Aufgaben-Hilfestellung – auf Plaenen, die
// laengere Laufzeiten erlauben, gilt dieser hoehere Wert, sonst wird
// automatisch auf das jeweilige Maximum begrenzt.
export const maxDuration = 60;

async function pruefeZugriff(
  slug: string
): Promise<{ error: NextResponse } | { session: SessionPayload; project: Project }> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 }) };
  }
  const project = await getProject(slug);
  if (!project) {
    return { error: NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 }) };
  }
  // Bewusst fuer alle mit Projektzugriff (Kernteam UND Team), nicht nur
  // Admins: die Zusammenfassung soll jedes Mitglied anfordern koennen.
  if (!hatProjektZugriff(session, project)) {
    return {
      error: NextResponse.json({ error: "Kein Zugriff auf dieses Projekt." }, { status: 403 }),
    };
  }
  return { session, project };
}

/** Liefert die bereits gespeicherte Zusammenfassung, falls vorhanden. */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const check = await pruefeZugriff(params.slug);
  if ("error" in check) return check.error;

  return NextResponse.json({ zusammenfassung: check.project.zusammenfassung ?? null });
}

/** Erstellt (bzw. erneuert) die ausfuehrliche Projekt-Zusammenfassung per KI. */
export async function POST(_req: NextRequest, { params }: { params: { slug: string } }) {
  const check = await pruefeZugriff(params.slug);
  if ("error" in check) return check.error;
  const { session, project } = check;

  const phase = PHASES.find((p) => p.code === project.aktuellePhase);

  // Bitrix24-Aufgaben + alle Notizen dazu einsammeln – analog zur normalen
  // Aufgabenansicht (siehe tasks/route.ts), plus Gruppierung der Notizen je
  // Aufgabe.
  let aufgaben: ZusammenfassungAufgabe[] = [];
  try {
    const { project: verbundenesProjekt, groupId } = await ensureBitrixGroupId(project);
    const [tasks, notizen] = await Promise.all([
      listTasks({ groupId, dealId: verbundenesProjekt.bitrix24.dealId || undefined }),
      listTaskNotesForSlug(params.slug),
    ]);
    const notizenJeAufgabe = new Map<string, typeof notizen>();
    for (const n of notizen) {
      const liste = notizenJeAufgabe.get(n.taskId) ?? [];
      liste.push(n);
      notizenJeAufgabe.set(n.taskId, liste);
    }
    aufgaben = tasks.map((t) => ({
      titel: t.title,
      status: t.stage?.title ?? t.status,
      erledigt: t.erledigt,
      erstelltAm: t.erstelltAm,
      notizen: (notizenJeAufgabe.get(t.id) ?? []).map((n) => ({
        autorName: n.authorName,
        text: n.transcript || n.text || "(Sprachnotiz ohne Text)",
        erstelltAm: n.erstelltAm,
      })),
    }));
  } catch {
    // Bitrix24 gerade nicht erreichbar o. ae. – die Zusammenfassung soll
    // trotzdem entstehen, nur eben ohne den Aufgaben-Teil.
    aufgaben = [];
  }

  let text: string;
  try {
    text = await erstelleProjektZusammenfassung({
      projektName: project.name,
      projektBeschreibung: project.beschreibung,
      phaseName: phase?.name ?? project.aktuellePhase,
      phaseZiel: phase?.ziel ?? "",
      bewertungen: (project.checkVerlauf ?? []).map((c) => ({
        phaseName: PHASES.find((p) => p.code === c.phase)?.name ?? c.phase,
        score: c.score,
        empfehlung: c.empfehlung,
        notiz: c.notiz,
        bewerterName: c.bewerterName,
        durchgefuehrtAm: c.durchgefuehrtAm,
      })),
      chat: (project.chat ?? []).map((c) => ({
        autorName: c.autorName,
        text: c.text,
        erstelltAm: c.erstelltAm,
      })),
      ideen: (project.ideen ?? []).map((i) => ({
        erstelltVonName: i.erstelltVonName,
        text: i.text,
        erstelltAm: i.erstelltAm,
        uebernommen: Boolean(i.uebernommenAlsTaskId),
      })),
      kompetenzen: (project.kompetenzbeitraege ?? []).map((k) => ({
        name: k.name,
        kannBeitragen: k.kannBeitragen,
        moechteBeitragen: k.moechteBeitragen,
        aktualisiertAm: k.aktualisiertAm,
      })),
      aufgaben,
    });
  } catch (err) {
    const message =
      err instanceof ZusammenfassungError ? err.message : "Zusammenfassung fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const zusammenfassung = {
    text,
    erstelltAm: new Date().toISOString(),
    erstelltVonName: session.name,
    erstelltVonEmail: session.email,
  };

  // Speichern ist ein "Nice-to-have": schlaegt es fehl, bekommt die Person
  // die frisch erstellte Ausarbeitung trotzdem sofort angezeigt – nur mit
  // einem Hinweis, dass sie beim naechsten Laden ggf. wieder verschwindet.
  try {
    await setProjektZusammenfassung(params.slug, zusammenfassung);
  } catch {
    return NextResponse.json({
      zusammenfassung,
      speicherHinweis: "Die Zusammenfassung konnte nicht dauerhaft gespeichert werden.",
    });
  }

  return NextResponse.json({ zusammenfassung });
}
