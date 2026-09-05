// "Mit KI bearbeiten": eine einzelne Bitrix24-Aufgabe wird mithilfe von
// Claude (Anthropic-API) eingeschätzt – wie sie sich einfacher erledigen
// lässt und wofür sie im Zusammenhang mit der aktuellen Projektphase gerade
// nützlich ist. Bewusst genauso fehlertolerant gebaut wie die Vertextung
// (siehe transcribe.ts): fehlt der Schlüssel oder schlägt der Aufruf fehl,
// bekommt die Person eine klare deutsche Fehlermeldung statt eines kaputten
// Klicks – der Rest der App ist davon nicht betroffen.

export class AnalyseError extends Error {}

// Schnellstes/günstigstes aktuelles Modell – für eine kurze Texteinschätzung
// völlig ausreichend und damit passend zu den geringen Kosten der übrigen
// Zusatzfunktionen (Vertextung, Versand).
const MODELL = "claude-haiku-4-5-20251001";

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
}

/**
 * Fordert bei Claude eine kurze Hilfestellung zu einer Aufgabe an. Wirft
 * `AnalyseError`, statt still zu scheitern, damit Aufrufer bewusst
 * entscheiden, wie sie einen Fehlschlag der Person mitteilen.
 */
export async function analysiereAufgabe(params: {
  aufgabenTitel: string;
  projektName: string;
  projektBeschreibung?: string;
  phaseName: string;
  phaseZiel: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnalyseError(
      'ANTHROPIC_API_KEY ist nicht gesetzt. Siehe README, Abschnitt "Mit KI bearbeiten".'
    );
  }

  const prompt = `Du unterstützt ein kleines Projektteam bei der Umsetzung eines Projekts.

Projekt: "${params.projektName}"
Projektbeschreibung: ${params.projektBeschreibung?.trim() || "(keine hinterlegt)"}
Aktuelle Projektphase: "${params.phaseName}" – Ziel dieser Phase: ${params.phaseZiel}
Zu bearbeitende Aufgabe: "${params.aufgabenTitel}"

Gib eine kurze, konkrete Hilfestellung auf Deutsch (maximal 120 Wörter, als normaler Fließtext ohne Aufzählungszeichen und ohne Überschriften) zu genau diesen zwei Punkten:
1. Wie lässt sich diese Aufgabe einfacher bzw. schneller erledigen – mit konkreten, praktischen Tipps.
2. Wofür ist diese Aufgabe im Zusammenhang mit dieser Projektphase gerade nützlich bzw. wichtig.

Antworte direkt mit dem Fließtext, ohne Einleitung wie "Hier ist deine Einschätzung" und ohne die beiden Punkte wörtlich zu wiederholen.`;

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
        model: MODELL,
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new AnalyseError("Claude war nicht erreichbar. Bitte später erneut versuchen.");
  }

  const body = (await res.json().catch(() => null)) as AnthropicResponse | null;

  if (!res.ok || !body) {
    const detail = body?.error?.message || `HTTP ${res.status}`;
    throw new AnalyseError(`Claude hat die Analyse abgelehnt: ${detail}`);
  }

  const text = body.content
    ?.find((block) => block.type === "text" && block.text)
    ?.text?.trim();

  if (!text) {
    throw new AnalyseError("Claude hat keine verwertbare Antwort geliefert.");
  }

  return text;
}
