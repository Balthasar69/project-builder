// Datenmodell für den Project Builder.
// Begriffe folgen bewusst dem Business- und Projektplan (Planungsstand 31.08.2026),
// damit App, Bitrix24-Pipeline und Dokumentation dieselbe Sprache sprechen.

export type PhaseCode =
  | "idee"
  | "check"
  | "kompetenzen"
  | "konzept"
  | "kerngruppe"
  | "freigabe"
  | "produkt"
  | "business"
  | "pilot"
  | "marketing"
  | "vertrieb"
  | "umsatz"
  | "optimierung"
  | "skalierung"
  | "parken";

export interface Phase {
  code: PhaseCode;
  order: number;
  name: string;
  ziel: string;
  /** Spiegelt Kapitel 6: ab wann eine Phase in Bitrix24 verbindlich geführt wird. */
  bitrix24: "nein" | "teilweise" | "übergang" | "ja";
}

export const PHASES: Phase[] = [
  { code: "idee", order: 1, name: "Idee", ziel: "Projektidee, Problem, Zielgruppe und Nutzen erfassen", bitrix24: "nein" },
  { code: "check", order: 2, name: "Check", ziel: "Markt, Bedarf, Differenzierung, Machbarkeit und Potenzial bewerten", bitrix24: "nein" },
  { code: "kompetenzen", order: 3, name: "Kompetenzen", ziel: "Benötigte und vorhandene Kompetenzen erfassen", bitrix24: "nein" },
  { code: "konzept", order: 4, name: "Konzept", ziel: "Lösung, Angebot, Geschäftsmodell und erste Struktur entwickeln", bitrix24: "nein" },
  { code: "kerngruppe", order: 5, name: "Kerngruppe", ziel: "Mitwirkende auswählen, Rollen und Commitment klären", bitrix24: "teilweise" },
  { code: "freigabe", order: 6, name: "Projektfreigabe", ziel: "GO/NO-GO und Übergang in operative Umsetzung", bitrix24: "übergang" },
  { code: "produkt", order: 7, name: "Produkt / Curriculum", ziel: "Verkaufbares Produkt bzw. Curriculum verbindlich entwickeln", bitrix24: "ja" },
  { code: "business", order: 8, name: "Business Case", ziel: "Preis, Kosten, Investition, Deckungsbeitrag und Break-even", bitrix24: "ja" },
  { code: "pilot", order: 9, name: "Pilot / MVP", ziel: "Kleinen realen Test mit definierten Erfolgskriterien durchführen", bitrix24: "ja" },
  { code: "marketing", order: 10, name: "Marketing", ziel: "Positionierung, Materialien, Kanäle und Kampagne vorbereiten", bitrix24: "ja" },
  { code: "vertrieb", order: 11, name: "Vertrieb", ziel: "Leads, Gespräche, Angebote und Abschlüsse steuern", bitrix24: "ja" },
  { code: "umsatz", order: 12, name: "Umsatz", ziel: "Ersten zahlenden Kunden und Umsetzung erreichen", bitrix24: "ja" },
  { code: "optimierung", order: 13, name: "Optimierung", ziel: "Ergebnisse auswerten und Produkt/Prozess verbessern", bitrix24: "ja" },
  { code: "skalierung", order: 14, name: "Skalierung", ziel: "Erfolgreiches Modell kontrolliert erweitern", bitrix24: "ja" },
  { code: "parken", order: 99, name: "Parken / Stopp", ziel: "Projekt bewusst pausieren oder beenden", bitrix24: "ja" },
];

// Normaler Phasenverlauf ohne "parken" – das ist ein bewusster Sonderfall
// (Projekt pausieren/beenden), keine reguläre Stufe im Ablauf.
const PHASENVERLAUF = PHASES.filter((p) => p.code !== "parken");

/** Nächste Phase im normalen Verlauf, oder null, wenn schon die letzte Stufe (oder "parken") erreicht ist. */
export function naechstePhase(aktuell: PhaseCode): PhaseCode | null {
  const idx = PHASENVERLAUF.findIndex((p) => p.code === aktuell);
  if (idx === -1 || idx === PHASENVERLAUF.length - 1) return null;
  return PHASENVERLAUF[idx + 1].code;
}

/** Feste Reifegrad-Bereiche mit Beispielgewichtung, Kapitel 9. */
export type ReifegradBereichCode =
  | "idee_markt"
  | "konzept"
  | "team"
  | "voraussetzungen"
  | "produkt"
  | "business_case"
  | "pilot"
  | "marketing"
  | "vertrieb";

