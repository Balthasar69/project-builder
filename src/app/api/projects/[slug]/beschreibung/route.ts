import { NextRequest, NextResponse } from "next/server";
import { getProject, setBeschreibung } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";

/**
 * Ändert die Projektbeschreibung – wie der Phasenwechsel nur für
 * Kernteam-Mitglieder und Admins gedacht (siehe `istKernteam`).
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
          "Nur Kernteam-Mitglieder oder Admins dürfen die Projektbeschreibung ändern.",
      },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { beschreibung?: string };
  const beschreibung = body.beschreibung ?? "";

  try {
    const updated = await setBeschreibung(params.slug, beschreibung);
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
