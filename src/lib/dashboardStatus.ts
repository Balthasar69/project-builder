import {
  Project,
  PHASES,
  PhaseCode,
  BereichStatus,
  checksProPersonFuerPhase,
} from "./types";
import { berechneReifegrad, durchschnittFuerPhase } from "./scoring";
import { listTasks } from "./bitrix24";

// Schwellwerte fürs projektübergreifende Dashboard (v0.66) – bewusst fest
// im Code statt konfigurierbar, um die erste Version einfach zu halten.
// "Aktivität" zählt jede Änderung am Projekt: Bewertung, Chat, Idee,
// Kompetenz-Eintrag oder ein allgemeines Speichern (aktualisiertAm).
const TAGE_STILL = 14; // ab so vielen Tagen ohne Aktivität gilt ein Projekt als "hemmt"
const TAGE_AKTIV = 5; // bis zu so vielen Tagen gilt ein Projekt als "gerade aktiv"
const TAGE_AKTIVITAETS_FEED = 7; // Fenster fuer die "Letzte Aktivitaet(en)"-Spalte in der Steuerzentrale (v0.9x)
const MAX_AKTIVITAETEN = 3; // hoechstens so viele Eintraege je Projekt an die Steuerzentrale melden

export interface ProjektStatus {
  slug: string;
  name: string;
  phase: { code: PhaseCode; name: string; order: number; ziel: string };
  reifegrad: number;
  /** Für die kompakte Ring-Grafik im Dashboard (ReifegradRingKompakt). */
  bereichStatus: BereichStatus;
  bewertung: {
    empfehlung: "GO" | "WEITER PRÜFEN" | "STOPP";
    anzahlBewerter: number;
    zuletztAm: string;
  } | null;
  letzteAktivitaetAm: string | null;
  tageSeitAktivitaet: number | null;
  /**
   * Einzelne Aktivitaeten der letzten Tage (siehe TAGE_AKTIVITAETS_FEED),
   * neueste zuerst - fuer die "Letzte Aktivitaet"-Spalte in der
   * Steuerzentrale (public/dashboard.html der Steuerboard-Factory).
   * Bewusst getrennt von `letzteAktivitaetAm` oben (nur der reine
   * Zeitstempel, wird u.a. fuer den hemmt/vorangeht-Status gebraucht).
   */
  letzteAktivitaeten: { wer: string; was: string; wann: string }[];
  /** `null` = keine Bitrix24-Arbeitsgruppe verbunden oder Abruf fehlgeschlagen. */
  offeneAufgaben: number | null;
  aeltesteOffeneAufgabeTage: number | null;
  status: "hemmt" | "vorangeht" | "ansteht";
  /** Begründung(en) für den Status – leer bei "ansteht" (neutraler Normalfall). */
  gruende: string[];
  /**
   * Kurzstatus der ausfuehrlichen Projekt-Zusammenfassung (siehe
   * ProjektZusammenfassung in types.ts) fuer die gleichnamige Spalte in der
   * Steuerzentrale - bewusst nur Vorhandensein + Zeitpunkt, nicht der volle
   * (teils sehr lange) Text, der stattdessen direkt im Projekt liegt.
   */
  zusammenfassung: { erstelltAm: string; erstelltVonName: string } | null;
}

function letzteAktivitaet(project: Project): Date | null {
  const zeiten: (string | undefined)[] = [
    project.aktualisiertAm,
    ...(project.chat ?? []).map((c) => c.erstelltAm),
    ...(project.ideen ?? []).map((i) => i.erstelltAm),
    ...(project.kompetenzbeitraege ?? []).map((k) => k.aktualisiertAm),
    ...(project.checkVerlauf ?? []).map((c) => c.durchgefuehrtAm),
  ];
  const valid = zeiten
    .filter((z): z is string => !!z)
    .map((z) => new Date(z).getTime())
    .filter((t) => !Number.isNaN(t));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid));
}

interface AktivitaetsEintrag { wer: string; was: string; wann: string }

/**
 * Sammelt einzelne Aktivitaeten (nicht nur den reinen Zeitstempel wie
 * `letzteAktivitaet` oben) aus denselben vier Quellen, begrenzt auf die
 * letzten `TAGE_AKTIVITAETS_FEED` Tage und auf `MAX_AKTIVITAETEN` Eintraege -
 * fuer die "Letzte Aktivitaet"-Spalte in der Steuerzentrale. Kompetenz-
 * Eintraege liefern absichtlich nur einen Zeitpunkt (aktualisiertAm), da
 * dort nicht unterschieden wird, ob neu angelegt oder nur geaendert wurde.
 */
function letzteAktivitaeten(project: Project): AktivitaetsEintrag[] {
  const grenze = Date.now() - TAGE_AKTIVITAETS_FEED * 24 * 60 * 60 * 1000;
  const eintraege: AktivitaetsEintrag[] = [];

  (project.checkVerlauf ?? []).forEach((c) => {
    if (!c.durchgefuehrtAm) return;
    const t = new Date(c.durchgefuehrtAm).getTime();
    if (Number.isNaN(t) || t < grenze) return;
    eintraege.push({ wer: c.bewerterName || "Unbekannt", was: "Bewertung abgegeben", wann: c.durchgefuehrtAm });
  });

  (project.chat ?? []).forEach((m) => {
    if (!m.erstelltAm) return;
    const t = new Date(m.erstelltAm).getTime();
    if (Number.isNaN(t) || t < grenze) return;
    eintraege.push({ wer: m.autorName || "Unbekannt", was: "Chat-Nachricht", wann: m.erstelltAm });
  });

  (project.ideen ?? []).forEach((i) => {
    if (!i.erstelltAm) return;
    const t = new Date(i.erstelltAm).getTime();
    if (Number.isNaN(t) || t < grenze) return;
    eintraege.push({ wer: i.erstelltVonName || "Unbekannt", was: "Idee ergänzt", wann: i.erstelltAm });
  });

  (project.kompetenzbeitraege ?? []).forEach((k) => {
    if (!k.aktualisiertAm) return;
    const t = new Date(k.aktualisiertAm).getTime();
    if (Number.isNaN(t) || t < grenze) return;
    eintraege.push({ wer: k.name || "Unbekannt", was: "Kompetenz-Eintrag aktualisiert", wann: k.aktualisiertAm });
  });

  eintraege.sort((a, b) => new Date(b.wann).getTime() - new Date(a.wann).getTime());
  return eintraege.slice(0, MAX_AKTIVITAETEN);
}

