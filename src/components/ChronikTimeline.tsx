"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ChronikZeile } from "@/lib/chronik";
import { CHRONIK_MAX_ZEICHEN } from "@/lib/types";

function heute(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function datumAnzeigen(datum: string): string {
  const [j, m, t] = datum.split("-");
  return `${t}.${m}.${j}`;
}

/**
 * Projekt-Chronik: Zeitleiste "Was ist wann passiert?", neueste zuerst.
 * Jedes Projektmitglied kann eigene Einträge ergänzen – bewusst nur Datum +
 * Kurzbeschreibung. Automatisch erkannte Ereignisse sind grau markiert.
 */
export default function ChronikTimeline({
  slug,
  zeilen,
  sessionEmail,
  istKernteam,
}: {
  slug: string;
  zeilen: ChronikZeile[];
  sessionEmail: string;
  istKernteam: boolean;
}) {
  const router = useRouter();
  const [datum, setDatum] = useState(heute());
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loeschtId, setLoeschtId] = useState<string | null>(null);
  const [alleZeigen, setAlleZeigen] = useState(false);

  const SICHTBAR = 15;
  const angezeigt = alleZeigen ? zeilen : zeilen.slice(0, SICHTBAR);

  async function hinzufuegen(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/chronik`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datum, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
      setText("");
      setDatum(heute());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function loeschen(z: ChronikZeile) {
    if (!z.id) return;
    if (!window.confirm(`Eintrag „${z.text}" wirklich löschen?`)) return;
    setLoeschtId(z.id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/chronik`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: z.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoeschtId(null);
    }
  }

  function darfLoeschen(z: ChronikZeile): boolean {
    if (!z.id) return false;
    if (istKernteam) return true;
    return z.art === "manuell" && z.erstelltVonEmail === sessionEmail.toLowerCase();
  }

  return (
    <div>
      <form
        onSubmit={hinzufuegen}
        className="mb-6 flex flex-col gap-2 rounded-md border border-line bg-surface p-3 sm:flex-row sm:items-start"
      >
        <input
          type="date"
          required
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none sm:w-44"
        />
        <input
          type="text"
          required
          maxLength={CHRONIK_MAX_ZEICHEN}
          placeholder="Kurzbeschreibung, z. B. Erstes Gespräch mit Juwelier"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Speichert…" : "Eintragen"}
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-bad">{error}</p>}

      {zeilen.length === 0 ? (
        <p className="text-sm text-ink-faint">Noch keine Einträge.</p>
      ) : (
        <ol className="relative ml-2 border-l-2 border-line">
          {angezeigt.map((z, idx) => (
            <li key={z.id ?? `${z.datum}-${idx}`} className="relative mb-4 pl-5 last:mb-0">
              <span
                aria-hidden
                className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-surface ${
                  z.art === "manuell" ? "bg-accent" : "bg-ink-faint"
                }`}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-ink-faint">
                    {datumAnzeigen(z.datum)}
                  </p>
                  <p className={`text-sm ${z.art === "manuell" ? "text-ink" : "text-ink-faint"}`}>
                    {z.text}
                  </p>
                  {z.wer && (
                    <p className="mt-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
                      {z.wer}
                    </p>
                  )}
                </div>
                {darfLoeschen(z) && (
                  <button
                    type="button"
                    onClick={() => loeschen(z)}
                    disabled={loeschtId === z.id}
                    className="shrink-0 font-mono text-xs uppercase tracking-wide text-bad transition hover:text-accent-ink disabled:opacity-40"
                  >
                    {loeschtId === z.id ? "…" : "Löschen"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {zeilen.length > SICHTBAR && (
        <button
          type="button"
          onClick={() => setAlleZeigen((v) => !v)}
          className="mt-4 font-mono text-xs uppercase tracking-wide text-accent hover:text-accent-ink"
        >
          {alleZeigen ? "Weniger anzeigen" : `Alle ${zeilen.length} Einträge anzeigen`}
        </button>
      )}
    </div>
  );
}
