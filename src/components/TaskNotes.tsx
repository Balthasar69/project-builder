"use client";

import { useEffect, useRef, useState } from "react";
import { TaskNote } from "@/lib/types";

// Max. Aufnahmedauer als Sicherheitsnetz gegen zu große Dateien (die Route
// lehnt ohnehin alles über ca. 2,2 MB Audio serverseitig ab).
const MAX_AUFNAHME_SEKUNDEN = 120;

function formatiereZeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TaskNotes({
  slug,
  taskId,
}: {
  slug: string;
  taskId: string;
}) {
  const [notes, setNotes] = useState<TaskNote[] | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [senden, setSenden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const [aufnahmeLaeuft, setAufnahmeLaeuft] = useState(false);
  const [aufnahmeSekunden, setAufnahmeSekunden] = useState(0);
  const [audioVorschau, setAudioVorschau] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function laden() {
    setLadefehler(null);
    try {
      const res = await fetch(`/api/projects/${slug}/tasks/${taskId}/notes`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen");
      setNotes(data.notes);
    } catch (err) {
      setLadefehler(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }

  useEffect(() => {
    laden();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function aufnahmeStarten() {
    setError(null);
    setAudioVorschau(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Dieser Browser unterstützt keine Sprachaufnahme.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const reader = new FileReader();
        reader.onload = () => setAudioVorschau(reader.result as string);
        reader.readAsDataURL(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
      setAufnahmeLaeuft(true);
      setAufnahmeSekunden(0);
      timerRef.current = setInterval(() => {
        setAufnahmeSekunden((s) => {
          if (s + 1 >= MAX_AUFNAHME_SEKUNDEN) {
            aufnahmeStoppen();
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError(
        "Zugriff aufs Mikrofon wurde nicht erlaubt. Bitte in den Browser-Einstellungen freigeben."
      );
    }
  }

  function aufnahmeStoppen() {
    recorderRef.current?.stop();
    setAufnahmeLaeuft(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function aufnahmeVerwerfen() {
    setAudioVorschau(null);
  }

  async function speichern() {
    if (!text.trim() && !audioVorschau) return;
    setSenden(true);
    setError(null);
    setHinweis(null);
    try {
      const res = await fetch(`/api/projects/${slug}/tasks/${taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          audioDataUrl: audioVorschau || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
      setText("");
      setAudioVorschau(null);
      // Vertextung/Bitrix24-Sync sind "Nice-to-haves": schlagen sie fehl,
      // wird die Notiz trotzdem gespeichert – nur mit einem Hinweis statt
      // eines Fehlers, ähnlich wie beim Einladungs-E-Mail-Versand.
      const hinweise = [data.vertextungHinweis, data.bitrixHinweis].filter(
        Boolean
      );
      if (hinweise.length > 0) setHinweis(hinweise.join(" · "));
      // Die neue Notiz direkt aus der Server-Antwort übernehmen, statt auf
      // einen zweiten Abruf (laden()) zu warten: bei Sprachnotizen dauert
      // das Speichern durch Vertextung, Bitrix24-Kommentar und
      // E-Mail-Benachrichtigung spürbar länger, und ein erneuter Abruf
      // direkt danach zeigte die gerade gespeicherte Notiz nicht immer
      // zuverlässig an (erst nach vollständigem Neuladen der Seite). So ist
      // die neue Notiz sofort sichtbar, unabhängig davon.
      if (data.note) {
        setNotes((bisherige) => [...(bisherige ?? []), data.note]);
      } else {
        await laden();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSenden(false);
    }
  }

  return (
    <div className="mt-2 rounded-md border border-line bg-surface-2 p-3">
      {ladefehler && <p className="text-sm text-bad">{ladefehler}</p>}
      {notes === null && !ladefehler && (
        <p className="text-xs text-ink-faint">Lädt Notizen…</p>
      )}
      {notes && notes.length === 0 && (
        <p className="text-xs text-ink-faint">
          Noch keine Notizen zu dieser Aufgabe.
        </p>
      )}
      {notes && notes.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-md border border-line bg-surface p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-ink">{n.authorName}</span>
                <span className="font-mono text-[0.65rem] text-ink-faint">
                  {formatiereZeit(n.erstelltAm)}
                </span>
              </div>
              {n.text && <p className="text-sm text-ink-muted">{n.text}</p>}
              {n.audioDataUrl && (
                <audio controls src={n.audioDataUrl} className="mt-1.5 w-full" />
              )}
              {n.transcript && (
                <p className="mt-1.5 text-sm italic text-ink-muted">
                  „{n.transcript}“
                </p>
              )}
              {n.audioDataUrl && !n.transcript && (
                <p className="mt-1.5 text-xs text-ink-faint">
                  Nicht vertextet.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Notiz schreiben…"
          className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />

        {audioVorschau && (
          <div className="flex items-center gap-2">
            <audio controls src={audioVorschau} className="h-9 flex-1" />
            <button
              type="button"
              onClick={aufnahmeVerwerfen}
              className="font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-bad"
            >
              Verwerfen
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {!aufnahmeLaeuft ? (
            <button
              type="button"
              onClick={aufnahmeStarten}
              disabled={!!audioVorschau}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              🎤 Sprachnotiz aufnehmen
            </button>
          ) : (
            <button
              type="button"
              onClick={aufnahmeStoppen}
              className="rounded-md bg-bad px-3 py-1.5 text-xs font-medium text-surface transition hover:opacity-90"
            >
              ■ Stopp ({aufnahmeSekunden}s)
            </button>
          )}
          <button
            type="button"
            onClick={speichern}
            disabled={senden || (!text.trim() && !audioVorschau)}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {senden
              ? audioVorschau
                ? "Speichert … (Vertextung kann etwas dauern)"
                : "Speichert…"
              : "Notiz speichern"}
          </button>
        </div>
        <p className="text-[0.65rem] text-ink-faint">
          Erscheint automatisch auch als Kommentar bei der Aufgabe in
          Bitrix24; Sprachnotizen werden zusätzlich automatisch vertextet.
        </p>
      </div>

      {hinweis && <p className="mt-2 text-xs text-warn">{hinweis}</p>}
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </div>
  );
}