export interface ReifegradBereich {
  code: ReifegradBereichCode;
  name: string;
  gewicht: number; // in Prozent, Summe = 100
}

export const REIFEGRAD_BEREICHE: ReifegradBereich[] = [
  { code: "idee_markt", name: "Idee & Markt", gewicht: 10 },
  { code: "konzept", name: "Konzept", gewicht: 10 },
  { code: "team", name: "Team", gewicht: 10 },
  { code: "voraussetzungen", name: "Voraussetzungen", gewicht: 15 },
  { code: "produkt", name: "Produkt", gewicht: 15 },
  { code: "business_case", name: "Business Case", gewicht: 10 },
  { code: "pilot", name: "Pilot", gewicht: 10 },
  { code: "marketing", name: "Marketing", gewicht: 10 },
  { code: "vertrieb", name: "Vertrieb", gewicht: 10 },
];

/** 0–100: wie vollständig ein Bereich bearbeitet ist ("Ampel"). */
export type BereichStatus = Record<ReifegradBereichCode, number>;

/**
 * Kriterien für den Projekt-Check / GO-NO-GO-Scoring, Kapitel 11.
 *
 * Jede Phase hat ihre eigenen Bewertungsthemen (statt überall dieselben 10
 * Fragen zu stellen) – die Fragen in "Idee" betreffen z. B. Problem und
 * Zielgruppe, während "Business Case" Preis, Kosten und Deckungsbeitrag
 * bewertet. Der Code ist deshalb kein festes Union-Type mehr, sondern ein
 * einfacher String, eindeutig innerhalb der jeweiligen Phase.
 */
export type CheckCriterionCode = string;

export interface CheckCriterion {
  code: CheckCriterionCode;
  frage: string;
  hilfe: string;
}

