// "Mit KI bearbeiten": eine einzelne Bitrix24-Aufgabe wird per KI eingeschätzt
// – wie sie sich einfacher erledigen lässt und wofür sie im Zusammenhang mit
// der aktuellen Projektphase gerade nützlich ist. Genau wie bei der
// Vertextung von Sprachnotizen (siehe transcribe.ts) gibt es zwei
// austauschbare Anbieter:
//
// - Groq (GROQ_API_KEY): kostenlose Stufe ohne hinterlegte Zahlungsmethode
//   – derselbe Schlüssel, der schon für Sprachnotizen genutzt wird. Ist er
//   bereits gesetzt, funktioniert "Mit KI bearbeiten" automatisch mit, ohne
//   dass extra etwas eingerichtet werden muss.
// - Claude/Anthropic (ANTHROPIC_API_KEY): kostenpflichtige Alternative,
//   falls kein Groq-Zugang gewünscht ist oder eine höhere Qualität nötig
//   erscheint.
//
// Ist GROQ_API_KEY gesetzt, hat er Vorrang (kostenlos). Bewusst genauso
// fehlertolerant gebaut wie die übrigen Zusatzfunktionen: fehlt jeder
// Schlüssel oder schlägt der Aufruf fehl, bekommt die Person eine klare
// deutsche Fehlermeldung statt eines kaputten Klicks – der Rest der App ist
// davon nicht betroffen.

export class AnalyseError extends Error {}

// Bei Groq mehrere Kandidaten hintereinander versuchen: fällt ein Modell
// weg oder ist gerade überlastet, springt die App automatisch zum nächsten,
// statt gleich aufzugeben. Groq benennt bzw. ersetzt seine kostenlosen
// Modelle gelegentlich (siehe console.groq.com/docs/deprecations) – aktuell
// (Stand v0.35) sind das die beiden "gpt-oss"-Modelle.
const GROQ_MODELLE = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];
const ANTHROPIC_MODELL = "claude-haiku-4-5-20251001";

function buildPrompt(params: {
  aufgabenTitel: string;
  projektName: string;
  projektBeschreibung?: string;
  phaseName: string;
  phaseZiel: string;
}): string {
  return `Du unterstützt ein kleines Projektteam bei der Umsetzung eines Projekts.

Projekt: "${params.projektName}"
Projektbeschreibung: ${params.projektBeschreibung?.trim() || "(keine hinterlegt)"}
Aktuelle Projektphase: "${params.phaseName}" – Ziel dieser Phase: ${params.phaseZiel}
Zu bearbeitende Aufgabe: "${params.aufgabenTitel}"

Gib eine kurze, konkrete Hilfestellung auf Deutsch (maximal 120 Wörter, als normaler Fließtext ohne Aufzählungszeichen und ohne Überschriften) zu genau diesen zwei Punkten:
1. Wie lässt sich diese Aufgabe einfacher bzw. schneller erledigen – mit konkreten, praktischen Tipps.
2. Wofür ist diese Aufgabe im Zusammenhang mit dieser Projektphase gerade nützlich bzw. wichtig.

Antworte direkt mit dem Fließtext, ohne Einleitung wie "Hier ist deine Einschätzung" und ohne die beiden Punkte wörtlich zu wiederholen.`;
}

/** Fragt ein Groq-Chatmodell (OpenAI-kompatibles Format) an. */
async function frageGroq(
  apiKey: string,
  modell: string,
  prompt: string
): Promise<string> {
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
        // "reasoning_effort: low", da für diese kurze Hilfestellung kein
        // tiefes Nachdenken nötig ist.
        max_completion_tokens: 900,
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new AnalyseError("Groq war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        error?: { message?: string };
      }
    | null;

  if (!res.ok || !body) {
    throw new AnalyseError(body?.error?.message || `HTTP ${res.status}`);
  }

  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const abgeschnitten = body.choices?.[0]?.finish_reason === "length";
    throw new AnalyseError(
      abgeschnitten
        ? "Antwort wurde wegen Token-Limit abgeschnitten, bevor Text kam."
        : "Keine verwertbare Antwort erhalten."
    );
  }
  return text;
}

/** Fragt Claude über die Anthropic-Messages-API an. */
async function frageClaude(
  apiKey: string,
  modell: string,
  prompt: string
): Promise<string> {
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
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new AnalyseError("Claude war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | { content?: { type: string; text?: string }[]; error?: { message?: string } }
    | null;

  if (!res.ok || !body) {
    throw new AnalyseError(body?.error?.message || `HTTP ${res.status}`);
  }

  const text = body.content
    ?.find((block) => block.type === "text" && block.text)
    ?.text?.trim();
  if (!text) throw new AnalyseError("Keine verwertbare Antwort erhalten.");
  return text;
}

/**
 * Fordert eine kurze Hilfestellung zu einer Aufgabe an – bevorzugt über den
 * kostenlosen Groq-Zugang, ersatzweise über Claude/Anthropic (kostenpflichtig),
 * falls vorhanden. Wirft `AnalyseError` mit einer für Menschen lesbaren
 * Sammel-Fehlermeldung, wenn kein Anbieter erfolgreich war.
 */
export async function analysiereAufgabe(params: {
  aufgabenTitel: string;
  projektName: string;
  projektBeschreibung?: string;
  phaseName: string;
  phaseZiel: string;
}): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!groqKey && !anthropicKey) {
    throw new AnalyseError(
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
      fehlermeldungen.push(
        `Claude: ${err instanceof Error ? err.message : "Fehler"}`
      );
    }
  }

  throw new AnalyseError(`Analyse fehlgeschlagen (${fehlermeldungen.join(" · ")}).`);
}
