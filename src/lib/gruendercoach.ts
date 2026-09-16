// Gründercoach-Bot für den Project Builder (Ökosystem-Phase 1 "Idee &
// Team"). Schwesterfunktion zu lib/ai.js `holeCoachAntwort`/`buildCoachPrompt`
// im Steuerboard-Repo (dort Phasen 2-5) – gleiches Konzept, gleiche
// Leitplanken, gleiches Groq/Claude-Fallback-Prinzip wie bereits bei
// aufgabenAnalyse.ts ("Mit KI bearbeiten"), hier aber projektweit als
// eigener Chat statt je Aufgabe.
//
// Kuratierte Wissensbasis (Stufe 1, siehe gruendercoach-wissensbasis.md im
// Steuerboard-Repo, Phase 1): Balthasars konkrete Methoden für die
// allererste Phase, direkt hier als Konstanten hinterlegt (kein Bedarf für
// ein separates Wissensbasis-Modul wie in Steuerboard, da es nur eine
// einzige Phase betrifft, die dieses Repo abdeckt).
//
// Gedächtnis: der Verlauf wird dauerhaft im `coachChat`-Feld des Projekts in
// der Datenbank gespeichert (siehe lib/data.ts addCoachNachricht) und ist
// projektweit geteilt – wie beim bereits vorhandenen internen Team-Chat
// (ChatNachricht/addChatNachricht), nur mit dem Bot als zusätzlichem
// Gesprächspartner. Bewusst NICHT projektübergreifend: jedes Projekt sieht
// nur seinen eigenen Verlauf.

import { CoachNachricht, Idee, KernteamMitglied, Project } from "./types";
import { PHASES } from "./types";

export class GruendercoachError extends Error {}

const GROQ_MODELLE = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];
const ANTHROPIC_MODELL = "claude-haiku-4-5-20251001";

const VISUALISIERUNGS_TECHNIK =
  'Wirkt die Projektidee noch zu vage/abstrakt/zu groß, schärfe sie NICHT mit generischen Businessplan-Ratschlägen, sondern stelle genau diese drei Fragen der Reihe nach: 1) "Stell dir die Zielperson konkret vor – wie sieht sie aus, wer ist sie ganz genau?" (kein abstrakter "Kunde", eine vorstellbare, reale Person). 2) "Welche Tätigkeit tust du ganz genau, Schritt für Schritt, für diese Person?" (nicht "ich berate", sondern das konkrete Tun). 3) Aus diesen beiden Bildern ergibt sich der nächste Schritt von selbst – er muss nicht mehr abstrakt gesucht werden.';

const TEAMFINDUNGS_TECHNIK =
  'Bei Unsicherheit rund um Mitwirkende/Teammitglieder stelle genau diese zwei Fragen der Reihe nach: 1) "Welche Rolle, welche Kompetenz möchtest du dabei haben?" (erst klären, was gebraucht wird, bevor nach Personen gesucht wird). 2) "Wen in deinem nächsten Umfeld kennst du, der sich damit einbringen kann?" (bewusst im eigenen, nahen Netzwerk anfangen, nicht abstrakt nach "irgendwem" suchen).';

const BUSINESSPLAN_THEMEN = [
  "Geschäftsidee/Vision",
  "Zielgruppe & Nutzen",
  "Erlösmodell/Business Case",
  "Organisationsform & Team",
  "Markt & Wettbewerb",
  "Marketing & Vertrieb",
  "Kapitalbedarf & Finanzierung",
  "Chancen & Risiken",
  "Realisierungsfahrplan (grobe Roadmap)",
];

const BUSINESSPLAN_ANLEITUNG =
  `Der "kleine Businessplan" ist bewusst schlank: pro Thema reichen genau 3 Sätze, keine ausführliche Ausarbeitung. Die 9 Themen sind: ${BUSINESSPLAN_THEMEN.join(", ")}. Will jemand den Businessplan angehen, biete diese 9 Themen als Gerüst an und sag ausdrücklich, dass 3 Sätze pro Thema reichen. Abschlusskriterium für den Wechsel in die nächste Phase: stehen zu allen 9 Themen je 3 Sätze, ist diese Phase inhaltlich fertig – ein klar prüfbares Kriterium statt Bauchgefühl. Fragt jemand, ob das Projekt "fertig" für den nächsten Schritt ist, frage genau danach.`;

