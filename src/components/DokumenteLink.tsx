"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Zeigt den Link zur externen Dokumenten-Ablage des Projekts an (aktuell:
 * ein Google-Drive-Ordner – kein OAuth, keine API-Anbindung, nur die URL
 * wird gespeichert). Kernteam-Mitglieder und Admins (`darfBearbeiten`)
 * können den Link über einen kleinen "Bearbeiten"-Link direkt hier setzen
 * oder ändern. Die Zugriffsrechte innerhalb des Ordners regelt weiterhin
 * ganz normal die Freigabe-Einstellung in Google Drive selbst.
 */
export default function DokumenteLink({
  slug,
  dokumenteLink,
  darfBearbeiten,
}: {
  slug: string;
  dokumenteLink: string;
  darfBearbeiten: boolean;
}) {
  const router = useRouter();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [url, setUrl] = useState(dokumenteLink);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function speichern() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/dokumente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dokumenteLink: url }),
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
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link zum Google-Drive-Ordner (z. B. https://drive.google.com/drive/folders/…)"
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
              setUrl(dokumenteLink);
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

  if (!dokumenteLink) {
    return darfBearbeiten ? (
      <button
        type="button"
        onClick={() => setBearbeiten(true)}
        className="mb-8 text-sm text-ink-faint underline decoration-dotted hover:text-accent"
      >
        + Link zur Dokumenten-Ablage (Google Drive) hinzufügen
      </button>
    ) : null;
  }

  return (
    <div className="mb-8 flex flex-wrap items-center gap-4">
      <a
        href={dokumenteLink}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-2.5 rounded-md bg-accent px-6 py-3.5 text-base font-semibold text-surface shadow-sm transition hover:bg-accent-ink"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <path d="M15 3h6v6" />
          <path d="M10 14L21 3" />
        </svg>
        Dokumenten-Ablage öffnen
      </a>
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
