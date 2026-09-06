import { NextRequest, NextResponse } from "next/server";
import { getProject, setKompetenzBeitrag } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";

/**
 * Legt den eigenen Kompetenzen-Eintrag an oder überschreibt ihn. Bewusst
 * keine Rollen-Einschränkung wie bei Kernteam/Ideen – jede Person mit
 * Projektzugriff (Kernteam ODER Team) trägt hier für sich selbst ein, was
 * sie beitragen kann bzw. möchte; niemand kann den Eintrag einer anderen
 * Person ändern (die E-Mail-Adresse kommt aus der Session, nicht aus dem
 * Request-Body).
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
  };
  const kannBeitragen = body.kannBeitragen?.trim() ?? "";
  const moechteBeitragen = body.moechteBeitragen?.trim() ?? "";
  if (!kannBeitragen && !moechteBeitragen) {
    return NextResponse.json(
      { error: "Bitte mindestens eines der beiden Felder ausfüllen." },
      { status: 400 }
    );
  }

  try {
    const updated = await setKompetenzBeitrag(params.slug, {
      email: session.email,
      name: session.name,
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
