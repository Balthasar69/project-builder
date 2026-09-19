import { NextRequest, NextResponse } from "next/server";
import { getProject, setDokumenteLink } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";

/**
 * Setzt/ändert den Link zur externen Dokumenten-Ablage des Projekts
 * (aktuell: ein Google-Drive-Ordner) – wie die Projektbeschreibung nur
 * für Kernteam-Mitglieder und Admins gedacht (siehe `istKernteam`).
 * Es findet keine Google-API-Anbindung statt, es wird nur die URL
 * gespeichert; die Freigaben innerhalb des Ordners regelt Google Drive
 * selbst.
 */
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
          "Nur Kernteam-Mitglieder oder Admins dürfen den Link zur Dokumenten-Ablage ändern.",
      },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { dokumenteLink?: string };
  const dokumenteLink = (body.dokumenteLink ?? "").trim();

  if (dokumenteLink && !/^https?:\/\//i.test(dokumenteLink)) {
    return NextResponse.json(
      { error: "Bitte einen gültigen Link angeben (beginnend mit http:// oder https://)." },
      { status: 400 }
    );
  }

  try {
    const updated = await setDokumenteLink(params.slug, dokumenteLink);
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
