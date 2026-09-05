import { NextRequest, NextResponse } from "next/server";
import { getProject, saveCheckResult } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";
import { werteCheckAus } from "@/lib/scoring";
import { CheckAnswers, PHASES } from "@/lib/types";
import { benachrichtigeKernteam } from "@/lib/notify";

// Kann jetzt zusätzlich mehrere Benachrichtigungs-E-Mails ans Kernteam
// verschicken – zusammen mit dem Speichern etwas mehr Zeit als die
// Standard-Zeitgrenze von Vercel-Funktionen (10 s im Hobby-Plan) nötig.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  if (!istKernteam(session, project)) {
    return NextResponse.json(
      {
        error:
          "Nur Kernteam-Mitglieder oder Admins dürfen die Bewertung abgeben.",
      },
      { status: 403 }
    );
  }

  const body = (await req.json()) as { answers: CheckAnswers; notiz?: string };

  // Die Phase kommt bewusst vom Server (aktuelle Projektphase), nicht vom
  // Client – so gehört jeder Check zweifelsfrei zu der Phase, in der er
  // wirklich durchgeführt wurde (Kapitel 6/11). Bewerter-Identität kommt
  // ebenfalls vom Server (Session), nicht vom Client.
  const result = werteCheckAus(
    body.answers,
    project.aktuellePhase,
    { email: session.email, name: session.name },
    body.notiz
  );

  try {
    const updated = await saveCheckResult(params.slug, result);

    // Benachrichtigung darf das Speichern nie blockieren.
    try {
      const phasenName =
        PHASES.find((p) => p.code === project.aktuellePhase)?.name ??
        project.aktuellePhase;
      await benachrichtigeKernteam({
        kernteam: updated.kernteam,
        ausloeserEmail: session.email,
        subject: `Neue Bewertung von ${session.name} · ${project.name}`,
        html: `
          <p>Hallo,</p>
          <p>${session.name} hat im Projekt <strong>${project.name}</strong> eine Bewertung für die Phase „${phasenName}" abgegeben (Score ${result.score}, Empfehlung ${result.empfehlung}).</p>
          <p>Alle Bewertungen im Projekt-Check ansehen: einfach im Project Builder das Projekt öffnen.</p>
        `,
      });
    } catch {
      // Best-effort – ein Fehler hier ändert nichts an der Antwort.
    }

    return NextResponse.json({ project: updated, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 404 }
    );
  }
}
