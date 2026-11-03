import { PHASES, Project } from "./types";

/** Eine Zeile in der angezeigten Chronik (gespeicherte + aus dem Projekt abgeleitete Ereignisse). */
export interface ChronikZeile {
  /** Gesetzt nur bei gespeicherten Einträgen – nur diese lassen sich löschen. */
  id?: string;
  datum: string; // JJJJ-MM-TT
  text: string;
  wer?: string;
  erstelltVonEmail?: string;
  /** "manuell" = von einer Person eingetragen, sonst von der App erkannt. */
  art: "manuell" | "automatisch";
  sortierZeit: string;
}

function tag(iso?: string): string {
  return (iso ?? "").slice(0, 10);
}

function phasenName(code?: string): string {
  return PHASES.find((p) => p.code === code)?.name ?? code ?? "";
}

/**
 * Baut die Zeitleiste eines Projekts, neueste zuerst. Neben den gespeicherten
 * Chronik-Einträgen werden Ereignisse ergänzt, die ohnehin schon mit Datum im
 * Projekt stehen (Bewertungen, Ideen, Fragebogen, Businessplan, Steuerboard) –
 * so ist die Chronik auch für bestehende Projekte sofort gefüllt.
 */
export function baueChronik(project: Project): ChronikZeile[] {
  const zeilen: ChronikZeile[] = [];

  for (const e of project.chronik ?? []) {
    zeilen.push({
      id: e.id,
      datum: e.datum,
      text: e.text,
      wer: e.automatisch ? undefined : e.erstelltVonName,
      erstelltVonEmail: e.erstelltVonEmail,
      art: e.automatisch ? "automatisch" : "manuell",
      sortierZeit: e.erstelltAm,
    });
  }

  for (const c of project.checkVerlauf ?? []) {
    if (!c.durchgefuehrtAm) continue;
    zeilen.push({
      datum: tag(c.durchgefuehrtAm),
      text: `Bewertung${c.phase ? ` Phase „${phasenName(c.phase)}"` : ""}: Score ${c.score} – ${c.empfehlung}`,
      wer: c.bewerterName,
      art: "automatisch",
      sortierZeit: c.durchgefuehrtAm,
    });
  }

  for (const i of project.ideen ?? []) {
    zeilen.push({
      datum: tag(i.erstelltAm),
      text: `Neue Idee: ${i.text.length > 120 ? i.text.slice(0, 117) + "…" : i.text}`,
      wer: i.erstelltVonName,
      art: "automatisch",
      sortierZeit: i.erstelltAm,
    });
  }

  const fb = project.projektstartFragebogen;
  if (fb?.beantwortetAm) {
    zeilen.push({
      datum: tag(fb.beantwortetAm),
      text: "Projektstart-Fragebogen ausgefüllt",
      art: "automatisch",
      sortierZeit: fb.beantwortetAm,
    });
  }

  const bp = project.zusammenfassung;
  if (bp?.erstelltAm) {
    zeilen.push({
      datum: tag(bp.erstelltAm),
      text: "Businessplan (zuletzt) neu erstellt",
      wer: bp.erstelltVonName,
      art: "automatisch",
      sortierZeit: bp.erstelltAm,
    });
  }

  const sb = project.steuerboard;
  if (sb?.erstelltAm) {
    zeilen.push({
      datum: tag(sb.erstelltAm),
      text: "Eigenes Steuerboard angelegt",
      wer: sb.erstelltVonName,
      art: "automatisch",
      sortierZeit: sb.erstelltAm,
    });
  }

  return zeilen
    .filter((z) => /^\d{4}-\d{2}-\d{2}$/.test(z.datum))
    .sort((a, b) =>
      a.datum === b.datum
        ? b.sortierZeit.localeCompare(a.sortierZeit)
        : b.datum.localeCompare(a.datum)
    );
}
