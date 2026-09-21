import { NextRequest, NextResponse } from "next/server";
import { addChatNachricht, editChatNachricht, getProject } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { CHAT_BEARBEITEN_MINUTEN } from "@/lib/types";

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

/**
 * Bearbeitet eine bestehende Nachricht: die Autorin/der Autor selbst nur
 * innerhalb von `CHAT_BEARBEITEN_MINUTEN` nach dem Senden, Admins jederzeit
 * (Moderation) und auch für fremde Nachrichten.
 */
export async function PATCH(
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

  const body = (await req.json().catch(() => ({}))) as {
    nachrichtId?: string;
    text?: string;
  };
  const nachrichtId = body.nachrichtId;
  const text = body.text?.trim();
  if (!nachrichtId || !text) {
    return NextResponse.json(
      { error: "nachrichtId und text sind erforderlich." },
      { status: 400 }
    );
  }
  if (text.length > 2000) {
    return NextResponse.json(
      { error: "Nachricht ist zu lang (max. 2000 Zeichen)." },
      { status: 400 }
    );
  }

  const nachricht = (project.chat ?? []).find((n) => n.id === nachrichtId);
  if (!nachricht) {
    return NextResponse.json({ error: "Nachricht nicht gefunden." }, { status: 404 });
  }

  if (!session.isAdmin) {
    const eigeneNachricht =
      nachricht.autorEmail.toLowerCase() === session.email.toLowerCase();
    if (!eigeneNachricht) {
      return NextResponse.json(
        { error: "Nur die eigene Nachricht kann bearbeitet werden." },
        { status: 403 }
      );
    }
    const alterInMinuten =
      (Date.now() - new Date(nachricht.erstelltAm).getTime()) / 60000;
    if (alterInMinuten > CHAT_BEARBEITEN_MINUTEN) {
      return NextResponse.json(
        {
          error: `Nachrichten können nur innerhalb von ${CHAT_BEARBEITEN_MINUTEN} Minuten nach dem Senden bearbeitet werden.`,
        },
        { status: 403 }
      );
    }
  }

  try {
    const updated = await editChatNachricht(params.slug, { nachrichtId, text });
    return NextResponse.json({ chat: updated.chat ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
