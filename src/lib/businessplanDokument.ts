// Zerlegt den von der KI geschriebenen Businessplan-Text (siehe
// projektZusammenfassung.ts) in Kapitel fuer die formatierte Vorzeigefassung
// (Seite /projects/[slug]/businessplan). Der gespeicherte Text bleibt
// unveraendert im bisherigen Format ("## Ueberschrift" + Absaetze + Listen),
// damit auch das Steuerboard ihn weiter anzeigen kann - nur die Darstellung
// wird hier aufbereitet: Nummerierung, Inhaltsverzeichnis, Listenpunkte.

export type BpBlock =
  | { typ: "absatz"; text: string }
  | { typ: "liste"; punkte: string[] };

export interface BpKapitel {
  nr: number;
  titel: string;
  bloecke: BpBlock[];
}

/** Entfernt eine evtl. von der KI mitgeschriebene Nummer ("3. Team" -> "Team"). */
function titelBereinigen(roh: string): string {
  return roh
    .replace(/^#+\s*/, "")
    .replace(/^\d+\s*[.)]\s*/, "")
    .replace(/^["„“]|["“”]$/g, "")
    .trim();
}

export function zerlegeBusinessplan(text: string): BpKapitel[] {
  const kapitel: BpKapitel[] = [];
  let aktuell: BpKapitel | null = null;
  let absatz: string[] = [];
  let liste: string[] = [];

  function absatzAbschliessen() {
    const inhalt = absatz.join(" ").replace(/\s+/g, " ").trim();
    if (inhalt && aktuell) aktuell.bloecke.push({ typ: "absatz", text: inhalt });
    absatz = [];
  }
  function listeAbschliessen() {
    if (liste.length && aktuell) aktuell.bloecke.push({ typ: "liste", punkte: liste });
    liste = [];
  }

  for (const zeile of text.split("\n")) {
    const t = zeile.trim();
    if (t.startsWith("## ")) {
      absatzAbschliessen();
      listeAbschliessen();
      aktuell = { nr: kapitel.length + 1, titel: titelBereinigen(t), bloecke: [] };
      kapitel.push(aktuell);
    } else if (t === "") {
      absatzAbschliessen();
      listeAbschliessen();
    } else if (/^[-•*]\s+/.test(t)) {
      absatzAbschliessen();
      liste.push(t.replace(/^[-•*]\s+/, ""));
    } else {
      listeAbschliessen();
      absatz.push(t);
    }
  }
  absatzAbschliessen();
  listeAbschliessen();

  return kapitel;
}

export function istTeamKapitel(titel: string): boolean {
  return /team/i.test(titel);
}

export function istFinanzKapitel(titel: string): boolean {
  return /finanz/i.test(titel);
}
