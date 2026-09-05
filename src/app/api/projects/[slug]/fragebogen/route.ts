import { NextRequest, NextResponse } from "next/server";
import {
  brichProjektstartFragebogenAb,
  getProject,
  starteProjektstartFragebogen,
} from "@/lib/data";
import { getSession } from "@/lib/auth";

/**
 * Startet einen neuen Projektstart-Fragebogen ("Aufgaben von der KI
 * vorschlagen lassen") – nur Admins dürfen den Projektleiter bestimmen, der
 * (oder die) anschließend die Fragen beantwortet. Der Projektleiter muss
 * bereits im Kernteam stehen (Auswahl im Formular, keine freie E-Mail).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json(
      { error: "Nur Admins können den Projektstart-Fragebogen starten." },
      { status: 403 }
    );
  }

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    projektleiterEmail?: string;
  };
  const email = body.projektleiterEmail?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Projektleiter ist erforderlich." }, { status: 400 });
  }
  const mitglied = project.kernteam.find((m) => m.email?.toLowerCase() === email);
  if (!mitglied) {
    return NextResponse.json(
      { error: "Diese Person steht nicht im Kernteam dieses Projekts." },
      { status: 400 }
    );
  }

  try {
    const updated = await starteProjektstartFragebogen(params.slug, {
      projektleiterEmail: email,
      projektleiterName: mitglied.name,
    });
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

/** Bricht die laufende Fragebogen-Runde ab (offen oder bereits beantwortet) – nur Admins. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json(
      { error: "Nur Admins können den Projektstart-Fragebogen abbrechen." },
      { status: 403 }
    );
  }

  try {
    const updated = await brichProjektstartFragebogenAb(params.slug);
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
