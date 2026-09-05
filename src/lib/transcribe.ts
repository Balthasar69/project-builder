// Automatische Vertextung von Sprachnotizen. Bewusst als eigenständige,
// sehr fehlertolerante Funktion: Vertextung ist ein "Nice-to-have" –
// schlägt sie fehl (kein Key, keine Internetverbindung, Kontingent
// aufgebraucht …), soll das NIE das Speichern der eigentlichen Sprachnotiz
// verhindern. Aufrufer fangen deshalb Fehler selbst ab.
//
// Unterstützt zwei austauschbare Anbieter mit identischem ("OpenAI-
// kompatiblem") Anfrageformat:
// - Groq (GROQ_API_KEY): kostenlose Stufe ohne hinterlegte Zahlungsmethode,
//   siehe README, Abschnitt "Sprachnotizen" – deshalb die empfohlene
//   Standardwahl.
// - OpenAI (OPENAI_API_KEY): kostenpflichtig (Cent-Beträge/Aufnahme),
//   Alternative falls gewünscht.
// Ist GROQ_API_KEY gesetzt, hat er Vorrang vor OPENAI_API_KEY.

export class TranscribeError extends Error {}

interface Anbieter {
  name: string;
  apiKey: string;
  url: string;
  model: string;
}

function getAnbieter(): Anbieter {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      name: "Groq",
      apiKey: groqKey,
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      model: "whisper-large-v3-turbo",
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      name: "OpenAI",
      apiKey: openaiKey,
      url: "https://api.openai.com/v1/audio/transcriptions",
      model: "whisper-1",
    };
  }
  throw new TranscribeError(
    'Weder GROQ_API_KEY noch OPENAI_API_KEY gesetzt. Siehe README, Abschnitt "Sprachnotizen".'
  );
}

/** Zerlegt eine data:-URL (z. B. "data:audio/webm;codecs=opus;base64,AAA…") in Mimetyp und Rohdaten. */
function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^,]*),([\s\S]*)$/);
  if (!match) {
    throw new TranscribeError("Ungültige Audiodaten (keine data:-URL).");
  }
  const meta = match[1]; // z. B. "audio/webm;codecs=opus;base64"
  const payload = match[2];
  if (!/;base64$/i.test(meta)) {
    throw new TranscribeError("Ungültige Audiodaten (nicht Base64-kodiert).");
  }
  const mime = meta.replace(/;base64$/i, "").split(";")[0] || "audio/webm";
  return { mime, buffer: Buffer.from(payload, "base64") };
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

/**
 * Schickt eine Sprachnotiz (als data:-URL) an Groq oder OpenAI (Whisper)
 * und gibt den erkannten Text zurück. Wirft `TranscribeError`, statt
 * undefined zurückzugeben, damit Aufrufer bewusst entscheiden, wie sie
 * einen Fehlschlag dem Menschen mitteilen.
 */
export async function transcribeAudio(audioDataUrl: string): Promise<string> {
  const anbieter = getAnbieter();
  const { mime, buffer } = parseDataUrl(audioDataUrl);
  const extension = EXTENSION_BY_MIME[mime] ?? "webm";

  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: mime }),
    `sprachnotiz.${extension}`
  );
  form.append("model", anbieter.model);
  form.append("language", "de");

  let res: Response;
  try {
    res = await fetch(anbieter.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${anbieter.apiKey}` },
      body: form,
    });
  } catch {
    throw new TranscribeError(
      `${anbieter.name} war nicht erreichbar. Bitte später erneut versuchen.`
    );
  }

  const body = (await res.json().catch(() => null)) as
    | { text?: string; error?: { message?: string } }
    | null;

  if (!res.ok || !body || typeof body.text !== "string") {
    const detail = body?.error?.message || `HTTP ${res.status}`;
    throw new TranscribeError(
      `${anbieter.name} hat die Vertextung abgelehnt: ${detail}`
    );
  }

  return body.text.trim();
}
