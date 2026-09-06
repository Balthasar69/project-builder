// "Aufgaben von der KI vorschlagen lassen": aus dem Projektstart-Fragebogen
// (Zielsituation + Meilensteine, siehe `ProjektstartFragebogen` in types.ts)
// leitet die KI eine Liste konkreter Zwischenaufgaben ab. Nutzt bewusst
// dieselbe Anbieter-Kette wie "Mit KI bearbeiten" (siehe aufgabenAnalyse.ts):
// zuerst Groq (kostenlos, GROQ_API_KEY), ersatzweise Claude/Anthropic
// (kostenpflichtig, ANTHROPIC_API_KEY).

import { ProjektArt } from "./types";

export class VorschlagError extends Error {}

const GROQ_MODELLE = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];
const ANTHROPIC_MODELL = "claude-haiku-4-5-20251001";

function buildPrompt(params: {
  projektName: string;
  projektArt: ProjektArt;
  zielsituation: string;
  umsatzziel?: string;
  liquiditaet?: string;
  meilensteine: string;
  phaseName: string;
  bestehendeAufgaben?: { titel: string; erledigt: boolean }[];
}): string {
  const {
    projektName,
    projektArt,
    zielsituation,
    umsatzziel,
    liquiditaet,
    meilensteine,
    phaseName,
    bestehendeAufgaben,
  } = params;

  // Bei einem bestehenden Projekt gibt es meist schon Bitrix24-Aufgaben.
  // Die werden hier mit aufgeführt, damit die KI nicht einfach dieselben
  // Titel nochmal vorschlägt, sondern gezielt ergänzt, was noch fehlt.
  const bestehendeAufgabenTeil =
    bestehendeAufgaben && bestehendeAufgaben.length > 0
      ? `Bereits vorhandene Aufgaben in diesem Projekt (nicht nochmal vorschlagen,
sondern nur ergänzen bzw. anpassen, was daraus noch fehlt):
${bestehendeAufgaben
  .map((a) => `- ${a.titel}${a.erledigt ? " (erledigt)" : ""}`)
  .join("\n")}

`
      : "In diesem Projekt gibt es aktuell noch keine Aufgaben.\n\n";

  const geschaeftsteil =
    projektArt === "geschaeft"
      ? `Umsatzziel: ${umsatzziel?.trim() || "nicht angegeben"}
Liquiditätslage/-planung: ${liquiditaet?.trim() || "nicht angegeben"}

Beziehe in die Aufgabenliste ausdrücklich mindestens eine konkrete Aufgabe
zur Umsatzgenerierung und mindestens eine zur Liquiditätsplanung mit ein –
das ist bei diesem Geschäftsprojekt ein fester Schwerpunkt.

`
      : "";

  return `Du unterstützt den Projektleiter eines ${
    projektArt === "geschaeft" ? "Geschäftsprojekts" : "privaten/persönlichen Projekts"
  } namens "${projektName}" (aktuelle Phase: "${phaseName}").

Zielsituation (was am Ende erreicht sein soll):
${zielsituation.trim()}

${geschaeftsteil}Vom Projektleiter genannte Meilensteine:
${meilensteine.trim()}

${bestehendeAufgabenTeil}Leite daraus konkrete, direkt umsetzbare Zwischenaufgaben ab, die nötig
sind, um von der aktuellen Situation zu den genannten Meilensteinen zu
kommen. Nenne 5 bis 10 Aufgaben, jede so kurz und konkret wie möglich
(max. 12 Wörter je Aufgabe). Schlage dabei nur Aufgaben vor, die inhaltlich
noch nicht durch die oben genannten bereits vorhandenen Aufgaben abgedeckt
sind.

Antworte AUSSCHLIESSLICH mit einem JSON-Array aus Zeichenketten, ohne
jede weitere Erklärung, ohne Markdown-Codeblock, z. B.:
["Erste Aufgabe", "Zweite Aufgabe", "Dritte Aufgabe"]`;
}

/** Extrahiert eine Liste von Aufgaben-Titeln aus der KI-Antwort – bevorzugt
 * als sauberes JSON-Array, mit Rückfallebenen für den Fall, dass die KI sich
 * nicht exakt an das gewünschte Format hält (z. B. Markdown-Codeblock oder
 * eine nummerierte Liste als Fließtext). */