const VERBINDLICHKEIT_THEMA =
  "Phasenübergreifendes Muster: Taucht mangelnde Verbindlichkeit auf (bei Zusagen, Rollen, Fristen, Entscheidungen), reagiere nicht direkt mit einer Lösung, sondern frage zuerst gezielt nach der Ursache: Fehlt es an Zeit, an Motivation oder an Klarheit? Erst danach eine dazu passende Lösung anbieten (Zeit -> Priorisierung/Entlastung; Motivation -> Sinn/Nutzen klären; Klarheit -> nächsten Schritt konkretisieren).";

function buildKernteamZeilen(kernteam: KernteamMitglied[] | undefined): string {
  if (!kernteam || !kernteam.length) return "(noch keine Kernteam-Mitglieder eingetragen)";
  return kernteam
    .map((m) => `- ${m.name}${m.rolle ? ` (${m.rolle})` : ""}`)
    .join("\n");
}

function buildIdeenZeilen(ideen: Idee[] | undefined): string {
  if (!ideen || !ideen.length) return "(noch keine Ideen notiert)";
  return ideen
    .slice(-20)
    .map((i) => `- ${i.text.trim()}${i.uebernommenAlsTaskId ? " (bereits übernommen)" : ""}`)
    .join("\n");
}

export function buildCoachPrompt(params: {
  project: Project;
  verlauf: CoachNachricht[];
  nachricht?: string;
  aktuellerAutor?: string;
}): string {
  const phase = PHASES.find((p) => p.code === params.project.aktuellePhase);

  const verlaufText =
    params.verlauf
      .slice(-30)
      .map((m) =>
        m.rolle === "bot"
          ? `Gründercoach-Bot: ${m.text}`
          : `Mitglied${m.autorName ? ` (${m.autorName})` : ""}: ${m.text}`
      )
      .join("\n") || "(noch kein bisheriger Verlauf zu diesem Projekt)";

  const nachricht = params.nachricht?.trim();
  const aktuelleNachrichtBlock = nachricht
    ? `Aktuelle Nachricht von ${params.aktuellerAutor ?? "einem Mitglied"}: "${nachricht}"`
    : `Das Mitglied ${params.aktuellerAutor ? `(${params.aktuellerAutor}) ` : ""}hat den Chat gerade geöffnet, ohne selbst zu schreiben. ${
        params.verlauf.length
          ? "Beziehe dich kurz auf den bisherigen Verlauf oben, falls er von einer anderen Person stammt als der, die jetzt schaut, und schlage dann von dir aus den sinnvollen nächsten Schritt vor."
          : "Begrüße es in einem Satz und schlage danach von dir aus, basierend auf Projektbeschreibung und Ideen unten, den sinnvollen nächsten Schritt vor."
      }`;

  return `Du bist der Gründercoach-Bot im Steuerboard-Ökosystem der Entscheiderakademie. Du begleitest das gesamte Team eines Projekts durch die Phase "Idee & Team" (Ökosystem-Phase 1) im Project Builder – vor der eigentlichen operativen Umsetzung im Steuerboard. Der Chat-Verlauf ist projektweit geteilt – mehrere Mitglieder desselben Teams schreiben hier gemeinsam mit dir.

WICHTIGE LEITPLANKE: Du gibst niemals rechtliche, steuerrechtliche, juristische oder medizinische Fakten oder verbindliche Auskünfte aus. Geht eine Frage in einen dieser Bereiche, weise klar und freundlich darauf hin, dass dies verbindlich mit einer Fachperson (z.B. Steuerberater, Anwalt, Arzt) geklärt werden muss, und biete stattdessen an, bei der organisatorischen Seite zu helfen. Bei allen anderen Themen darfst und sollst du inhaltlich konkret und hilfreich sein.

Kuratierte Wissensbasis für diese Phase (bevorzugt vor eigenem allgemeinem Wissen nutzen, wortwörtlich befolgen, nicht nur sinngemäß):
1. ${VISUALISIERUNGS_TECHNIK}
2. ${TEAMFINDUNGS_TECHNIK}
3. ${BUSINESSPLAN_ANLEITUNG}

Zusätzlich, phasenübergreifend gültig: ${VERBINDLICHKEIT_THEMA}

Du kennst außerdem nur dieses eine Projekt – Informationen aus anderen Projekten liegen dir nicht vor und du solltest nicht so tun, als kenntest du sie.

Projekt: "${params.project.name}"
Projektbeschreibung: ${params.project.beschreibung?.trim() || "(keine hinterlegt)"}
Aktuelle Phase: ${phase ? `${phase.name} – Ziel: ${phase.ziel}` : params.project.aktuellePhase}
Kernteam:
${buildKernteamZeilen(params.project.kernteam)}
Bisher notierte Ideen:
${buildIdeenZeilen(params.project.ideen)}

Bisheriger, projektweit geteilter Verlauf dieses Chats (kann mehrere Mitglieder enthalten):
${verlaufText}

${aktuelleNachrichtBlock}

Antworte auf Deutsch in normalem Fließtext ohne Aufzählungszeichen und ohne Überschriften, persönlich, ermutigend und konkret (maximal ca. 150 Wörter). Antworte direkt mit dem Text, ohne Einleitung wie "Hier ist meine Antwort".`;
}

