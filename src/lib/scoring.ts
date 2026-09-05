import {
  CheckAnswers,
  CheckResult,
  PhaseCode,
  REIFEGRAD_BEREICHE,
  BereichStatus,
  checkKriterienFuerPhase,
} from "./types";

/**
 * Gewichteter Reifegrad über alle Bereiche, 0–100.
 * Kapitel 9: "Ergebnis wird als Reifegrad (0–100 %) ... dargestellt."
 */
export function berechneReifegrad(status: BereichStatus): number {
  const gesamtgewicht = REIFEGRAD_BEREICHE.reduce((s, b) => s + b.gewicht, 0);
  const summe = REIFEGRAD_BEREICHE.reduce(
    (s, b) => s + (status[b.code] ?? 0) * b.gewicht,
    0
  );
  return Math.round(summe / gesamtgewicht);
}

/** Ampel-Farbe für einen einzelnen Bereich, je nach Bearbeitungsstand. */
export function ampelFuerBereich(wert: number): "rot" | "gelb" | "gruen" {
  if (wert >= 75) return "gruen";
  if (wert >= 35) return "gelb";
  return "rot";
}

/**
 * Punktespanne des Checks einer Phase – jede Phase hat ihre eigenen
 * Bewertungsthemen und damit eine eigene Anzahl an Fragen, deshalb ist die
 * Spanne (anders als früher) je Phase unterschiedlich groß.
 */
export function checkScoreRange(phase: PhaseCode): { min: number; max: number } {
  const anzahl = checkKriterienFuerPhase(phase).length;
  return { min: anzahl * 1, max: anzahl * 5 };
}

function empfehlungFuerScore(
  score: number,
  max: number
): CheckResult["empfehlung"] {
  if (score >= 0.8 * max) return "GO";
  if (score >= 0.5 * max) return "WEITER PRÜFEN";
  return "STOPP";
}

/**
 * Summiert die 1–5-Bewertungen EINER Person aus dem Projekt-Check zu einem
 * Score und leitet eine Empfehlung ab. Kapitel 11: "Scoring ist ein
 * Entscheidungsinstrument und keine automatische Freigabe." Jedes
 * Kernteam-Mitglied bewertet unabhängig (eigene Bewertungsreihe je Frage).
 */
export function werteCheckAus(
  answers: CheckAnswers,
  phase: PhaseCode,
  bewerter: { email: string; name: string },
  notiz?: string
): CheckResult {
  const kriterien = checkKriterienFuerPhase(phase);
  const score = kriterien.reduce((s, c) => s + (answers[c.code] ?? 0), 0);
  const { max } = checkScoreRange(phase);

  return {
    answers,
    score,
    empfehlung: empfehlungFuerScore(score, max),
    durchgefuehrtAm: new Date().toISOString(),
    notiz,
    phase,
    bewerterEmail: bewerter.email,
    bewerterName: bewerter.name,
  };
}

export interface DurchschnittsCheck {
  /** Mittelwert je Frage aufsummiert, gerundet auf eine Nachkommastelle. */
  score: number;
  empfehlung: CheckResult["empfehlung"];
  /** Wie viele Personen mindestens eine Frage dieser Phase beantwortet haben. */
  anzahlBewerter: number;
  zuletztAm: string;
}

/**
 * Gemeinsame Empfehlung aus mehreren individuellen Kernteam-Bewertungen
 * derselben Phase: pro Frage wird der Mittelwert der abgegebenen Werte
 * gebildet, daraus ein gemeinsamer Score und eine gemeinsame Empfehlung.
 * `checks` sollte bereits je Person nur die jeweils letzte Bewertung
 * enthalten (siehe `checksProPersonFuerPhase`).
 */
export function durchschnittFuerPhase(
  checks: CheckResult[],
  phase: PhaseCode
): DurchschnittsCheck | null {
  if (checks.length === 0) return null;

  const kriterien = checkKriterienFuerPhase(phase);
  const { max } = checkScoreRange(phase);

  let summe = 0;
  for (const c of kriterien) {
    const werte = checks
      .map((chk) => chk.answers[c.code])
      .filter((w): w is number => typeof w === "number");
    if (werte.length === 0) continue;
    summe += werte.reduce((s, w) => s + w, 0) / werte.length;
  }
  const score = Math.round(summe * 10) / 10;

  const zuletztAm = checks
    .map((c) => c.durchgefuehrtAm)
    .sort()
    .slice(-1)[0];

  return {
    score,
    empfehlung: empfehlungFuerScore(score, max),
    anzahlBewerter: checks.length,
    zuletztAm,
  };
}