/** Bewertungsthemen je Phase, in der Reihenfolge des Formulars. */
export const CHECK_KRITERIEN_NACH_PHASE: Record<PhaseCode, CheckCriterion[]> = {
  idee: [
    { code: "problem_klar", frage: "Problem klar benannt", hilfe: "Ist das Problem, das gelöst werden soll, konkret beschrieben?" },
    { code: "zielgruppe_klar", frage: "Zielgruppe klar", hilfe: "Ist erkennbar, für wen genau das gedacht ist?" },
    { code: "nutzen_klar", frage: "Nutzen erkennbar", hilfe: "Ist der Nutzen für die Zielgruppe klar formuliert?" },
    { code: "idee_neuheit", frage: "Neuheit / Unterscheidung", hilfe: "Unterscheidet sich die Idee spürbar von Bestehendem?" },
    { code: "erste_evidenz", frage: "Erste Anhaltspunkte", hilfe: "Gibt es erste Hinweise (Gespräche, Beobachtungen), dass die Idee trägt?" },
  ],
  check: [
    { code: "marktpotenzial", frage: "Marktpotenzial und realer Bedarf", hilfe: "Gibt es ein echtes, ausreichend großes Problem am Markt?" },
    { code: "zielgruppe_zahler", frage: "Zielgruppe und Zahler", hilfe: "Ist klar, wer zahlt, und ist diese Gruppe erreichbar?" },
    { code: "differenzierung", frage: "Differenzierung / Wettbewerb", hilfe: "Warum sollte jemand das hier wählen statt einer Alternative?" },
    { code: "kompetenzen", frage: "Verfügbare Kompetenzen", hilfe: "Sind die nötigen Fähigkeiten im Kernteam oder Umfeld vorhanden?" },
    { code: "umsetzbarkeit", frage: "Umsetzbarkeit", hilfe: "Ist das Vorhaben mit realistischem Aufwand umsetzbar?" },
    { code: "investitionsbedarf", frage: "Investitionsbedarf", hilfe: "Steht der nötige Invest in vernünftigem Verhältnis zum Nutzen?" },
    { code: "geschwindigkeit", frage: "Geschwindigkeit bis zum Pilot", hilfe: "Wie schnell lässt sich ein erster echter Test aufsetzen?" },
    { code: "umsatzpotenzial", frage: "Umsatzpotenzial", hilfe: "Wie groß ist die realistische Umsatzchance?" },
    { code: "strategische_passung", frage: "Strategische Passung", hilfe: "Passt es zu den vorhandenen Stärken und Zielen?" },
    { code: "risiken", frage: "Risiken", hilfe: "Wie beherrschbar sind die erkennbaren Risiken?" },
  ],
  kompetenzen: [
    { code: "bedarf_klar", frage: "Kompetenzbedarf klar", hilfe: "Ist klar, welche Fähigkeiten für das Vorhaben nötig sind?" },
    { code: "abdeckung", frage: "Abdeckung im Kernteam", hilfe: "Sind die wichtigsten Kompetenzen im Kernteam vorhanden?" },
    { code: "luecken_erkannt", frage: "Lücken erkannt", hilfe: "Sind fehlende Kompetenzen konkret benannt?" },
    { code: "schliessung_plan", frage: "Plan zur Schließung", hilfe: "Gibt es einen Plan, fehlende Kompetenzen zu holen (Team, extern, Lernen)?" },
    { code: "kapazitaet", frage: "Zeitliche Kapazität", hilfe: "Haben die Beteiligten realistisch Zeit für das Vorhaben?" },
  ],
  konzept: [
    { code: "loesung_beschrieben", frage: "Lösung beschrieben", hilfe: "Ist die Lösung bzw. das Angebot konkret beschrieben?" },
    { code: "geschaeftsmodell", frage: "Geschäftsmodell", hilfe: "Ist klar, wie damit Geld verdient werden soll?" },
    { code: "struktur", frage: "Erste Struktur", hilfe: "Gibt es eine erste Struktur bzw. einen Ablauf für die Umsetzung?" },
    { code: "abgrenzung", frage: "Abgrenzung", hilfe: "Ist klar, was NICHT Teil des Angebots ist?" },
    { code: "annahmen_geprueft", frage: "Annahmen geprüft", hilfe: "Wurden zentrale Annahmen bereits irgendwie geprüft?" },
  ],
  kerngruppe: [
    { code: "rollen_klar", frage: "Rollen klar verteilt", hilfe: "Ist klar, wer welche Rolle im Projekt übernimmt?" },
    { code: "commitment", frage: "Commitment", hilfe: "Haben sich alle Mitwirkenden verbindlich committet?" },
    { code: "entscheidung_klar", frage: "Entscheidungswege klar", hilfe: "Ist klar, wer am Ende entscheidet?" },
    { code: "kapazitaet_team", frage: "Kapazität im Team", hilfe: "Reicht die verfügbare Zeit der Kerngruppe für die nächsten Schritte?" },
    { code: "konflikte", frage: "Konfliktpotenzial gering", hilfe: "Sind mögliche Spannungen offen angesprochen?" },
  ],
  freigabe: [
    { code: "check_aktuell", frage: "Check aktuell und positiv", hilfe: "Ist der Projekt-Check (Kapitel 11) aktuell und positiv?" },
    { code: "ressourcen_gesichert", frage: "Ressourcen gesichert", hilfe: "Sind Budget und Zeit für die Umsetzung gesichert?" },
    { code: "bitrix_bereit", frage: "Bitrix24 vorbereitet", hilfe: "Ist die Arbeitsgruppe bzw. Struktur in Bitrix24 vorbereitet?" },
    { code: "stakeholder_informiert", frage: "Stakeholder informiert", hilfe: "Sind relevante Personen über den Start informiert?" },
    { code: "startpunkt_klar", frage: "Startpunkt klar", hilfe: "Ist der erste konkrete Umsetzungsschritt definiert?" },
  ],
  produkt: [
    { code: "umfang_definiert", frage: "Umfang definiert", hilfe: "Ist der Produktumfang (MVP) klar abgegrenzt?" },
    { code: "qualitaet_kriterien", frage: "Qualitätskriterien", hilfe: "Ist klar, wann das Produkt „fertig genug“ ist?" },
    { code: "machbarkeit_bestaetigt", frage: "Machbarkeit bestätigt", hilfe: "Ist die technische bzw. inhaltliche Machbarkeit bestätigt?" },
    { code: "ressourcen_produkt", frage: "Ressourcen vorhanden", hilfe: "Stehen die nötigen Ressourcen zur Entwicklung bereit?" },
    { code: "zeitplan_realistisch", frage: "Zeitplan realistisch", hilfe: "Ist der Zeitplan bis zur Fertigstellung realistisch?" },
  ],
  business: [
    { code: "preis_kalkuliert", frage: "Preis kalkuliert", hilfe: "Ist ein tragfähiger Preis kalkuliert?" },
    { code: "kosten_erfasst", frage: "Kosten erfasst", hilfe: "Sind die wesentlichen Kosten vollständig erfasst?" },
    { code: "deckungsbeitrag", frage: "Deckungsbeitrag positiv", hilfe: "Ist der Deckungsbeitrag pro Einheit positiv?" },
    { code: "break_even", frage: "Break-even absehbar", hilfe: "Ist ein realistischer Break-even-Zeitpunkt erkennbar?" },
    { code: "investition_gesichert", frage: "Investition gesichert", hilfe: "Ist die nötige Anfangsinvestition gesichert?" },
  ],
  pilot: [
    { code: "erfolgskriterien", frage: "Erfolgskriterien definiert", hilfe: "Sind messbare Erfolgskriterien für den Pilot festgelegt?" },
    { code: "testgruppe", frage: "Testgruppe passend", hilfe: "Ist die Pilot-Zielgruppe realistisch und erreichbar?" },
    { code: "umfang_pilot", frage: "Umfang begrenzt", hilfe: "Ist der Pilot bewusst klein und risikoarm gehalten?" },
    { code: "feedback_prozess", frage: "Feedback-Prozess", hilfe: "Gibt es einen klaren Weg, Rückmeldungen einzusammeln?" },
    { code: "lernbereitschaft", frage: "Bereitschaft anzupassen", hilfe: "Ist das Team bereit, aus dem Pilot Konsequenzen zu ziehen?" },
  ],
  marketing: [
    { code: "positionierung", frage: "Positionierung klar", hilfe: "Ist die Positionierung gegenüber der Zielgruppe klar?" },
    { code: "materialien", frage: "Materialien vorhanden", hilfe: "Sind die wichtigsten Marketingmaterialien erstellt?" },
    { code: "kanaele", frage: "Kanäle festgelegt", hilfe: "Ist klar, über welche Kanäle die Zielgruppe erreicht wird?" },
    { code: "kampagne_geplant", frage: "Kampagne geplant", hilfe: "Gibt es einen konkreten Plan mit Zeitpunkten?" },
    { code: "budget_marketing", frage: "Budget vorhanden", hilfe: "Steht das nötige Budget für Marketing bereit?" },
  ],
  vertrieb: [
    { code: "lead_prozess", frage: "Lead-Prozess klar", hilfe: "Ist klar, wie neue Leads reinkommen und bearbeitet werden?" },
    { code: "gespraechsleitfaden", frage: "Gesprächsleitfaden", hilfe: "Gibt es einen Leitfaden für Verkaufsgespräche?" },
    { code: "angebotsprozess", frage: "Angebotsprozess", hilfe: "Ist der Weg von Anfrage zu Angebot definiert?" },
    { code: "pipeline_gepflegt", frage: "Pipeline gepflegt", hilfe: "Wird die Vertriebspipeline (z. B. in Bitrix24) aktiv gepflegt?" },
    { code: "abschlussquote", frage: "Abschlussquote plausibel", hilfe: "Ist eine realistische Abschlussquote absehbar?" },
  ],
  umsatz: [
    { code: "erster_kunde", frage: "Erster Kunde da", hilfe: "Gibt es mindestens einen zahlenden Kunden?" },
    { code: "lieferung_funktioniert", frage: "Lieferung funktioniert", hilfe: "Konnte das Produkt bzw. die Leistung erfolgreich geliefert werden?" },
    { code: "zahlung_eingegangen", frage: "Zahlung eingegangen", hilfe: "Ist die Zahlung tatsächlich eingegangen?" },
    { code: "kundenzufriedenheit", frage: "Kundenzufriedenheit", hilfe: "Ist der erste Kunde zufrieden (Feedback vorhanden)?" },
    { code: "wiederholbarkeit", frage: "Wiederholbarkeit erkennbar", hilfe: "Deutet sich an, dass sich das wiederholen lässt?" },
  ],
  optimierung: [
    { code: "daten_ausgewertet", frage: "Daten ausgewertet", hilfe: "Sind die bisherigen Ergebnisse bzw. Zahlen ausgewertet?" },
    { code: "schwachstellen", frage: "Schwachstellen benannt", hilfe: "Sind die größten Schwachstellen klar benannt?" },
    { code: "massnahmen", frage: "Maßnahmen definiert", hilfe: "Gibt es konkrete Verbesserungsmaßnahmen?" },
    { code: "prioritaeten", frage: "Prioritäten gesetzt", hilfe: "Ist klar, was zuerst angegangen wird?" },
    { code: "wirkung_messbar", frage: "Wirkung messbar", hilfe: "Lässt sich der Erfolg der Maßnahmen später messen?" },
  ],
  skalierung: [
    { code: "modell_stabil", frage: "Modell stabil", hilfe: "Läuft das Modell zuverlässig und wiederholbar?" },
    { code: "kapazitaet_skalierung", frage: "Kapazität für Wachstum", hilfe: "Sind Ressourcen für mehr Volumen vorhanden?" },
    { code: "prozesse_dokumentiert", frage: "Prozesse dokumentiert", hilfe: "Sind die Abläufe so dokumentiert, dass andere sie übernehmen können?" },
    { code: "risiken_skalierung", frage: "Risiken beim Wachstum", hilfe: "Sind Risiken einer schnellen Erweiterung bedacht?" },
    { code: "steuerung", frage: "Steuerung / Kennzahlen", hilfe: "Gibt es Kennzahlen, um das Wachstum zu steuern?" },
  ],
  parken: [
    { code: "grund_klar", frage: "Grund klar dokumentiert", hilfe: "Ist der Grund für Pause bzw. Ende klar festgehalten?" },
    { code: "wissen_gesichert", frage: "Wissen gesichert", hilfe: "Sind Erkenntnisse und Ergebnisse für später gesichert?" },
    { code: "reaktivierung", frage: "Reaktivierungskriterien", hilfe: "Ist klar, unter welchen Bedingungen es weitergehen könnte?" },
  ],
};

