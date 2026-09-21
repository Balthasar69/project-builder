"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CHAT_BEARBEITEN_MINUTEN, ChatNachricht } from "@/lib/types";
import Diktierknopf from "./Diktierknopf";

/**
 * Interner Team-Chat je Projekt (neu seit v0.46) – nur für Kernteam & Team
 * dieses Projekts sichtbar. Bewusst einfach gehalten: kein Websocket/
 * Realtime-Server, sondern ein regelmäßiges Nachladen (alle 15 Sekunden)
 * plus sofortiges Nachladen nach dem eigenen Senden. Reicht für ein
 * projektinternes Team, ohne zusätzliche Infrastruktur.
 *
 * Bearbeiten: die eigene Nachricht lässt sich innerhalb von
 * `CHAT_BEARBEITEN_MINUTEN` nach dem Senden ändern (z. B. Tippfehler),
 * Admins dürfen zusätzlich jede fremde Nachricht jederzeit bearbeiten.
 */
export default function ProjectChat({
  slug,
  initial,
  sessionEmail,
  istAdmin,
}: {
  slug: string;
  initial: ChatNachricht[];
  sessionEmail: string;
  istAdmin: boolean;
}) {
  const [nachrichten, setNachrichten] = useState<ChatNachricht[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listeRef = useRef<HTMLDivElement>(null);

  const [bearbeitenId, setBearbeitenId] = useState<string | null>(null);
  const [bearbeitenText, setBearbeitenText] = useState("");
  const [bearbeitenLaeuft, setBearbeitenLaeuft] = useState(false);
  const [bearbeitenFehler, setBearbeitenFehler] = useState<string | null>(null);

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

  function darfBearbeiten(n: ChatNachricht): boolean {
    if (istAdmin) return true;
    const eigene = n.autorEmail.toLowerCase() === sessionEmail.toLowerCase();
    if (!eigene) return false;
    const alterInMinuten = (Date.now() - new Date(n.erstelltAm).getTime()) / 60000;
    return alterInMinuten <= CHAT_BEARBEITEN_MINUTEN;
  }

  function bearbeitenStarten(n: ChatNachricht) {
    setBearbeitenId(n.id);
    setBearbeitenText(n.text);
    setBearbeitenFehler(null);
  }

  function bearbeitenAbbrechen() {
    setBearbeitenId(null);
    setBearbeitenFehler(null);
  }

  async function bearbeitenSpeichern(e: FormEvent, nachrichtId: string) {
    e.preventDefault();
    const getrimmt = bearbeitenText.trim();
    if (!getrimmt) return;
    setBearbeitenLaeuft(true);
    setBearbeitenFehler(null);
    try {
      const res = await fetch(`/api/projects/${slug}/chat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nachrichtId, text: getrimmt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
      setNachrichten(data.chat ?? []);
      setBearbeitenId(null);
    } catch (err) {
      setBearbeitenFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBearbeitenLaeuft(false);
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
          const wirdBearbeitet = bearbeitenId === n.id;
          return (
            <div
              key={n.id}
              className={`flex flex-col ${eigene ? "items-end" : "items-start"}`}
            >
              {wirdBearbeitet ? (
                <form
                  onSubmit={(e) => bearbeitenSpeichern(e, n.id)}
                  className="w-full max-w-[80%] rounded-lg border border-accent bg-surface p-2"
                >
                  <textarea
                    value={bearbeitenText}
                    onChange={(e) => setBearbeitenText(e.target.value)}
                    rows={2}
                    autoFocus
                    className="w-full resize-none rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                  <div className="mt-1.5 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={bearbeitenLaeuft || !bearbeitenText.trim()}
                      className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {bearbeitenLaeuft ? "Speichert…" : "Speichern"}
                    </button>
                    <button
                      type="button"
                      onClick={bearbeitenAbbrechen}
                      disabled={bearbeitenLaeuft}
                      className="font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-ink"
                    >
                      Abbrechen
                    </button>
                  </div>
                  {bearbeitenFehler && (
                    <p className="mt-1 text-xs text-bad">{bearbeitenFehler}</p>
                  )}
                </form>
              ) : (
                <div
                  className={`group max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    eigene
                      ? "bg-accent text-surface"
                      : "border border-line bg-surface-2 text-ink"
                  }`}
                >
                  {n.text}
                </div>
              )}
              <span className="mt-0.5 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-wide text-ink-faint">
                {eigene ? "Du" : n.autorName} ·{" "}
                {new Date(n.erstelltAm).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {n.bearbeitetAm && " · bearbeitet"}
                {!wirdBearbeitet && darfBearbeiten(n) && (
                  <button
                    type="button"
                    onClick={() => bearbeitenStarten(n)}
                    className="normal-case tracking-normal text-ink-faint underline decoration-dotted hover:text-accent"
                  >
                    Bearbeiten
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <form onSubmit={senden} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nachricht schreiben …"
            className="w-full rounded-full border border-line bg-surface px-4 py-2 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
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
