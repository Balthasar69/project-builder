import { NextRequest, NextResponse } from "next/server";
import { addIdee, getProject, removeIdee } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";

/** Legt eine neue Idee an – bewusst nur fürs Kernteam (Kapitel 25, Ergänzung "Ideen"). */
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
      { error: "Nur das Kernteam kann Ideen eintragen." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Text ist erforderlich." }, { status: 400 });
  }

  try {
    const updated = await addIdee(params.slug, {
      text,
      erstelltVonName: session.name,
      erstelltVonEmail: session.email,
    });
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

/** Entfernt eine noch nicht übernommene Idee wieder – ebenfalls nur fürs Kernteam. */
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
      { error: "Nur das Kernteam kann Ideen entfernen." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "ID ist erforderlich." }, { status: 400 });
  }

  try {
    const updated = await removeIdee(params.slug, id);
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
