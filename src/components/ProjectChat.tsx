"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatNachricht } from "@/lib/types";

/**
 * Interner Team-Chat je Projekt (neu seit v0.46) – nur für Kernteam & Team
 * dieses Projekts sichtbar. Bewusst einfach gehalten: kein Websocket/
 * Realtime-Server, sondern ein regelmäßiges Nachladen (alle 15 Sekunden)
 * plus sofortiges Nachladen nach dem eigenen Senden. Reicht für ein
 * projektinternes Team, ohne zusätzliche Infrastruktur.
 */
export default function ProjectChat({
  slug,
  initial,
  sessionEmail,
}: {
  slug: string;
  initial: ChatNachricht[];
  sessionEmail: string;
}) {
  const [nachrichten, setNachrichten] = useState<ChatNachricht[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listeRef = useRef<HTMLDivElement>(null);

  async function nachladen() {
    try {
      const res = await fetch(`/api/projects/${slug}/chat`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { chat?: ChatNachricht[] };
      if (data.chat) setNachrichten(data.chat);
    } catch {
      // Stiller Fehlschlag beim automatischen Nachladen – wird beim
      // nächsten Intervall erneut versucht, keine Fehlermeldung nötig.
    }
  }

  useEffect(() => {
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
    if (!getrimmt) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: getrimmt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Senden fehlgeschlagen");
      setNachrichten(data.chat ?? []);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={listeRef}
        className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto rounded-lg border border-line bg-surface p-4"
      >
        {nachrichten.length === 0 && (
          <p className="text-sm text-ink-faint">
            Noch keine Nachrichten – schreib die erste.
          </p>
        )}
        {nachrichten.map((n) => {
          const eigene = n.autorEmail.toLowerCase() === sessionEmail.toLowerCase();
          return (
            <div
              key={n.id}
              className={`flex flex-col ${eigene ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  eigene
                    ? "bg-accent text-surface"
                    : "border border-line bg-surface-2 text-ink"
                }`}
              >
                {n.text}
              </div>
              <span className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-ink-faint">
                {eigene ? "Du" : n.autorName} ·{" "}
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
      </div>

      <form onSubmit={senden} className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nachricht schreiben …"
          className="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
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
