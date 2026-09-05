import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { completeTask } from "@/lib/bitrix24";
import { benachrichtigeKernteam } from "@/lib/notify";

// Kann jetzt zusätzlich mehrere Benachrichtigungs-E-Mails ans Kernteam
// verschicken – zusammen mit dem Erledigen etwas mehr Zeit als die
// Standard-Zeitgrenze von Vercel-Funktionen (10 s im Hobby-Plan) nötig.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; taskId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }
  if (!hatProjektZugriff(session, project)) {
    return NextResponse.json(
      { error: "Kein Zugriff auf dieses Projekt." },
      { status: 403 }
    );
  }

  // Der Aufgabentitel kommt vom Client nur für die Benachrichtigung mit
  // (Bitrix24 selbst kennt den Titel bereits über die Aufgabe) – fehlt er,
  // wird einfach ein neutraler Text verwendet, das Erledigen funktioniert
  // trotzdem ganz normal.
  const body = (await req.json().catch(() => ({}))) as { title?: string };

  try {
    await completeTask(params.taskId);

    // Benachrichtigung darf das Erledigen selbst nie blockieren.
    try {
      await benachrichtigeKernteam({
        kernteam: project.kernteam,
        ausloeserEmail: session.email,
        subject: `Aufgabe erledigt · ${project.name}`,
        html: `
          <p>Hallo,</p>
          <p>${session.name} hat im Projekt <strong>${project.name}</strong> die Aufgabe „${
          body.title ?? params.taskId
        }" als erledigt markiert.</p>
        `,
      });
    } catch {
      // Best-effort.
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 502 }
    );
  }
}
