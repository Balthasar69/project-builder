import { NextResponse } from "next/server";
import { getProject, setBitrixGroupId } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { addWorkgroupMembers, createWorkgroup } from "@/lib/bitrix24";

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
    const groupId = await createWorkgroup({
      name: project.name,
      description: `Automatisch angelegt vom Project Builder für „${project.name}".`,
    });

    // Kernteam-Mitglieder mit hinterlegter Bitrix24-Nutzer-Nummer direkt zur
    // Arbeitsgruppe hinzufügen, damit sie die Aufgaben auch in Bitrix24
    // selbst sehen (nicht nur über die App). Schlägt das aus irgendeinem
    // Grund fehl, soll das die Verbindung selbst nicht scheitern lassen –
    // die Gruppe existiert dann trotzdem, nur eben ohne alle Mitglieder.
    const mitgliederIds = project.kernteam
      .map((m) => m.bitrix24UserId)
      .filter((id): id is number => typeof id === "number");
    try {
      await addWorkgroupMembers(groupId, mitgliederIds);
    } catch {
      // bewusst ignoriert, siehe Kommentar oben
    }

    const updated = await setBitrixGroupId(params.slug, groupId);
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 502 }
    );
  }
}
