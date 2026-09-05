import { NextRequest, NextResponse } from "next/server";
import {
  beantworteProjektstartFragebogen,
  getProject,
  setAufgabenVorschlaege,
  setProjektstartFehler,
} from "@/lib/data";
import { getSession } from "@/lib/auth";
import { PHASES, ProjektArt } from "@/lib/types";
import { schlageAufgabenVor, VorschlagError } from "@/lib/aufgabenVorschlag";

/**
 * Speichert die Antworten des Projektleiters auf den Projektstart-
 * Fragebogen und lässt die KI direkt im Anschluss die Aufgaben-Vorschläge
 * generieren. Nur der zugewiesene Projektleiter oder ein Admin darf
 * antworten. Schlägt die KI-Generierung fehl, bleiben die Antworten trotzdem
 * gespeichert – der Fehler wird nur vermerkt, damit es später erneut
 * versucht werden kann.
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

  const fragebogen = project.projektstartFragebogen;
  if (!fragebogen) {
    return NextResponse.json(
      { error: "Kein offener Projektstart-Fragebogen für dieses Projekt." },
      { status: 400 }
    );
  }
  const istZugewiesenerProjektleiter =
    fragebogen.projektleiterEmail === session.email.toLowerCase();
  if (!session.isAdmin && !istZugewiesenerProjektleiter) {
    return NextResponse.json(
      { error: "Nur der zugewiesene Projektleiter oder ein Admin kann diesen Fragebogen beantworten." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    projektArt?: ProjektArt;
    zielsituation?: string;
    umsatzziel?: string;
    liquiditaet?: string;
    meilensteine?: string;
  };
  const projektArt = body.projektArt;
  const zielsituation = body.zielsituation?.trim();
  const meilensteine = body.meilensteine?.trim();

  if (projektArt !== "geschaeft" && projektArt !== "privat") {
    return NextResponse.json(
      { error: "Bitte angeben, ob es ein Geschäftsprojekt oder ein privates Projekt ist." },
      { status: 400 }
    );
  }
  if (!zielsituation) {
    return NextResponse.json({ error: "Zielsituation ist erforderlich." }, { status: 400 });
  }
  if (!meilensteine) {
    return NextResponse.json({ error: "Mindestens ein Meilenstein ist erforderlich." }, { status: 400 });
  }

  try {
    await beantworteProjektstartFragebogen(params.slug, {
      projektArt,
      zielsituation,
      umsatzziel: body.umsatzziel?.trim() || undefined,
      liquiditaet: body.liquiditaet?.trim() || undefined,
      meilensteine,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }

  const phaseName = PHASES.find((p) => p.code === project.aktuellePhase)?.name ?? project.aktuellePhase;

  try {
    const titel = await schlageAufgabenVor({
      projektName: project.name,
      projektArt,
      zielsituation,
      umsatzziel: body.umsatzziel,
      liquiditaet: body.liquiditaet,
      meilensteine,
      phaseName,
    });
    const updated = await setAufgabenVorschlaege(params.slug, titel);
    return NextResponse.json({ project: updated });
  } catch (err) {
    const meldung =
      err instanceof VorschlagError || err instanceof Error
        ? err.message
        : "Unbekannter Fehler";
    const updated = await setProjektstartFehler(params.slug, meldung);
    // Bewusst kein 5xx: Die Antworten wurden gespeichert, nur die
    // KI-Generierung ist fehlgeschlagen – das Projekt bekommt trotzdem den
    // aktuellen Stand zurück, die Fehlermeldung steht im Fragebogen selbst.
    return NextResponse.json({ project: updated });
  }
}