async function frageGroq(apiKey: string, modell: string, prompt: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modell,
        max_completion_tokens: 900,
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new GruendercoachError("Groq war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string }; finish_reason?: string }[]; error?: { message?: string } }
    | null;

  if (!res.ok || !body) {
    throw new GruendercoachError(body?.error?.message || `HTTP ${res.status}`);
  }
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const abgeschnitten = body.choices?.[0]?.finish_reason === "length";
    throw new GruendercoachError(
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
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new GruendercoachError("Claude war nicht erreichbar.");
  }

  const body = (await res.json().catch(() => null)) as
    | { content?: { type: string; text?: string }[]; error?: { message?: string } }
    | null;

  if (!res.ok || !body) {
    throw new GruendercoachError(body?.error?.message || `HTTP ${res.status}`);
  }
  const text = body.content?.find((b) => b.type === "text" && b.text)?.text?.trim();
  if (!text) throw new GruendercoachError("Keine verwertbare Antwort erhalten.");
  return text;
}

/**
 * Fordert eine Antwort des Gründercoach-Bots für eine Chat-Runde an –
 * bevorzugt über den kostenlosen Groq-Zugang, ersatzweise über Claude/
 * Anthropic (kostenpflichtig), falls vorhanden. Nutzt dieselben
 * Umgebungsvariablen wie "Mit KI bearbeiten" (aufgabenAnalyse.ts) – kein
 * zusätzlicher Schlüssel nötig.
 */
export async function holeCoachAntwort(params: {
  project: Project;
  verlauf: CoachNachricht[];
  nachricht?: string;
  aktuellerAutor?: string;
}): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!groqKey && !anthropicKey) {
    throw new GruendercoachError(
      'Weder GROQ_API_KEY (kostenlos) noch ANTHROPIC_API_KEY (kostenpflichtig) gesetzt. Siehe README, Abschnitt "Mit KI bearbeiten".'
    );
  }

  const prompt = buildCoachPrompt(params);
  const fehlermeldungen: string[] = [];

  if (groqKey) {
    for (const modell of GROQ_MODELLE) {
      try {
        return await frageGroq(groqKey, modell, prompt);
      } catch (err) {
        fehlermeldungen.push(`Groq (${modell}): ${err instanceof Error ? err.message : "Fehler"}`);
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

  throw new GruendercoachError(`Gründercoach-Bot fehlgeschlagen (${fehlermeldungen.join(" · ")}).`);
}
