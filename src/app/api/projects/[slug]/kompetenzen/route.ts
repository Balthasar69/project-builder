import { NextRequest, NextResponse } from "next/server";
import { getProject, getUserByEmail, setKompetenzBeitrag } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";

/**
 * Legt den eigenen Kompetenzen-Eintrag an oder überschreibt ihn. Jede
 * Person mit Projektzugriff (Kernteam ODER Team) trägt hier normalerweise
 * für sich selbst ein, was sie beitragen kann bzw. möchte. Seit v0.9x
 * dürfen Admins zusätzlich – wie schon beim Projekt-Check und im Chat –
 * per `fuerEmail` im Namen einer anderen Person mit Projektzugriff
 * eintragen bzw. deren Eintrag korrigieren, z. B. wenn diese Person sich
 * selbst (noch) nicht einloggen kann. Ohne `fuerEmail` bleibt es exakt
 * beim bisherigen Verhalten: die E-Mail-Adresse kommt aus der Session.
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

  if (!hatProjektZugriff(session, project)) {
    return NextResponse.json(
      { error: "Kein Zugriff auf dieses Projekt." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    kannBeitragen?: string;
    moechteBeitragen?: string;
    fuerEmail?: string;
  };
  const kannBeitragen = body.kannBeitragen?.trim() ?? "";
  const moechteBeitragen = body.moechteBeitragen?.trim() ?? "";
  if (!kannBeitragen && !moechteBeitragen) {
    return NextResponse.json(
      { error: "Bitte mindestens eines der beiden Felder ausfüllen." },
      { status: 400 }
    );
  }

  // Für wen der Eintrag gilt: normalerweise die angemeldete Person selbst.
  // Nur Admins dürfen stattdessen `fuerEmail` mitschicken und damit im
  // Namen einer anderen Person mit Projektzugriff eintragen – das wird
  // hier serverseitig erneut geprüft, nicht nur im Client.
  let person = { email: session.email, name: session.name };
  if (body.fuerEmail && body.fuerEmail.toLowerCase() !== session.email.toLowerCase()) {
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: "Nur Admins dürfen im Namen einer anderen Person eintragen." },
        { status: 403 }
      );
    }
    const zielEmail = body.fuerEmail.toLowerCase();
    const zielKernteamEintrag = project.kernteam.find(
      (m) => m.email?.toLowerCase() === zielEmail
    );
    const hatZugriff =
      !!zielKernteamEintrag ||
      project.mitglieder.some((m) => m.toLowerCase() === zielEmail);
    if (!hatZugriff) {
      return NextResponse.json(
        { error: "Diese Person hat keinen Zugriff auf dieses Projekt." },
        { status: 400 }
      );
    }
    const zielKonto = await getUserByEmail(body.fuerEmail);
    const zielName = zielKonto?.name ?? zielKernteamEintrag?.name ?? body.fuerEmail;
    person = { email: body.fuerEmail, name: zielName };
  }

  try {
    const updated = await setKompetenzBeitrag(params.slug, {
      email: person.email,
      name: person.name,
      kannBeitragen,
      moechteBeitragen,
    });
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
