"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Zeigt die Projektbeschreibung an. Kernteam-Mitglieder und Admins
 * (`darfBearbeiten`) können sie über einen kleinen "Bearbeiten"-Link
 * direkt hier ändern, ohne eine eigene Unterseite zu brauchen.
 */
export default function ProjectDescription({
  slug,
  beschreibung,
  darfBearbeiten,
}: {
  slug: string;
  beschreibung: string;
  darfBearbeiten: boolean;
}) {
  const router = useRouter();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [text, setText] = useState(beschreibung);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function speichern() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/beschreibung`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beschreibung: text }),
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
      <div className="mb-8">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Worum geht es in diesem Projekt? (für alle Teammitglieder sichtbar)"
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={speichern}
            disabled={saving}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
          <button
            type="button"
            onClick={() => {
              setBearbeiten(false);
              setText(beschreibung);
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

  if (!beschreibung) {
    return darfBearbeiten ? (
      <button
        type="button"
        onClick={() => setBearbeiten(true)}
        className="mb-8 text-sm text-ink-faint underline decoration-dotted hover:text-accent"
      >
        + Projektbeschreibung hinzufügen
      </button>
    ) : null;
  }

  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <p className="max-w-[65ch] whitespace-pre-line text-ink-muted">
        {beschreibung}
      </p>
      {darfBearbeiten && (
        <button
          type="button"
          onClick={() => setBearbeiten(true)}
          className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-accent"
        >
          Bearbeiten
        </button>
      )}
    </div>
  );
}
