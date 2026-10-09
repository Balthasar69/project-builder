// "Businessplan" (vormals "Projekt-Zusammenfassung", siehe Git-Historie):
// fuehrt den GESAMTEN bisherigen Verlauf eines Projekts - Bewertungen, Chat,
// Ideen, Kompetenz-Beitraege und Bitrix24-Aufgaben samt ihren Notizen - zu
// einem von der KI geschriebenen Businessplan mit klassischer Gliederung
// zusammen (Executive Summary, Geschaeftsidee, Projektteam, Markt & Wettbewerb,
// Marketing & Vertrieb, Umsetzung & Meilensteine, Chancen & Risiken, Finanzplanung
// als bewusster Platzhalter - dafuer werden aktuell keine Zahlen erfasst -,
// zuletzt die offenen Aufgaben). Siehe ProjektZusammenfassung.tsx fuer die
// Anzeige; Variablen-/Routen-/Feldnamen heissen bewusst weiter "Zusammen-
// fassung" (u.a. weil das Steuerboard-Oekosystem in einem anderen Repo
// darauf verlinkt, siehe PROJEKT_ZUSAMMENFASSUNG_URL) - nur die fuer
// Nutzer sichtbaren Texte wurden auf "Businessplan" umbenannt.
//
// Nutzt denselben Zwei-Anbieter-Mechanismus wie "Mit KI bearbeiten" fuer
// einzelne Aufgaben (siehe aufgabenAnalyse.ts): Groq (GROQ_API_KEY,
// kostenlose Stufe) hat Vorrang, Claude/Anthropic (ANTHROPIC_API_KEY,
// kostenpflichtig) ist die Ersatzloesung. Wegen der gewuenschten Laenge
// braucht dieser Aufruf ein deutlich groesseres Token-Budget als die kurze
// Aufgaben-Hilfestellung.

export class ZusammenfassungError extends Error {}

const GROQ_MODELLE = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];
const ANTHROPIC_MODELL = "claude-haiku-4-5-20251001";

// Grosszuegige Obergrenzen je Datenquelle: verhindern in seltenen Faellen
// (sehr altes/aktives Projekt) einen zu grossen Prompt, ohne im ueblichen
// Alltagsbetrieb je zu greifen.
const MAX_EINTRAEGE = 250;

export interface ZusammenfassungBewertung {
  phaseName?: string;
  score: number;
  empfehlung: string;
  notiz?: string;
  bewerterName?: string;
  durchgefuehrtAm: string;
}

export interface ZusammenfassungChatNachricht {
  autorName: string;
  text: string;
  erstelltAm: string;
}

export interface ZusammenfassungIdee {
  erstelltVonName: string;
  text: string;
  erstelltAm: string;
  uebernommen: boolean;
}

export interface ZusammenfassungKompetenz {
  name: string;
  kannBeitragen: string;
  moechteBeitragen: string;
  aktualisiertAm: string;
}

export interface ZusammenfassungAufgabenNotiz {
  autorName: string;
  text: string;
  erstelltAm: string;
}

export interface ZusammenfassungAufgabe {
  titel: string;
  status: string;
  erledigt: boolean;
  erstelltAm?: string;
  notizen: ZusammenfassungAufgabenNotiz[];
  /** Name des zustaendigen Kernteam-Mitglieds (ueber Bitrix24-responsibleId
   *  aufgeloest, siehe zusammenfassung/route.ts) - fehlt, wenn sich die
   *  Bitrix24-responsibleId keinem Kernteam-Mitglied zuordnen liess. Nur
   *  fuer offene Aufgaben in der Ausarbeitung relevant (siehe buildPrompt). */
  inhaber?: string;
}

export interface ZusammenfassungParams {
  projektName: string;
  projektBeschreibung?: string;
  phaseName: string;
  phaseZiel: string;
  bewertungen: ZusammenfassungBewertung[];
  chat: ZusammenfassungChatNachricht[];
  ideen: ZusammenfassungIdee[];
  kompetenzen: ZusammenfassungKompetenz[];
  aufgaben: ZusammenfassungAufgabe[];
}

