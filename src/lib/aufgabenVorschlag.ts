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
}): string {
  const {
    projektName,
    projektArt,
    zielsituation,
    umsatzziel,
    liquiditaet,
    meilensteine,
    phaseName,
  } = params;

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

Leite daraus konkrete, direkt umsetzbare Zwischenaufgaben ab, die nötig
sind, um von der aktuellen Situation zu den genannten Meilensteinen zu
kommen. Nenne 5 bis 10 Aufgaben, jede so kurz und konkret wie möglich
(max. 12 Wörter je Aufgabe).

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
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new VorschlagError("Groq war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
    | null;

  if (!res.ok || !body) {
    throw new VorschlagError(body?.error?.message || `HTTP ${res.status}`);
  }

  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new VorschlagError("Keine verwertbare Antwort erhalten.");
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