/** Bewertungsthemen für eine bestimmte Phase, in Formular-Reihenfolge. */
export function checkKriterienFuerPhase(phase: PhaseCode): CheckCriterion[] {
  return CHECK_KRITERIEN_NACH_PHASE[phase] ?? [];
}

/**
 * Rückwärtskompatibel: die ursprünglichen 10 Kriterien der Check-Phase.
 * @deprecated Bitte `checkKriterienFuerPhase(phase)` verwenden.
 */
export const CHECK_CRITERIA: CheckCriterion[] = CHECK_KRITERIEN_NACH_PHASE.check;

export type CheckAnswers = Partial<Record<CheckCriterionCode, number>>; // je 1–5

export interface CheckResult {
  answers: CheckAnswers;
  score: number; // Summe, 10–50
  empfehlung: "GO" | "WEITER PRÜFEN" | "STOPP";
  durchgefuehrtAm: string; // ISO-Datum
  notiz?: string;
  /**
   * Phase, für die dieser Check durchgeführt wurde. Jede Phase bekommt ihre
   * eigene Bewertung, statt eine einzelne über das ganze Projekt zu teilen –
   * so bleiben alte Bewertungen (z. B. aus "Idee") beim Phasenwechsel
   * erhalten, statt einfach stehen zu bleiben. Optional, damit sehr alte
   * Datensätze (vor dieser Funktion) nicht kaputtgehen.
   */
  phase?: PhaseCode;
  /**
   * Wer diese Bewertung abgegeben hat. Jedes Kernteam-Mitglied bewertet
   * unabhängig – die App zeigt pro Frage eine Bewertungsreihe je Person,
   * statt dass die letzte Abgabe die vorherige überschreibt. Optional,
   * damit alte Datensätze (vor dieser Funktion, eine einzelne geteilte
   * Bewertung pro Phase) nicht kaputtgehen.
   */
  bewerterEmail?: string;
  bewerterName?: string;
}

