import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { PHASES } from "@/lib/types";
import { berechneReifegrad } from "@/lib/scoring";
import { listTasks } from "@/lib/bitrix24";
import { ermittleNaechsteSchritte, NaechsteSchritteError } from "@/lib/naechsteSchritte";

/**
 * Persönlicher KI-Hinweis "Für dich als Nächstes" (siehe naechsteSchritte.ts)
 * für die angemeldete Person in genau diesem Projekt. Wird vom Client beim
 * Laden der Projektseite einmal abgerufen (kein Speichern in der Datenbank –
 * der Hinweis ist bewusst leichtgewichtig und wird bei jedem Aufruf neu aus
 * dem aktuellen Stand abgeleitet).
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

  const kernteamEintrag = project.kernteam.find(
    (m) => m.email?.toLowerCase() === session.email.toLowerCase()
  );
  const phaseName =
    PHASES.find((p) => p.code === project.aktuellePhase)?.name ?? project.aktuellePhase;
  const reifegrad = berechneReifegrad(project.bereichStatus);
  const hatKompetenzEintrag = (project.kompetenzbeitraege ?? []).some(
    (k) => k.email.toLowerCase() === session.email.toLowerCase()
  );

  const offeneAufgaben = await listTasks({
    groupId: project.bitrix24.groupId,
    dealId: project.bitrix24.dealId || undefined,
  })
    .then((tasks) => tasks.filter((t) => !t.erledigt).length)
    .catch(() => 0);

  const chatLaenge = (project.chat ?? []).length;
  const chatAktivitaet: "keine" | "wenig" | "aktiv" =
    chatLaenge === 0 ? "keine" : chatLaenge < 5 ? "wenig" : "aktiv";

  try {
    const ergebnis = await ermittleNaechsteSchritte({
      personName: session.name,
      rolle: kernteamEintrag?.rolle ?? "Team-Mitglied",
      projektName: project.name,
      phaseName,
      reifegrad,
      bewertungEmpfehlung: project.letzterCheck?.empfehlung,
      hatKompetenzEintrag,
      offeneAufgaben,
      ideenAnzahl: (project.ideen ?? []).length,
      chatAktivitaet,
    });
    return NextResponse.json(ergebnis);
  } catch (err) {
    const message =
      err instanceof NaechsteSchritteError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
