import { NextRequest, NextResponse } from "next/server";
import { getProject, setAufgabenAnalyse } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { analysiereAufgabe, AnalyseError } from "@/lib/aufgabenAnalyse";
import { PHASES } from "@/lib/types";

// Der Aufruf bei Claude braucht etwas länger als die Standard-Zeitgrenze
// von Vercel-Funktionen (10 s im Hobby-Plan) – auf Plänen, die längere
// Laufzeiten erlauben, gilt dieser höhere Wert, sonst wird automatisch auf
// das jeweilige Maximum begrenzt.
export const maxDuration = 60;

async function pruefeZugriff(slug: string) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 }) };
  }
  const project = await getProject(slug);
  if (!project) {
    return { error: NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 }) };
  }
  if (!hatProjektZugriff(session, project)) {
    return {
      error: NextResponse.json(
        { error: "Kein Zugriff auf dieses Projekt." },
        { status: 403 }
      ),
    };
  }
  return { session, project };
}

/** Liefert eine bereits gespeicherte Einschätzung zu dieser Aufgabe, falls vorhanden. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; taskId: string } }
) {
  const check = await pruefeZugriff(params.slug);
  if ("error" in check) return check.error;

  const analyse = check.project.aufgabenAnalysen?.[params.taskId] ?? null;
  return NextResponse.json({ analyse });
}

/** Erstellt (bzw. erneuert) die Einschätzung zu einer Aufgabe über Claude. */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; taskId: string } }
) {
  const check = await pruefeZugriff(params.slug);
  if ("error" in check) return check.error;
  const { project } = check;

  const body = (await req.json().catch(() => ({}))) as { titel?: string };
  const titel = body.titel?.trim();
  if (!titel) {
    return NextResponse.json({ error: "Aufgabentitel fehlt." }, { status: 400 });
  }

  const phase = PHASES.find((p) => p.code === project.aktuellePhase);

  let text: string;
  try {
    text = await analysiereAufgabe({
      aufgabenTitel: titel,
      projektName: project.name,
      projektBeschreibung: project.beschreibung,
      phaseName: phase?.name ?? project.aktuellePhase,
      phaseZiel: phase?.ziel ?? "",
    });
  } catch (err) {
    const message =
      err instanceof AnalyseError ? err.message : "Analyse fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const analyse = { text, erstelltAm: new Date().toISOString() };

  // Speichern ist ein "Nice-to-have": schlägt es fehl, bekommt die Person
  // die frisch erstellte Einschätzung trotzdem sofort angezeigt – nur mit
  // einem Hinweis, dass sie beim nächsten Laden ggf. wieder verschwindet.
  try {
    await setAufgabenAnalyse(params.slug, params.taskId, analyse);
  } catch {
    return NextResponse.json({
      analyse,
      speicherHinweis: "Die Einschätzung konnte nicht dauerhaft gespeichert werden.",
    });
  }

  return NextResponse.json({ analyse });
}