/** Der zuletzt gespeicherte Check für genau diese Phase, falls vorhanden. */
export function checkFuerPhase(
  checkVerlauf: CheckResult[],
  phase: PhaseCode
): CheckResult | undefined {
  for (let i = checkVerlauf.length - 1; i >= 0; i -= 1) {
    if (checkVerlauf[i].phase === phase) return checkVerlauf[i];
  }
  return undefined;
}

/**
 * Die jeweils letzte Bewertung jeder Person für eine Phase, neueste zuerst.
 * Grundlage für die einzelnen Bewertungsreihen im Projekt-Check.
 */
export function checksProPersonFuerPhase(
  checkVerlauf: CheckResult[],
  phase: PhaseCode
): CheckResult[] {
  const proPerson = new Map<string, CheckResult>();
  for (const c of checkVerlauf) {
    if (c.phase !== phase) continue;
    const key = c.bewerterEmail?.toLowerCase() ?? `_ohne_email_${c.durchgefuehrtAm}`;
    proPerson.set(key, c); // checkVerlauf ist chronologisch, spätere Einträge überschreiben frühere
  }
  return [...proPerson.values()].sort(
    (a, b) => new Date(b.durchgefuehrtAm).getTime() - new Date(a.durchgefuehrtAm).getTime()
  );
}

