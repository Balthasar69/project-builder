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
 *
 * Seit v0.75 steht dieser Button direkt neben "Zur Steuerung" (siehe
 * SteuerungUebergang.tsx) und übernimmt darum dieselbe `hervorgehoben`-
 * Logik für die Button-Größe, damit beide immer gleich groß sind.
 */
function GoogleDriveIcon({ className }: { className?: string }) {
  // Vereinfachtes, wiedererkennbares Google-Drive-Dreieck (gelb/grün/blau),
  // keine 1:1-Reproduktion des offiziellen Markenzeichens, sondern ein
  // eigenes, an Google Drive angelehntes Symbol zur Wiedererkennung.
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points="12,2 16,9 8,9" fill="#FFC107" />
      <polygon points="8,9 2,20 12,20 12,9" fill="#0F9D58" />
      <polygon points="16,9 22,20 12,20 12,9" fill="#4285F4" />
    </svg>
  );
}

export default function DokumenteLink({
  slug,
  dokumenteLink,
  darfBearbeiten,
  hervorgehoben = false,
}: {
  slug: string;
  dokumenteLink: string;
  darfBearbeiten: boolean;
  hervorgehoben?: boolean;
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

  // Dieselben zwei Größen wie der Button "Zur Steuerung" (siehe
  // SteuerungUebergang.tsx), damit beide Buttons nebeneinander immer
  // gleich groß sind.
  const stilOffen = hervorgehoben
    ? "inline-flex w-fit items-center gap-2.5 rounded-md bg-accent px-6 py-3.5 text-base font-semibold text-surface shadow-sm transition hover:bg-accent-ink"
    : "inline-flex w-fit items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink";
  const stilHinzufuegen = hervorgehoben
    ? "inline-flex w-fit items-center gap-2.5 rounded-md border-2 border-dashed border-accent/50 px-6 py-3.5 text-base font-semibold text-accent transition hover:border-accent hover:bg-accent-soft/40"
    : "inline-flex w-fit items-center gap-2 rounded-md border-2 border-dashed border-accent/50 px-4 py-2 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent-soft/40";
  const iconGroesse = hervorgehoben ? "h-[18px] w-[18px]" : "h-4 w-4";

  if (bearbeiten) {
    return (
      <div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link zum Google-Drive-Ordner (z. B. https://drive.google.com/drive/folders/…)"
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none sm:w-96"
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
      <button type="button" onClick={() => setBearbeiten(true)} className={stilHinzufuegen}>
        <GoogleDriveIcon className={iconGroesse} />
        Link zur Dokumenten-Ablage (Google Drive) hinzufügen
      </button>
    ) : null;
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <a href={dokumenteLink} target="_blank" rel="noreferrer" className={stilOffen}>
        <GoogleDriveIcon className={iconGroesse} />
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
