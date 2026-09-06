import { NextResponse } from "next/server";
import { ensureBitrixGroupId, getProject } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { setTaskGroup } from "@/lib/bitrix24";

export async function POST(
  _req: Request,
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
  if (!hatProjektZugriff(session, project)) {
    return NextResponse.json(
      { error: "Kein Zugriff auf dieses Projekt." },
      { status: 403 }
    );
  }

  if (project.bitrix24.groupId) {
    // Schon verbunden – idempotent, kein Fehler.
    return NextResponse.json({ project });
  }

  try {
    const { project: updated, groupId, neuVerbunden } = await ensureBitrixGroupId(project);

    // War das Projekt noch nicht verbunden, können bereits übernommene
    // KI-Aufgaben-Vorschläge oder Ideen als Bitrix24-Aufgabe OHNE
    // Gruppen-Zuordnung entstanden sein (Fehler vor dieser Korrektur, siehe
    // README) – solche Aufgaben existierten zwar in Bitrix24, tauchten aber
    // nirgends im Aufgaben-Bereich der App auf. Jetzt nachträglich der neuen
    // Gruppe zuordnen, damit sie sichtbar werden. Best effort: schlägt es
    // für eine einzelne Aufgabe fehl (z. B. weil sie inzwischen in Bitrix24
    // gelöscht wurde), wird bei den übrigen trotzdem weitergemacht.
    let repariert = 0;
    if (neuVerbunden) {
      const verwaisteTaskIds = [
        ...(updated.aufgabenVorschlaege ?? []).map((v) => v.uebernommenAlsTaskId),
        ...(updated.ideen ?? []).map((i) => i.uebernommenAlsTaskId),
      ].filter((id): id is string => !!id);

      for (const taskId of verwaisteTaskIds) {
        try {
          await setTaskGroup(taskId, groupId);
          repariert += 1;
        } catch {
          // bewusst ignoriert, siehe Kommentar oben
        }
      }
    }

    return NextResponse.json({ project: updated, repariert });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 502 }
    );
  }
}
