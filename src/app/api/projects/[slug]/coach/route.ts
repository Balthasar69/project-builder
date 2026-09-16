import { NextRequest, NextResponse } from "next/server";
import { addCoachNachricht, getProject } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { GruendercoachError, holeCoachAntwort } from "@/lib/gruendercoach";

/**
 * Gründercoach-Bot-Chat (Ökosystem-Phase 1, siehe lib/gruendercoach.ts):
 * GET liefert den bisherigen, projektweit geteilten Verlauf (fürs Nachladen
 * im Client), POST hängt die Nachricht des Mitglieds an, fragt den Bot und
 * hängt dessen Antwort ebenfalls an. Zugriff wie beim internen Chat: alle
 * mit Projektzugriff (Kernteam & Team).
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

  return NextResponse.json({ coachChat: project.coachChat ?? [] });
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
  const text = body.text?.trim() ?? "";
  if (text.length > 2000) {
    return NextResponse.json(
      { error: "Nachricht ist zu lang (max. 2000 Zeichen)." },
      { status: 400 }
    );
  }

  // Gedächtnis: bisherigen Verlauf serverseitig aus der Datenbank laden
  // (nicht vom Client übernehmen) – identisches Prinzip wie im
  // Steuerboard-Repo (api/tasks/index.js PATCH-Zweig).
  const bisherigerVerlauf = project.coachChat ?? [];

  let antwort: string;
  try {
    antwort = await holeCoachAntwort({
      project,
      verlauf: bisherigerVerlauf,
      nachricht: text || undefined,
      aktuellerAutor: session.name,
    });
  } catch (err) {
    const message = err instanceof GruendercoachError ? err.message : "Gründercoach-Bot fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    if (text) {
      await addCoachNachricht(params.slug, {
        rolle: "mitglied",
        autorEmail: session.email,
        autorName: session.name,
        text,
      });
    }
    const aktualisiert = await addCoachNachricht(params.slug, { rolle: "bot", text: antwort });
    return NextResponse.json({ coachChat: aktualisiert.coachChat ?? [] });
  } catch (err) {
    // Speichern ist ein "Nice-to-have" wie im Steuerboard: die frisch
    // erstellte Antwort bekommt die Person trotzdem sofort angezeigt, auch
    // wenn sie beim nächsten Laden im Verlauf fehlen sollte.
    return NextResponse.json({
      coachChat: [...bisherigerVerlauf, { id: "temp", rolle: "bot" as const, text: antwort, erstelltAm: new Date().toISOString() }],
    });
  }
}
