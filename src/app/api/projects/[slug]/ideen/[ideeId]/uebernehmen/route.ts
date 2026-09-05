import { NextRequest, NextResponse } from "next/server";
import { getProject, markiereIdeeUebernommen } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";
import { createTask } from "@/lib/bitrix24";

/**
 * Übernimmt eine Idee als echte Bitrix24-Aufgabe (Kapitel 25, Ergänzung
 * "Ideen") – nur fürs Kernteam. Die verantwortliche Person folgt bewusst
 * derselben Standardzuordnung wie beim regulären "Aufgabe hinzufügen"
 * (erstes Kernteam-Mitglied mit hinterlegter Bitrix24-Nutzer-ID, sonst der
 * Webhook-eigene Nutzer) – kein eigener Auswahlschritt.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string; ideeId: string } }
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
      { error: "Nur das Kernteam kann Ideen nach Bitrix24 übernehmen." },
      { status: 403 }
    );
  }

  const idee = (project.ideen ?? []).find((i) => i.id === params.ideeId);
  if (!idee) {
    return NextResponse.json({ error: "Idee nicht gefunden" }, { status: 404 });
  }
  if (idee.uebernommenAlsTaskId) {
    return NextResponse.json(
      { error: "Diese Idee wurde bereits übernommen." },
      { status: 400 }
    );
  }

  const responsibleId = project.kernteam.find((m) => m.bitrix24UserId)?.bitrix24UserId;

  try {
    const task = await createTask({
      title: idee.text,
      groupId: project.bitrix24.groupId,
      dealId: project.bitrix24.dealId || undefined,
      responsibleId,
    });
    const updated = await markiereIdeeUebernommen(params.slug, params.ideeId, task.id);
    return NextResponse.json({ project: updated, task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 502 }
    );
  }
}