function tageSeit(datum: Date | null): number | null {
  if (!datum) return null;
  return Math.max(0, Math.floor((Date.now() - datum.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Ermittelt Status und Kennzahlen EINES Projekts fürs projektübergreifende
 * Dashboard (v0.66, nur für Balthasar sichtbar, siehe /dashboard). Holt
 * dabei best effort zusätzlich offene Bitrix24-Aufgaben – aber nur, falls
 * bereits eine Arbeitsgruppe verbunden ist (`project.bitrix24.groupId`):
 * rein lesend, legt anders als `ensureBitrixGroupId` NICHTS neu an.
 * Schlägt der Bitrix24-Aufruf fehl (Netzwerk, Rechte, …), bleiben die
 * Aufgaben-Felder einfach `null`, statt das ganze Dashboard zu blockieren.
 */
export async function ermittleProjektStatus(project: Project): Promise<ProjektStatus> {
  const phaseInfo = PHASES.find((p) => p.code === project.aktuellePhase)!;
  const reifegrad = berechneReifegrad(project.bereichStatus);
  const bewertungRoh = durchschnittFuerPhase(
    checksProPersonFuerPhase(project.checkVerlauf, project.aktuellePhase),
    project.aktuellePhase
  );
  const bewertung = bewertungRoh
    ? {
        empfehlung: bewertungRoh.empfehlung,
        anzahlBewerter: bewertungRoh.anzahlBewerter,
        zuletztAm: bewertungRoh.zuletztAm,
      }
    : null;

  const aktivitaet = letzteAktivitaet(project);
  const tageSeitAktivitaet = tageSeit(aktivitaet);

  let offeneAufgaben: number | null = null;
  let aeltesteOffeneAufgabeTage: number | null = null;
  if (project.bitrix24.groupId) {
    try {
      const tasks = await listTasks({
        groupId: project.bitrix24.groupId,
        dealId: project.bitrix24.dealId || undefined,
      });
      const offene = tasks.filter((t) => !t.erledigt);
      offeneAufgaben = offene.length;
      const alterTage = offene
        .map((t) => (t.erstelltAm ? tageSeit(new Date(t.erstelltAm)) : null))
        .filter((n): n is number => n !== null);
      if (alterTage.length > 0) {
        aeltesteOffeneAufgabeTage = Math.max(...alterTage);
      }
    } catch {
      // best effort – siehe Doc-Kommentar oben
    }
  }

  const hemmtGruende: string[] = [];
  if (bewertung?.empfehlung === "STOPP") {
    hemmtGruende.push("Letzte Bewertung: STOPP");
  }
  if (tageSeitAktivitaet !== null && tageSeitAktivitaet >= TAGE_STILL) {
    hemmtGruende.push(`Seit ${tageSeitAktivitaet} Tagen keine Aktivität`);
  }
  if (
    offeneAufgaben !== null &&
    aeltesteOffeneAufgabeTage !== null &&
    aeltesteOffeneAufgabeTage >= TAGE_STILL
  ) {
    hemmtGruende.push(
      `${offeneAufgaben} offene Aufgabe${offeneAufgaben === 1 ? "" : "n"}, älteste seit ${aeltesteOffeneAufgabeTage} Tagen`
    );
  }

  let status: ProjektStatus["status"] = "ansteht";
  let gruende: string[] = [];

  if (hemmtGruende.length > 0) {
    status = "hemmt";
    gruende = hemmtGruende;
  } else {
    const vorangehtGruende: string[] = [];
    if (bewertung?.empfehlung === "GO") {
      vorangehtGruende.push("Zuletzt mit GO bewertet");
    }
    if (tageSeitAktivitaet !== null && tageSeitAktivitaet <= TAGE_AKTIV) {
      vorangehtGruende.push(
        tageSeitAktivitaet === 0
          ? "Heute aktiv"
          : `Vor ${tageSeitAktivitaet} Tag${tageSeitAktivitaet === 1 ? "" : "en"} zuletzt aktiv`
      );
    }
    if (vorangehtGruende.length > 0) {
      status = "vorangeht";
      gruende = vorangehtGruende;
    }
  }

  return {
    slug: project.slug,
    name: project.name,
    phase: {
      code: phaseInfo.code,
      name: phaseInfo.name,
      order: phaseInfo.order,
      ziel: phaseInfo.ziel,
    },
    reifegrad,
    bereichStatus: project.bereichStatus,
    bewertung,
    letzteAktivitaetAm: aktivitaet ? aktivitaet.toISOString() : null,
    tageSeitAktivitaet,
    letzteAktivitaeten: letzteAktivitaeten(project),
    offeneAufgaben,
    aeltesteOffeneAufgabeTage,
    status,
    gruende,
    zusammenfassung: project.zusammenfassung
      ? {
          erstelltAm: project.zusammenfassung.erstelltAm,
          erstelltVonName: project.zusammenfassung.erstelltVonName,
        }
      : null,
  };
}