function formatDatum(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Kappt eine Liste auf `MAX_EINTRAEGE`, aelteste zuerst behalten (fuer den
 *  chronologischen Verlauf relevanter als die allerneuesten), mit Hinweis. */
function kappen<T>(liste: T[]): { eintraege: T[]; hinweis: string } {
  if (liste.length <= MAX_EINTRAEGE) return { eintraege: liste, hinweis: "" };
  const abgeschnitten = liste.length - MAX_EINTRAEGE;
  return {
    eintraege: liste.slice(0, MAX_EINTRAEGE),
    hinweis: `\n(… und ${abgeschnitten} weitere, aus Platzgründen hier nicht einzeln aufgeführt)`,
  };
}

function buildPrompt(params: ZusammenfassungParams): string {
  const bewertungen = kappen(params.bewertungen);
  const chat = kappen(params.chat);
  const ideen = kappen(params.ideen);
  const kompetenzen = kappen(params.kompetenzen);
  const aufgaben = kappen(params.aufgaben);

  const bewertungenText = bewertungen.eintraege.length
    ? bewertungen.eintraege
        .map(
          (b) =>
            `- ${formatDatum(b.durchgefuehrtAm)} · ${b.phaseName ?? "?"} · Ergebnis: ${b.empfehlung} (Score ${b.score}) · von ${b.bewerterName ?? "unbekannt"}${b.notiz ? ` · Notiz: "${b.notiz}"` : ""}`
        )
        .join("\n") + bewertungen.hinweis
    : "(keine Bewertungen bisher)";

  const chatText = chat.eintraege.length
    ? chat.eintraege
        .map((c) => `- ${formatDatum(c.erstelltAm)} · ${c.autorName}: ${c.text}`)
        .join("\n") + chat.hinweis
    : "(kein Chat-Verlauf bisher)";

  const ideenText = ideen.eintraege.length
    ? ideen.eintraege
        .map(
          (i) =>
            `- ${formatDatum(i.erstelltAm)} · ${i.erstelltVonName}: ${i.text}${i.uebernommen ? " (inzwischen als Aufgabe übernommen)" : ""}`
        )
        .join("\n") + ideen.hinweis
    : "(keine Ideen bisher eingetragen)";

  const kompetenzenText = kompetenzen.eintraege.length
    ? kompetenzen.eintraege
        .map(
          (k) =>
            `- ${k.name} (Stand ${formatDatum(k.aktualisiertAm)}): kann beitragen: "${k.kannBeitragen}" · möchte beitragen: "${k.moechteBeitragen}"`
        )
        .join("\n") + kompetenzen.hinweis
    : "(keine Kompetenz-Einträge bisher)";

  // Zwei getrennte Aufgaben-Quellen fuer die zwei Teile der Ausarbeitung
  // (v0.9x): erledigte Aufgaben MIT Notizen fliessen als Erzaehlstoff in
  // den Fliesstext von Teil 1 ein (siehe Anweisung unten) - NICHT als
  // eigene Liste. Offene Aufgaben bleiben bewusst eine kurze, notizfreie
  // Liste (nur Aufgabe + Zustaendigkeit) fuer Teil 2, nach dem Feedback
  // "unuebersichtlich" bei einer vollstaendigen Aufgabendarstellung.
  const erledigteAufgaben = aufgaben.eintraege.filter((a) => a.erledigt);
  const offeneAufgaben = aufgaben.eintraege.filter((a) => !a.erledigt);

  const erledigteAufgabenText = erledigteAufgaben.length
    ? erledigteAufgaben
        .map((a) => {
          const notizenText = a.notizen.length
            ? a.notizen
                .map((n) => `    · ${formatDatum(n.erstelltAm)} ${n.autorName}: ${n.text}`)
                .join("\n")
            : "    (keine Notizen zu dieser Aufgabe)";
          return `- "${a.titel}"\n${notizenText}`;
        })
        .join("\n") + aufgaben.hinweis
    : "(keine erledigten Aufgaben bisher)";

  const offeneAufgabenText = offeneAufgaben.length
    ? offeneAufgaben
        .map(
          (a) =>
            `- "${a.titel}" (${a.status}) – zuständig: ${a.inhaber || "noch niemandem zugeordnet"}`
        )
        .join("\n")
    : "(keine offenen Aufgaben)";

  return `Du unterstützt ein kleines Projektteam dabei, aus dem bisherigen Projektverlauf einen echten BUSINESSPLAN mit klassischer Gliederung zu erstellen – kein loser Verlaufsbericht, sondern ein Dokument, das jemand (z. B. eine Bank, ein Partner oder das Team selbst) lesen kann, um Geschäftsidee, Markt, Team und nächste Schritte zu verstehen. Ruhig ausführlich (1200–1800 Wörter insgesamt).

Projekt: "${params.projektName}"
Beschreibung: ${params.projektBeschreibung?.trim() || "(keine hinterlegt)"}
Aktuelle Phase: "${params.phaseName}" – Ziel dieser Phase: ${params.phaseZiel}

=== Bewertungen (Checks) im Verlauf, älteste zuerst ===
${bewertungenText}

=== Chat-Verlauf, älteste Nachricht zuerst ===
${chatText}

=== Ideen ===
${ideenText}

=== Kompetenz-Einträge im Team ===
${kompetenzenText}

=== Bereits erledigte Aufgaben mit ihren Notizen ===
${erledigteAufgabenText}

=== Offene Aufgaben mit ihrem Aufgabeninhaber ===
${offeneAufgabenText}

Gliedere den Businessplan auf Deutsch in GENAU diese Abschnitte, jeweils mit eigener Zwischenüberschrift im Format "## Überschrift" auf eigener Zeile (OHNE vorangestellte Nummer, die Nummerierung ergänzt die Anzeige selbst), in dieser Reihenfolge – das ist die klassische Gliederung eines Businessplans für Banken, Förderstellen und Partner:

1. "## Executive Summary" – ein kurzer, dichter Überblick (1 Absatz): worum es geht, wo das Projekt gerade steht, wohin es soll.
2. "## Geschäftsidee & Angebot" – was genau angeboten wird und welchen Nutzen es für wen stiftet, basierend auf Beschreibung, Ideen und Chat.
3. "## Projektteam & Organisation" – wer ist beteiligt, mit welchen Stärken, Rollen und welchem Beitrag (aus den Kompetenz-Einträgen und dem Verlauf). Eine Namens-/Rollentabelle ergänzt die Anzeige selbst, du musst sie nicht nachbauen.
4. "## Markt & Wettbewerb" – was sich aus den Quellen zu Zielgruppe, Marktumfeld und Wettbewerb ablesen lässt. Ist dazu kaum etwas hinterlegt, schreibe das ehrlich (z. B. "Eine systematische Markt- und Wettbewerbsanalyse liegt bisher nicht vor.") statt etwas zu erfinden.
5. "## Marketing & Vertrieb" – was aus Ideen/Chat zu Vertriebsweg, Ansprache oder Preismodell hervorgeht; fehlt das, ehrlich vermerken statt zu erfinden.
6. "## Umsetzung & Meilensteine" – FLIESSTEXT (ganze Sätze, keine Aufzählung) über die wichtigsten Entwicklungen aus Chat, Ideen und Bewertungen sowie die bereits ERLEDIGTEN Aufgaben: erzähle, was gemacht wurde und was dabei herauskam, statt es aufzuzählen.
7. "## Chancen & Risiken" – aus den Quellen erkennbare Chancen und Risiken/Bremsen, sachlich und konkret statt allgemein.
8. "## Finanzplanung" – dieser Abschnitt bleibt bewusst ein PLATZHALTER: schreibe deutlich, dass dazu (Kapitalbedarf, Umsatz- und Kostenplanung, Rentabilitäts- und Liquiditätsvorschau) noch keine Zahlen in der App erfasst sind und vom Team nachgetragen werden müssen. ERFINDE UNTER KEINEN UMSTÄNDEN Beträge, Prozentzahlen oder Zeiträume.
9. "## Nächste Schritte" – ausschließlich eine kurze, klare Liste der noch offenen bzw. als Nächstes anstehenden Aufgaben, pro Zeile nur die Aufgabe und ihre Zuständigkeit, sonst nichts, z. B. "- „Titel" – zuständig: Name". Ist niemand zugeordnet, übernimm das wörtlich so ("noch niemandem zugeordnet"). Erledigte Aufgaben tauchen hier nicht auf.

Schreibe sachlich und vorzeigbar in der dritten Person, wie in einem Dokument, das ein Außenstehender liest (keine Chat-Sprache, keine Zeitstempel, keine Anrede).

Innerhalb jedes Abschnitts (außer Abschnitt 9) nur FLIESSTEXT in 1–3 kurzen Absätzen, KEINE Aufzählungen. Nutze konkrete Namen, Daten und sinngemäße Zitate aus den obigen Quellen statt allgemeiner Floskeln. Liegt zu einem Abschnitt nichts vor, schreibe das kurz und ehrlich statt etwas zu erfinden. Beginne direkt mit "## Executive Summary" (keine Einleitung davor, kein Satz wie "Hier ist der Businessplan"). Verwende AUSSCHLIESSLICH "## " für Überschriften, keine anderen Markdown-Elemente wie Tabellen, "#", "###" oder nummerierte Überschriften – die Anzeige unterstützt nur "## " als Zwischenüberschrift und Text in Absätzen.`;
}

async function frageGroq(apiKey: string, modell: string, prompt: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modell,
        // Deutlich groesseres Budget als bei der kurzen Aufgaben-
        // Hilfestellung (dort 900): eine 900-1500 Woerter lange Ausarbeitung
        // braucht mehr Platz, plus Puffer fuers interne "Nachdenken" der
        // Reasoning-Modelle.
        max_completion_tokens: 8000,
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new ZusammenfassungError("Groq war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        error?: { message?: string };
      }
    | null;

  if (!res.ok || !body) {
    throw new ZusammenfassungError(body?.error?.message || `HTTP ${res.status}`);
  }

  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const abgeschnitten = body.choices?.[0]?.finish_reason === "length";
    throw new ZusammenfassungError(
      abgeschnitten
        ? "Antwort wurde wegen Token-Limit abgeschnitten, bevor Text kam."
        : "Keine verwertbare Antwort erhalten."
    );
  }
  return text;
}