/** Die aktuelle Bewertung einer bestimmten Person für eine Phase (zum Vorausfüllen des eigenen Formulars). */
export function eigeneCheckFuerPhase(
  checkVerlauf: CheckResult[],
  phase: PhaseCode,
  email: string
): CheckResult | undefined {
  const normalized = email.toLowerCase();
  for (let i = checkVerlauf.length - 1; i >= 0; i -= 1) {
    const c = checkVerlauf[i];
    if (c.phase === phase && c.bewerterEmail?.toLowerCase() === normalized) return c;
  }
  return undefined;
}

export interface KernteamMitglied {
  name: string;
  rolle: string;
  bitrix24UserId?: number;
  /**
   * E-Mail-Adresse des zugehörigen App-Kontos (falls vorhanden). Darüber
   * wird erkannt, ob eine angemeldete Person zum Kernteam gehört und damit
   * z. B. den Phasenwechsel steuern darf – im Unterschied zu künftigen
   * Mitwirkenden, die zwar über `mitglieder` Zugriff aufs Projekt haben,
   * aber nicht zwingend im Kernteam stehen.
   */
  email?: string;
}

/** Die Cockpit-Blöcke, zu denen es eine (überschreibbare) Kurzanweisung gibt. */
export type BlockHinweisKey =
  | "reifegrad"
  | "phasenverlauf"
  | "kernteam"
  | "team"
  | "aufgaben"
  | "ideen"
  | "check";

/**
 * Feste Standardtexte je Block – werden angezeigt, solange ein Projekt
 * keinen eigenen Text hinterlegt hat (siehe `Project.hinweise`).
 */
export const STANDARD_HINWEISE: Record<BlockHinweisKey, string> = {
  reifegrad:
    "Auf einen Blick, wie weit jeder Bereich des Projekts ist. Der Wert wird automatisch aus dem Projekt-Check unten berechnet — hier müsst ihr nichts eintragen.",
  phasenverlauf:
    'Das Projekt durchläuft feste Phasen. Wenn die aktuelle Phase erledigt ist, schaltet das Kernteam mit „Weiter zu: …" eine Stufe weiter — nur Admins können eine Phase auch direkt setzen oder zurücksetzen.',
  kernteam:
    'Das Kernteam trifft die Entscheidungen zu diesem Projekt: nur Kernteam-Mitglieder und Admins dürfen die Phase wechseln und die Bewertung unten abgeben. Hinzufügen/Entfernen können nur Admins.',
  team:
    "Wer hier mit E-Mail-Adresse eingetragen ist, kann dieses Projekt in der App sehen und mitbearbeiten. Neue Personen bekommen automatisch eine Einladungs-E-Mail und brauchen ein eigenes Konto.",
  aufgaben:
    "Aufgaben aus Bitrix24. Zu jeder Aufgabe können Text- oder Sprachnotizen hinterlegt werden — Sprachnotizen werden automatisch in Text umgewandelt und als Kommentar in Bitrix24 gespeichert.",
  ideen:
    'Loses Sammelbecken für kurze Ideen, bevor sie eine richtige Aufgabe werden. Nur das Kernteam kann Ideen eintragen. Eine Idee bleibt zunächst nur hier in der App — erst wenn das Kernteam sie „in Bitrix24 übernimmt", wird daraus eine echte, synchronisierte Aufgabe.',
  check:
    "Nur Kernteam-Mitglieder und Admins bewerten hier ehrlich den aktuellen Stand der Phase — jede Person mit eigener Bewertungsreihe je Frage. Der gemeinsame Score ist der Durchschnitt aller Bewertungen; ab einem bestimmten Punktestand gibt es eine GO-Empfehlung, sonst WEITER oder STOPP.",
};

/**
 * Eine kurz notierte Idee (Kapitel 25, Ergänzung "Ideen"): bewusst loser als
 * eine Aufgabe – kein Titel-Zwang, keine Bitrix24-Synchronisierung, solange
 * sie nicht bewusst übernommen wurde. Nur das Kernteam legt Ideen an; die
 * verantwortliche Person beim Übernehmen nach Bitrix24 folgt derselben
 * Standardzuordnung wie beim regulären "Aufgabe hinzufügen" (kein eigener
 * Auswahlschritt).
 */