function parseAufgabenListe(text: string): string[] {
  const bereinigt = text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(bereinigt);
    if (Array.isArray(parsed)) {
      return parsed
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter(Boolean);
    }
  } catch {
    // fällt durch zur nächsten Rückfallebene
  }

  const arrayMatch = bereinigt.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .map((t) => (typeof t === "string" ? t.trim() : ""))
          .filter(Boolean);
      }
    } catch {
      // fällt durch zur letzten Rückfallebene
    }
  }

  // Letzte Rückfallebene: zeilenweise, führende Aufzählungszeichen/Nummern
  // entfernen – falls die KI trotz Anweisung eine normale Liste ausgibt.
  return bereinigt
    .split("\n")
    .map((zeile) => zeile.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter(Boolean);
}

async function frageGroq(
  apiKey: string,
  modell: string,
  prompt: string
): Promise<string[]> {
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
        // "gpt-oss"-Modelle sind Reasoning-Modelle: sie verbrauchen einen
        // Teil des Token-Budgets fürs interne "Nachdenken", bevor die
        // eigentliche Antwort kommt. Bei "max_tokens" (veraltet) und einem
        // zu knappen Budget kam bisher oft ein leeres `message.content`
        // zurück, weil das Budget mitten im Nachdenken aufgebraucht war
        // (sichtbar an finish_reason "length"). Deshalb: das aktuelle
        // Feld "max_completion_tokens" mit reichlich Spielraum, plus
        // "reasoning_effort: low", da für diese Aufgabenliste kein tiefes
        // Nachdenken nötig ist.
        max_completion_tokens: 1000,
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new VorschlagError("Groq war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        error?: { message?: string };
      }
    | null;

  if (!res.ok || !body) {
    throw new VorschlagError(body?.error?.message || `HTTP ${res.status}`);
  }

  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const abgeschnitten = body.choices?.[0]?.finish_reason === "length";
    throw new VorschlagError(
      abgeschnitten
        ? "Antwort wurde wegen Token-Limit abgeschnitten, bevor Text kam."
        : "Keine verwertbare Antwort erhalten."
    );
  }
  const liste = parseAufgabenListe(text);
  if (liste.length === 0) throw new VorschlagError("Antwort enthielt keine verwertbare Aufgabenliste.");
  return liste;
}

async function frageClaude(
  apiKey: string,
  modell: string,
  prompt: string
): Promise<string[]> {
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
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new VorschlagError("Claude war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | { content?: { type: string; text?: string }[]; error?: { message?: string } }
    | null;

  if (!res.ok || !body) {
    throw new VorschlagError(body?.error?.message || `HTTP ${res.status}`);
  }

  const text = body.content
    ?.find((block) => block.type === "text" && block.text)
    ?.text?.trim();
  if (!text) throw new VorschlagError("Keine verwertbare Antwort erhalten.");
  const liste = parseAufgabenListe(text);
  if (liste.length === 0) throw new VorschlagError("Antwort enthielt keine verwertbare Aufgabenliste.");
  return liste;
}

/**
 * Leitet aus dem beantworteten Projektstart-Fragebogen eine Liste
 * vorgeschlagener Aufgaben-Titel ab – bevorzugt über den kostenlosen
 * Groq-Zugang, ersatzweise über Claude/Anthropic (kostenpflichtig), falls
 * vorhanden. Wirft `VorschlagError` mit einer für Menschen lesbaren
 * Sammel-Fehlermeldung, wenn kein Anbieter erfolgreich war.
 */
export async function schlageAufgabenVor(params: {
  projektName: string;
  projektArt: ProjektArt;
  zielsituation: string;
  umsatzziel?: string;
  liquiditaet?: string;
  meilensteine: string;
  phaseName: string;
  bestehendeAufgaben?: { titel: string; erledigt: boolean }[];
}): Promise<string[]> {
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!groqKey && !anthropicKey) {
    throw new VorschlagError(
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

  throw new VorschlagError(`Vorschläge fehlgeschlagen (${fehlermeldungen.join(" · ")}).`);
}