async function frageClaude(apiKey: string, modell: string, prompt: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modell,
        // Ausfuehrliche Ausarbeitung statt kurzer Hilfestellung (dort 400) –
        // 4096 reicht fuer die gewuenschten 900-1500 Woerter mit Puffer.
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new ZusammenfassungError("Claude war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | { content?: { type: string; text?: string }[]; error?: { message?: string } }
    | null;

  if (!res.ok || !body) {
    throw new ZusammenfassungError(body?.error?.message || `HTTP ${res.status}`);
  }

  const text = body.content
    ?.find((block) => block.type === "text" && block.text)
    ?.text?.trim();
  if (!text) throw new ZusammenfassungError("Keine verwertbare Antwort erhalten.");
  return text;
}

/**
 * Erstellt die ausfuehrliche Projekt-Zusammenfassung – bevorzugt ueber den
 * kostenlosen Groq-Zugang, ersatzweise ueber Claude/Anthropic
 * (kostenpflichtig), falls vorhanden. Wirft `ZusammenfassungError` mit einer
 * fuer Menschen lesbaren Sammel-Fehlermeldung, wenn kein Anbieter
 * erfolgreich war.
 */
export async function erstelleProjektZusammenfassung(
  params: ZusammenfassungParams
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!groqKey && !anthropicKey) {
    throw new ZusammenfassungError(
      'Weder GROQ_API_KEY (kostenlos) noch ANTHROPIC_API_KEY (kostenpflichtig) gesetzt. Siehe README, Abschnitt "Mit KI bearbeiten".'
    );
  }

  const prompt = buildPrompt(params);
  const fehlermeldungen: string[] = [];

  if (groqKey) {
    for (const modell of GROQ_MODELLE) {
      try {
        return await frageGroq(groqKey, modell, prompt);
      } catch (err) {
        fehlermeldungen.push(
          `Groq (${modell}): ${err instanceof Error ? err.message : "Fehler"}`
        );
      }
    }
  }

  if (anthropicKey) {
    try {
      return await frageClaude(anthropicKey, ANTHROPIC_MODELL, prompt);
    } catch (err) {
      fehlermeldungen.push(`Claude: ${err instanceof Error ? err.message : "Fehler"}`);
    }
  }

  throw new ZusammenfassungError(
    `Zusammenfassung fehlgeschlagen (${fehlermeldungen.join(" · ")}).`
  );
}
