"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BlockHinweisKey } from "@/lib/types";

/**
 * Kurzanweisung unter einer Cockpit-Überschrift (z. B. "Team", "Aufgaben").
 * Zeigt den individuellen Text des Projekts, sonst den Standardtext. Kern-
 * team-Mitglieder und Admins (`darfBearbeiten`) können den Text hier direkt
 * ändern oder wieder auf den Standardtext zurücksetzen (= leer speichern).
 */
export default function BlockHinweis({
  slug,
  blockKey,
  individuellerText,
  standardText,
  darfBearbeiten,
}: {
  slug: string;
  blockKey: BlockHinweisKey;
  individuellerText: string;
  standardText: string;
  darfBearbeiten: boolean;
}) {
  const router = useRouter();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [text, setText] = useState(individuellerText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function speichern(neuerText: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/hinweise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: blockKey, text: neuerText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
      setBearbeiten(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  if (bearbeiten) {
    return (
      <div className="mb-4 rounded-md border border-line bg-surface-2 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={standardText}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => speichern(text)}
            disabled={saving}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
          {individuellerText && (
            <button
              type="button"
              onClick={() => {
                setText("");
                speichern("");
              }}
              disabled={saving}
              className="text-sm text-ink-muted hover:text-ink"
            >
              Standardtext verwenden
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setBearbeiten(false);
              setText(individuellerText);
              setError(null);
            }}
            className="text-sm text-ink-muted hover:text-ink"
          >
            Abbrechen
          </button>
          {error && <span className="text-sm text-bad">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <p className="text-sm text-ink-muted">{individuellerText || standardText}</p>
      {darfBearbeiten && (
        <button
          type="button"
          onClick={() => setBearbeiten(true)}
          className="shrink-0 whitespace-nowrap font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint hover:text-accent"
        >
          Bearbeiten
        </button>
      )}
    </div>
  );
}
