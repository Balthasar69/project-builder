import { NextRequest, NextResponse } from "next/server";
import { getProject, setAufgabenVorschlaege, setProjektstartFehler } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { PHASES } from "@/lib/types";
import { schlageAufgabenVor, VorschlagError } from "@/lib/aufgabenVorschlag";

/**
 * Lässt die KI aus den bereits gespeicherten Antworten erneut Aufgaben-
 * Vorschläge generieren – z. B. nachdem ein erster Versuch fehlgeschlagen
 * ist (siehe `ProjektstartFragebogen.fehler`), oder um eine frische Auswahl
 * zu bekommen. Nur der zugewiesene Projektleiter oder ein Admin.
 */
export async function POST(
  _req: NextRequest,
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
  if (!fragebogen || !fragebogen.beantwortetAm) {
    return NextResponse.json(
      { error: "Der Fragebogen wurde noch nicht beantwortet." },
      { status: 400 }
    );
  }
  const istZugewiesenerProjektleiter =
    fragebogen.projektleiterEmail === session.email.toLowerCase();
  if (!session.isAdmin && !istZugewiesenerProjektleiter) {
    return NextResponse.json(
      { error: "Nur der zugewiesene Projektleiter oder ein Admin kann dies erneut anstoßen." },
      { status: 403 }
    );
  }
  if (!fragebogen.projektArt || !fragebogen.zielsituation || !fragebogen.meilensteine) {
    return NextResponse.json(
      { error: "Unvollständige Antworten – bitte den Fragebogen erneut beantworten." },
      { status: 400 }
    );
  }

  const phaseName = PHASES.find((p) => p.code === project.aktuellePhase)?.name ?? project.aktuellePhase;

  try {
    const titel = await schlageAufgabenVor({
      projektName: project.name,
      projektArt: fragebogen.projektArt,
      zielsituation: fragebogen.zielsituation,
      umsatzziel: fragebogen.umsatzziel,
      liquiditaet: fragebogen.liquiditaet,
      meilensteine: fragebogen.meilensteine,
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
    return NextResponse.json({ project: updated });
  }
}
