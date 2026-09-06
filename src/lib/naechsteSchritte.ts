// Persönlicher KI-Hinweis "Für dich als Nächstes" (neu seit v0.46): fasst für
// die angemeldete Person zusammen, was über die drei Hub-Bereiche Orga,
// Dashboard und Dynamik hinweg als Nächstes ansteht – ein kurzer Satz plus
// 2–3 konkrete Punkte. Nutzt bewusst dieselbe Anbieter-Kette wie die
// Aufgaben-Vorschläge (siehe aufgabenVorschlag.ts): zuerst Groq (kostenlos,
// GROQ_API_KEY), ersatzweise Claude/Anthropic (kostenpflichtig,
// ANTHROPIC_API_KEY).

export class NaechsteSchritteError extends Error {}

const GROQ_MODELLE = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];
const ANTHROPIC_MODELL = "claude-haiku-4-5-20251001";

export interface NaechsteSchritteInput {
  personName: string;
  rolle: string;
  projektName: string;
  phaseName: string;
  reifegrad: number;
  bewertungEmpfehlung?: string;
  hatKompetenzEintrag: boolean;
  offeneAufgaben: number;
  ideenAnzahl: number;
  chatAktivitaet: "keine" | "wenig" | "aktiv";
}

export interface NaechsteSchritte {
  satz: string;
  punkte: string[];
}

function buildPrompt(i: NaechsteSchritteInput): string {
  return `Du bist der persönliche Assistent von "${i.personName}" (Rolle: ${
    i.rolle
  }) im Projekt "${i.projektName}" (aktuelle Phase: "${i.phaseName}", Reifegrad ${
    i.reifegrad
  }%${i.bewertungEmpfehlung ? `, letzte Bewertung: ${i.bewertungEmpfehlung}` : ""}).

Aktueller Stand zu dieser Person und zum Projekt:
- Kompetenzen-Eintrag (was die Person beitragen kann/möchte): ${
    i.hatKompetenzEintrag ? "bereits ausgefüllt" : "noch NICHT ausgefüllt"
  }
- Offene Aufgaben im Projekt: ${i.offeneAufgaben}
- Gesammelte Ideen im Projekt: ${i.ideenAnzahl}
- Aktivität im internen Team-Chat: ${i.chatAktivitaet}

Formuliere einen ganz persönlichen, konkreten Hinweis, was diese Person als
Nächstes tun oder sich ansehen sollte – bezogen auf mindestens zwei der drei
Bereiche Organisation (Team/Kompetenzen), Dashboard (Fortschritt/Bewertung)
und Dynamik (Aufgaben/Ideen/Chat). Sprich die Person direkt mit "du" an.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne jede weitere Erklärung,
ohne Markdown-Codeblock, in genau dieser Form:
{"satz": "Ein kurzer, konkreter Satz als Überschrift.", "punkte": ["Punkt 1", "Punkt 2", "Punkt 3"]}
Der Satz max. 15 Wörter, jeder Punkt max. 12 Wörter, 2 bis 3 Punkte.`;
}

function parseErgebnis(text: string): NaechsteSchritte {
  const bereinigt = text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const tryParse = (s: string): NaechsteSchritte | null => {
    try {
      const parsed = JSON.parse(s);
      if (
        parsed &&
        typeof parsed.satz === "string" &&
        Array.isArray(parsed.punkte)
      ) {
        const punkte = parsed.punkte
          .map((p: unknown) => (typeof p === "string" ? p.trim() : ""))
          .filter(Boolean)
          .slice(0, 3);
        if (parsed.satz.trim() && punkte.length > 0) {
          return { satz: parsed.satz.trim(), punkte };
        }
      }
    } catch {
      // fällt durch zur nächsten Rückfallebene
    }
    return null;
  };

  const direkt = tryParse(bereinigt);
  if (direkt) return direkt;

  const objectMatch = bereinigt.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    const geparst = tryParse(objectMatch[0]);
    if (geparst) return geparst;
  }

  throw new NaechsteSchritteError("Antwort enthielt kein verwertbares Ergebnis.");
}

async function frageGroq(
  apiKey: string,
  modell: string,
  prompt: string
): Promise<NaechsteSchritte> {
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
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new NaechsteSchritteError("Groq war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
    | null;

  if (!res.ok || !body) {
    throw new NaechsteSchritteError(body?.error?.message || `HTTP ${res.status}`);
  }

  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new NaechsteSchritteError("Keine verwertbare Antwort erhalten.");
  return parseErgebnis(text);
}

async function frageClaude(
  apiKey: string,
  modell: string,
  prompt: string
): Promise<NaechsteSchritte> {
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
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new NaechsteSchritteError("Claude war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | { content?: { type: string; text?: string }[]; error?: { message?: string } }
    | null;

  if (!res.ok || !body) {
    throw new NaechsteSchritteError(body?.error?.message || `HTTP ${res.status}`);
  }

  const text = body.content
    ?.find((block) => block.type === "text" && block.text)
    ?.text?.trim();
  if (!text) throw new NaechsteSchritteError("Keine verwertbare Antwort erhalten.");
  return parseErgebnis(text);
}

/**
 * Leitet den persönlichen "Für dich als Nächstes"-Hinweis ab. Wirft
 * `NaechsteSchritteError` mit einer für Menschen lesbaren Sammel-
 * Fehlermeldung, wenn kein Anbieter erfolgreich war – die aufrufende Route
 * fängt das ab, damit ein Fehlschlag hier nie die restliche Seite blockiert.
 */
export async function ermittleNaechsteSchritte(
  input: NaechsteSchritteInput
): Promise<NaechsteSchritte> {
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!groqKey && !anthropicKey) {
    throw new NaechsteSchritteError(
      'Weder GROQ_API_KEY (kostenlos) noch ANTHROPIC_API_KEY (kostenpflichtig) gesetzt.'
    );
  }

  const prompt = buildPrompt(input);
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

  throw new NaechsteSchritteError(
    `Ermitteln fehlgeschlagen (${fehlermeldungen.join(" · ")}).`
  );
}
