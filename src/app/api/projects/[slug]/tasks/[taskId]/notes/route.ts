import { NextRequest, NextResponse } from "next/server";
import { addTaskNote, getProject, listTaskNotes, speichereBilder } from "@/lib/data";
import { pruefeBilder } from "@/lib/bilder";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { transcribeAudio } from "@/lib/transcribe";
import { addTaskComment, Bitrix24Error } from "@/lib/bitrix24";
import { benachrichtigeKernteam } from "@/lib/notify";

// Vertextung (OpenAI) und Bitrix24-Kommentar brauchen zusammen spürbar
// länger als die Standard-Zeitgrenze von Vercel-Funktionen (10 s im
// Hobby-Plan) – auf Plänen, die längere Laufzeiten erlauben, gilt dieser
// höhere Wert, sonst wird automatisch auf das jeweilige Maximum begrenzt.
export const maxDuration = 60;

// Vercel-Funktionen akzeptieren nur begrenzt große Anfragen (praktisch rund
// 4,5 MB). Sprachnotizen kommen als Base64-Text (data:-URL), der dabei rund
// ein Drittel größer ist als die eigentliche Audiodatei – deshalb hier eine
// bewusst konservative Obergrenze, mit klarer deutscher Fehlermeldung statt
// eines kryptischen Server-Fehlers.
const MAX_AUDIO_DATA_URL_LENGTH = 3_000_000; // ≈ 2,2 MB Audio

function formatiereZeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Baut den Kommentartext für Bitrix24 aus einer gespeicherten Notiz. */
function bitrixKommentarText(note: {
  authorName: string;
  erstelltAm: string;
  text?: string;
  audioDataUrl?: string;
  transcript?: string;
  bildIds?: string[];
}): string {
  const zeit = formatiereZeit(note.erstelltAm);
  const bildHinweis = note.bildIds?.length
    ? `\n\n🖼️ ${note.bildIds.length} Bild(er) angehängt – im Project Builder ansehen.`
    : "";
  if (note.audioDataUrl) {
    const inhalt = note.transcript
      ? note.transcript
      : "(Vertextung nicht verfügbar – Aufnahme im Project Builder anhören.)";
    return `🎤 Sprachnotiz von ${note.authorName} (${zeit}) – aus dem Project Builder:\n\n${inhalt}${bildHinweis}`;
  }
  return `📝 Notiz von ${note.authorName} (${zeit}) – aus dem Project Builder:\n\n${note.text ?? ""}${bildHinweis}`;
}

async function pruefeZugriff(slug: string) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 }) };
  }
  const project = await getProject(slug);
  if (!project) {
    return { error: NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 }) };
  }
  if (!hatProjektZugriff(session, project)) {
    return {
      error: NextResponse.json(
        { error: "Kein Zugriff auf dieses Projekt." },
        { status: 403 }
      ),
    };
  }
  return { session, project };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; taskId: string } }
) {
  const check = await pruefeZugriff(params.slug);
  if ("error" in check) return check.error;

  try {
    const notes = await listTaskNotes(params.slug, params.taskId);
    return NextResponse.json({ notes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; taskId: string } }
) {
  const check = await pruefeZugriff(params.slug);
  if ("error" in check) return check.error;
  const { session, project } = check;

  const body = (await req.json()) as { text?: string; audioDataUrl?: string; bilder?: unknown };
  const text = body.text?.trim() || undefined;
  const audioDataUrl = body.audioDataUrl || undefined;
  const geprueft = pruefeBilder(body.bilder);
  if ("fehler" in geprueft) {
    return NextResponse.json({ error: geprueft.fehler }, { status: 400 });
  }

  if (!text && !audioDataUrl && geprueft.bilder.length === 0) {
    return NextResponse.json(
      { error: "Bitte Text eingeben, ein Bild anhängen oder eine Sprachnotiz aufnehmen." },
      { status: 400 }
    );
  }

  if (audioDataUrl && audioDataUrl.length > MAX_AUDIO_DATA_URL_LENGTH) {
    return NextResponse.json(
      {
        error:
          "Die Sprachnotiz ist zu groß. Bitte eine kürzere Aufnahme machen (ca. 30–60 Sekunden).",
      },
      { status: 413 }
    );
  }

  // Vertextung ist ein "Nice-to-have": schlägt sie fehl (kein
  // OPENAI_API_KEY, Kontingent aufgebraucht, kein Netz …), wird die
  // Sprachnotiz trotzdem ganz normal gespeichert – nur ohne Text und mit
  // einem Hinweis in der Antwort.
  let transcript: string | undefined;
  let vertextungHinweis: string | undefined;
  if (audioDataUrl) {
    try {
      transcript = await transcribeAudio(audioDataUrl);
    } catch (err) {
      vertextungHinweis =
        err instanceof Error ? err.message : "Vertextung fehlgeschlagen.";
    }
  }

  let note;
  try {
    const bildIds = await speichereBilder(params.slug, session.email, geprueft.bilder);
    note = await addTaskNote({
      slug: params.slug,
      taskId: params.taskId,
      authorName: session.name,
      authorEmail: session.email,
      text,
      audioDataUrl,
      transcript,
      bildIds,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }

  // Genauso ein "Nice-to-have": Bitrix24-Sync darf niemals das Speichern
  // der Notiz selbst verhindern, wenn der Webhook (noch) fehlt oder gerade
  // nicht erreichbar ist.
  let bitrixHinweis: string | undefined;
  try {
    await addTaskComment(params.taskId, bitrixKommentarText(note));
  } catch (err) {
    bitrixHinweis =
      err instanceof Bitrix24Error
        ? err.message
        : "Konnte nicht als Kommentar in Bitrix24 gepostet werden.";
  }

  // Auch die Kernteam-Benachrichtigung darf das Speichern nie blockieren.
  try {
    const inhalt =
      note.transcript ??
      note.text ??
      (note.bildIds?.length ? "(Bild angehängt)" : "(Sprachnotiz ohne Text)");
    await benachrichtigeKernteam({
      kernteam: project.kernteam,
      ausloeserEmail: session.email,
      subject: `Neue Notiz von ${session.name} · ${project.name}`,
      html: `
        <p>Hallo,</p>
        <p>${session.name} hat im Projekt <strong>${project.name}</strong> eine neue Notiz zu einer Aufgabe hinterlegt:</p>
        <p style="white-space: pre-line;">${inhalt}</p>
      `,
    });
  } catch {
    // Best-effort.
  }

  return NextResponse.json({ note, vertextungHinweis, bitrixHinweis });
}
