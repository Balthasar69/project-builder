"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CoachNachricht } from "@/lib/types";
import Diktierknopf from "./Diktierknopf";

/**
 * Gründercoach-Bot-Chat für die Phase "Idee & Team" (siehe
 * lib/gruendercoach.ts) – Schwesterkomponente zu ProjectChat.tsx, aber mit
 * einem KI-Gesprächspartner statt nur Team-intern. Öffnet sich beim ersten
 * Anzeigen (falls noch kein Verlauf existiert) automatisch mit einer
 * Eröffnungsantwort des Bots, sonst wird nur der bestehende, projektweit
 * geteilte Verlauf geladen.
 */
export default function GruendercoachChat({
  slug,
  initial,
  sessionEmail,
}: {
  slug: string;
  initial: CoachNachricht[];
  sessionEmail: string;
}) {
  const [nachrichten, setNachrichten] = useState<CoachNachricht[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const eroeffnungAusgeloest = useRef(false);

  async function nachladen() {
    try {
      const res = await fetch(`/api/projects/${slug}/coach`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { coachChat?: CoachNachricht[] };
      if (data.coachChat) setNachrichten(data.coachChat);
    } catch {
      // Stiller Fehlschlag beim automatischen Nachladen.
    }
  }

  async function anfrageSenden(nachricht: string) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nachricht }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Anfrage fehlgeschlagen");
      setNachrichten(data.coachChat ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    // Nur beim allerersten Öffnen (noch gar kein Verlauf) von sich aus eine
    // Eröffnungsantwort anstoßen – nicht bei jedem erneuten Aufruf der
    // Seite, sonst würde der gemeinsame Verlauf zugespammt.
    if (!eroeffnungAusgeloest.current && initial.length === 0) {
      eroeffnungAusgeloest.current = true;
      anfrageSenden("");
    }
    const intervall = setInterval(nachladen, 15000);
    return () => clearInterval(intervall);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight });
  }, [nachrichten.length]);

  async function senden(e: FormEvent) {
    e.preventDefault();
    const getrimmt = text.trim();
    if (!getrimmt || sending) return;
    setText("");
    await anfrageSenden(getrimmt);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={listeRef}
        className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto rounded-lg border border-line bg-surface p-4"
      >
        {nachrichten.length === 0 && !sending && (
          <p className="text-sm text-ink-faint">
            Noch keine Nachrichten – schreib die erste, oder warte kurz auf die Begrüßung.
          </p>
        )}
        {nachrichten.map((n) => {
          const istBot = n.rolle === "bot";
          const eigene = !istBot && n.autorEmail?.toLowerCase() === sessionEmail.toLowerCase();
          return (
            <div
              key={n.id}
              className={`flex flex-col ${istBot ? "items-start" : eigene ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  istBot
                    ? "border border-accent/40 bg-accent/10 text-ink"
                    : eigene
                      ? "bg-accent text-surface"
                      : "border border-line bg-surface-2 text-ink"
                }`}
              >
                {n.text}
              </div>
              <span className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-ink-faint">
                {istBot ? "🧭 Gründercoach-Bot" : eigene ? "Du" : n.autorName} ·{" "}
                {new Date(n.erstelltAm).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
        {sending && (
          <div className="flex flex-col items-start">
            <div className="max-w-[85%] rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-ink-faint">
              Der Gründercoach-Bot denkt nach …
            </div>
          </div>
        )}
      </div>

      <form onSubmit={senden} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Frag den Gründercoach-Bot …"
            disabled={sending}
            className="w-full rounded-full border border-line bg-surface px-4 py-2 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-60"
          />
          <Diktierknopf
            onText={(erkannt) =>
              setText((bisher) => (bisher ? `${bisher} ${erkannt}` : erkannt))
            }
            className="absolute right-1 top-1/2 -translate-y-1/2"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Senden"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
          </svg>
        </button>
      </form>
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
