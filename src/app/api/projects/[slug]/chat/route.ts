import { NextRequest, NextResponse } from "next/server";
import { addChatNachricht, getProject } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";

/**
 * Interner Projekt-Chat: GET liefert den bisherigen Verlauf (für das
 * einfache Nachladen per Intervall im Client, ohne die ganze Seite neu zu
 * laden), POST hängt eine neue Nachricht an. Sichtbar/nutzbar für alle mit
 * Projektzugriff (Kernteam & Team), wie im Rest des Cockpits.
 */
export async function GET(
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
    return NextResponse.json(
      { error: "Kein Zugriff auf dieses Projekt." },
      { status: 403 }
    );
  }

  return NextResponse.json({ chat: project.chat ?? [] });
}

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
    return NextResponse.json(
      { error: "Kein Zugriff auf dieses Projekt." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Text ist erforderlich." }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json(
      { error: "Nachricht ist zu lang (max. 2000 Zeichen)." },
      { status: 400 }
    );
  }

  try {
    const updated = await addChatNachricht(params.slug, {
      autorEmail: session.email,
      autorName: session.name,
      text,
    });
    return NextResponse.json({ chat: updated.chat ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
