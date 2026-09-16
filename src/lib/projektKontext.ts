// Fasst alle bisherigen Informationen zu einem Projekt aus dem Project
// Builder in einem einzigen Freitext zusammen – wird beim Anlegen der
// Steuerboard-Kopie (siehe steuerboardFactory.ts) als "projectContext"
// mitgeschickt und dort dauerhaft in der Board-Config gespeichert (Snapshot
// zum Zeitpunkt der Kopie-Erstellung). Die "KI-Hilfe" je Aufgabenkarte im
// Steuerboard nutzt diesen Text als Hintergrundwissen, zusammen mit den
// übrigen Aufgaben im Board über alle Phasen hinweg.
//
// Bewusst nur ein einfacher Freitext statt strukturierter Felder: die KI auf
// der Steuerboard-Seite bekommt den Text ohnehin nur als Kontext in einen
// Prompt eingebettet (siehe lib/ai.js im Steuerboard-Repo), ein eigenes
// JSON-Schema wäre hier unnötiger Aufwand.
import { Project } from "./types";

function abschnitt(titel: string, inhalt: string | undefined | null): string {
  const text = (inhalt ?? "").trim();
  return text ? `${titel}:\n${text}` : "";
}

export function buildeProjektKontext(project: Project): string {
  const teile: string[] = [];

  teile.push(abschnitt("Projektbeschreibung", project.beschreibung));

  const ideen = (project.ideen ?? []).map((i) => `- ${i.text.trim()}`).join("\n");
  teile.push(abschnitt("Gesammelte Ideen", ideen));

  const fb = project.projektstartFragebogen;
  if (fb && fb.beantwortetAm) {
    const fbTeile: string[] = [];
    if (fb.zielsituation) fbTeile.push(`Zielsituation: ${fb.zielsituation.trim()}`);
    if (fb.umsatzziel) fbTeile.push(`Umsatzziel: ${fb.umsatzziel.trim()}`);
    if (fb.liquiditaet) fbTeile.push(`Liquiditätslage: ${fb.liquiditaet.trim()}`);
    if (fb.meilensteine) fbTeile.push(`Meilensteine:\n${fb.meilensteine.trim()}`);
    teile.push(abschnitt("Antworten aus dem Projektstart-Fragebogen", fbTeile.join("\n")));
  }

  const kompetenzen = (project.kompetenzbeitraege ?? [])
    .map((k) => {
      const beitrag = [
        k.kannBeitragen ? `kann beitragen: ${k.kannBeitragen.trim()}` : "",
        k.moechteBeitragen ? `möchte beitragen: ${k.moechteBeitragen.trim()}` : "",
      ].filter(Boolean).join(", ");
      return beitrag ? `- ${k.name}: ${beitrag}` : "";
    })
    .filter(Boolean)
    .join("\n");
  teile.push(abschnitt("Kompetenzbeiträge aus dem Team", kompetenzen));

  return teile.filter(Boolean).join("\n\n");
}
