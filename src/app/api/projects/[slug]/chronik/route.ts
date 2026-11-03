import { NextRequest, NextResponse } from "next/server";
import { addChronikEintrag, getProject, removeChronikEintrag } from "@/lib/data";
import { getSession, hatProjektZugriff, istKernteam } from "@/lib/auth";
import { CHRONIK_MAX_ZEICHEN } from "@/lib/types";

/** Neuer Chronik-Eintrag (nur Datum + Kurzbeschreibung) – darf jedes Projektmitglied. */
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
  if (!hatProjektZugriff(session, project)) {
    return NextResponse.json({ error: "Kein Zugriff auf dieses Projekt." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { datum?: string; text?: string };
  const datum = body.datum?.trim() ?? "";
  const text = body.text?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || isNaN(Date.parse(datum))) {
    return NextResponse.json({ error: "Bitte ein gültiges Datum wählen." }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Kurzbeschreibung fehlt." }, { status: 400 });
  }
  if (text.length > CHRONIK_MAX_ZEICHEN) {
    return NextResponse.json(
      { error: `Bitte höchstens ${CHRONIK_MAX_ZEICHEN} Zeichen.` },
      { status: 400 }
    );
  }

  try {
    const updated = await addChronikEintrag(params.slug, {
      datum,
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

/** Löscht einen Eintrag: eigene Einträge die Person selbst, alle anderen nur Kernteam/Admin. */
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

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const eintrag = (project.chronik ?? []).find((e) => e.id === body.id);
  if (!eintrag) {
    return NextResponse.json({ error: "Eintrag nicht gefunden." }, { status: 404 });
  }
  const eigenerEintrag =
    !eintrag.automatisch && eintrag.erstelltVonEmail === session.email.toLowerCase();
  if (!eigenerEintrag && !istKernteam(session, project)) {
    return NextResponse.json(
      { error: "Nur eigene Einträge können gelöscht werden." },
      { status: 403 }
    );
  }

  try {
    const updated = await removeChronikEintrag(params.slug, eintrag.id);
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
