"use client";

import { useEffect, useState } from "react";
import { AufgabenAnalyse } from "@/lib/types";

function formatiereZeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Bereich unter "Mit KI bearbeiten ▾": zeigt eine bereits von Claude erstellte
 * Hilfestellung zu dieser Aufgabe (falls vorhanden) und bietet den Button,
 * um eine neue Einschätzung anzufordern bzw. die vorhandene zu erneuern.
 */
export default function TaskAnalyse({
  slug,
  taskId,
  titel,
}: {
  slug: string;
  taskId: string;
  titel: string;
}) {
  // undefined = wird noch geladen, null = geladen, aber noch keine vorhanden
  const [analyse, setAnalyse] = useState<AufgabenAnalyse | null | undefined>(
    undefined
  );
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [erstellt, setErstellt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speicherHinweis, setSpeicherHinweis] = useState<string | null>(null);

  async function laden() {
    setLadefehler(null);
    try {
      const res = await fetch(`/api/projects/${slug}/tasks/${taskId}/analyse`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen");
      setAnalyse(data.analyse ?? null);
    } catch (err) {
      setLadefehler(err instanceof Error ? err.message : "Unbekannter Fehler");
      setAnalyse(null);
    }
  }

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function analysieren() {
    setErstellt(true);
    setError(null);
    setSpeicherHinweis(null);
    try {
      const res = await fetch(`/api/projects/${slug}/tasks/${taskId}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analyse fehlgeschlagen");
      setAnalyse(data.analyse);
      if (data.speicherHinweis) setSpeicherHinweis(data.speicherHinweis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setErstellt(false);
    }
  }

  return (
    <div className="mt-2 rounded-md border border-line bg-surface-2 p-3">
      {ladefehler && <p className="text-sm text-bad">{ladefehler}</p>}
      {analyse === undefined && !ladefehler && (
        <p className="text-xs text-ink-faint">Lädt…</p>
      )}

      {analyse && (
        <div className="mb-3 rounded-md border border-line bg-surface p-2.5">
          <p className="text-sm text-ink-muted">{analyse.text}</p>
          <p className="mt-1.5 font-mono text-[0.65rem] text-ink-faint">
            Erstellt {formatiereZeit(analyse.erstelltAm)}
          </p>
        </div>
      )}

      {analyse !== undefined && (
        <button
          type="button"
          onClick={analysieren}
          disabled={erstellt}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {erstellt
            ? "Claude denkt nach…"
            : analyse
            ? "Neu einschätzen lassen"
            : "Jetzt von Claude einschätzen lassen"}
        </button>
      )}

      <p className="mt-2 text-[0.65rem] text-ink-faint">
        Automatisch erstellte Einschätzung von Claude (KI) – ein Denkanstoß,
        keine verbindliche Aussage.
      </p>

      {speicherHinweis && (
        <p className="mt-2 text-xs text-warn">{speicherHinweis}</p>
      )}
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </div>
  );
}
