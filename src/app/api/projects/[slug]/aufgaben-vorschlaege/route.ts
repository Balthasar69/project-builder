import { NextRequest, NextResponse } from "next/server";
import { entferneAufgabenVorschlag, getProject } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";

/** Verwirft einen einzelnen, noch nicht übernommenen Aufgaben-Vorschlag – nur fürs Kernteam. */
export async function DELETE(
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
      { error: "Nur das Kernteam kann Aufgaben-Vorschläge verwerfen." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "ID ist erforderlich." }, { status: 400 });
  }

  try {
    const updated = await entferneAufgabenVorschlag(params.slug, id);
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