export interface Idee {
  id: string;
  text: string;
  erstelltVonName: string;
  erstelltVonEmail: string;
  erstelltAm: string; // ISO-Datum
  /** Gesetzt, sobald daraus eine echte Bitrix24-Aufgabe gemacht wurde. */
  uebernommenAlsTaskId?: string;
}

export interface Project {
  slug: string;
  name: string;
  rolleImSystem: string;
  /** Kurze, frei formulierte Beschreibung des Projekts für alle Teammitglieder. */
  beschreibung?: string;
  /** Individuelle Kurzanweisungen je Block, überschreiben `STANDARD_HINWEISE`. */
  hinweise?: Partial<Record<BlockHinweisKey, string>>;
  aktuellePhase: PhaseCode;
  kernteam: KernteamMitglied[];
  /** E-Mail-Adressen der Personen mit Zugriff auf dieses Projekt in der App. */
  mitglieder: string[];
  bereichStatus: BereichStatus;
  letzterCheck?: CheckResult;
  checkVerlauf: CheckResult[];
  /** Kurz notierte Ideen, bevor sie eine echte (mit Bitrix24 synchronisierte) Aufgabe werden. */
  ideen?: Idee[];
  /** Von Claude erstellte Hilfestellungen je Bitrix24-Aufgaben-ID (siehe `AufgabenAnalyse`). */
  aufgabenAnalysen?: Record<string, AufgabenAnalyse>;
  /** Laufender oder zuletzt abgeschlossener Projektstart-Fragebogen, siehe `ProjektstartFragebogen`. */
  projektstartFragebogen?: ProjektstartFragebogen;
  /** Von der KI aus dem Projektstart-Fragebogen abgeleitete, noch nicht durchgesehene Aufgaben-Vorschläge. */
  aufgabenVorschlaege?: AufgabenVorschlag[];
  /** Selbst eingetragene Beiträge zu "Kompetenzen", ein Eintrag je Person (siehe KompetenzBeitrag). */
  kompetenzbeitraege?: KompetenzBeitrag[];
  /** Interner Chat-Verlauf dieses Projekts, älteste Nachricht zuerst (siehe ChatNachricht). */
  chat?: ChatNachricht[];
  bitrix24: {
    dealId: number;
    categoryId: number;
    zuordnung: string;
    /** ID der Bitrix24-Arbeitsgruppe (sonet_group) für Aufgaben zu diesem Projekt, falls verbunden. */
    groupId?: number;
  };
  aktualisiertAm: string;
}

/**
 * Eine selbst benannte Kanban-Spalte aus Bitrix24 (z. B. "Neu", "In Arbeit"),
 * so wie sie in der jeweiligen Bitrix24-Arbeitsgruppe konfiguriert ist –
 * inklusive der dort hinterlegten Farbe und Reihenfolge (Kapitel 25,
 * "Bitrix24-Statusanzeige").
 */
export interface Bitrix24TaskStage {
  id: string;
  title: string;
  color?: string;
  sort: number;
}

/** Eine Bitrix24-Aufgabe, wie sie im Projektcockpit angezeigt wird (Kapitel 25). */
export interface Bitrix24Task {
  id: string;
  title: string;
  status: string;
  erledigt: boolean;
  responsibleId?: string;
  /**
   * Die echte, selbst benannte Kanban-Spalte aus Bitrix24, falls diese
   * Arbeitsgruppe eigene Spalten verwendet (Regelfall) – fehlt dieses Feld,
   * zeigt die App ersatzweise den alten, technischen Status (siehe
   * `status`) an.
   */
  stage?: Bitrix24TaskStage;
}

/**
 * Text- oder Sprachnotiz zu einer einzelnen Bitrix24-Aufgabe. Wird in der
 * eigenen App-Datenbank gespeichert (Tabelle "task_notes", inkl. der
 * Audiodatei selbst) UND zusätzlich als Kommentar bei der zugehörigen
 * Bitrix24-Aufgabe gepostet (siehe `postTaskNoteAsBitrixComment` in
 * `src/lib/bitrix24.ts`) – so bleibt die Audioaufnahme in der App
 * verfügbar, während Team-Mitglieder, die nur in Bitrix24 arbeiten, den
 * (vertexteten) Inhalt trotzdem dort sehen.
 */
export interface TaskNote {
  id: string;
  taskId: string;
  authorName: string;
  authorEmail: string;
  text?: string;
  /** Sprachaufnahme als data:-URL (Base64), falls vorhanden. */
  audioDataUrl?: string;
  /**
   * Automatische Vertextung der Sprachaufnahme (OpenAI Whisper), falls
   * `OPENAI_API_KEY` gesetzt ist und die Vertextung erfolgreich war.
   */
  transcript?: string;
  erstelltAm: string;
}

/**
 * Automatisch von Claude (Anthropic-API) erstellte Hilfestellung zu einer
 * einzelnen Bitrix24-Aufgabe: wie sie sich einfacher erledigen lässt und
 * wofür sie im Zusammenhang mit der aktuellen Projektphase gerade nützlich
 * ist. Wird im Projekt selbst gespeichert (siehe `Project.aufgabenAnalysen`,
 * ein Schlüssel je Bitrix24-Aufgaben-ID) — ein erneuter Klick auf „Mit KI
 * bearbeiten" ersetzt eine vorhandene Einschätzung durch eine neue.
 */
export interface AufgabenAnalyse {
  text: string;
  erstelltAm: string; // ISO-Datum
}

/** Ob ein Projekt geschäftlich oder privat/persönlich ist – entscheidet über
 * die Fragen und den Schwerpunkt des Projektstart-Fragebogens (siehe unten). */
export type ProjektArt = "geschaeft" | "privat";

/**
 * Vom Admin gestarteter Fragebogen zum Projektstart ("Aufgaben von der KI
 * vorschlagen lassen"): legt fest, wer antwortet (`projektleiterEmail`,
 * kann der Admin selbst sein) und hält die Antworten fest, sobald sie
 * eingegangen sind. Erst nach dem Beantworten generiert die KI daraus
 * Aufgaben-Vorschläge (siehe `Project.aufgabenVorschlaege`).
 */
export interface ProjektstartFragebogen {
  projektleiterEmail: string;
  projektleiterName: string;
  gestartetAm: string; // ISO-Datum
  projektArt?: ProjektArt;
  zielsituation?: string;
  /** Nur bei "geschaeft": Umsatzziel als Freitext. */
  umsatzziel?: string;
  /** Nur bei "geschaeft": aktuelle/geplante Liquiditätslage als Freitext. */
  liquiditaet?: string;
  /** Meilensteine als Freitext, ein Meilenstein pro Zeile. */
  meilensteine?: string;
  beantwortetAm?: string; // ISO-Datum
  /** Gesetzt, falls die KI-Generierung nach dem Beantworten fehlgeschlagen ist. */
  fehler?: string;
}

/**
 * Ein von der KI aus dem Projektstart-Fragebogen abgeleiteter Aufgaben-
 * Vorschlag – wartet auf Durchsicht durchs Kernteam, bevor daraus (wie bei
 * `Idee`) eine echte Bitrix24-Aufgabe wird. Bewusst kein automatisches
 * Übernehmen, da KI-Vorschläge nicht immer treffsicher sind.
 */
export interface AufgabenVorschlag {
  id: string;
  titel: string;
  uebernommenAlsTaskId?: string;
  verworfen?: boolean;
}

/**
 * Selbst eingetragener Beitrag einer Person zu "Kompetenzen" (neuer
 * Cockpit-Bereich seit v0.46, nicht zu verwechseln mit der Projektphase
 * "kompetenzen" oben): was sie zum Projekt beitragen kann bzw. beitragen
 * möchte, in eigenen Worten. Jede Person (Kernteam oder Team) trägt nur
 * ihren eigenen Eintrag ein – kein Bewertungs- oder Freigabeprozess, reine
 * Selbstauskunft, sichtbar für alle mit Projektzugriff.
 */
export interface KompetenzBeitrag {
  email: string;
  name: string;
  kannBeitragen: string;
  moechteBeitragen: string;
  aktualisiertAm: string; // ISO-Datum
}

/**
 * Eine einzelne Nachricht im internen Projekt-Chat (neuer Cockpit-Bereich
 * seit v0.46) – nur für Kernteam & Team dieses Projekts sichtbar. Bewusst
 * einfach gehalten: keine Threads, kein Bearbeiten/Löschen im ersten
 * Schritt, nur ein fortlaufendes Protokoll je Projekt.
 */
export interface ChatNachricht {
  id: string;
  autorEmail: string;
  autorName: string;
  text: string;
  erstelltAm: string; // ISO-Datum
}

/** Ein registrierter Zugang (echtes Konto pro Person, statt gemeinsamem Passwort). */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  /** Admins sehen und verwalten alle Projekte, unabhängig von mitglieder. */
  isAdmin: boolean;
  createdAt: string;
}
