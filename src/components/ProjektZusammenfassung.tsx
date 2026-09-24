"use client";

import { useEffect, useState } from "react";
import { ProjektZusammenfassung as ProjektZusammenfassungTyp } from "@/lib/types";

function formatiereZeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Sehr einfache Darstellung des KI-Textes: Zeilen, die mit "## " beginnen,
 *  werden als Zwischenueberschrift dargestellt, alle anderen als Absaetze
 *  (Leerzeile trennt Absaetze). Bewusst kein vollwertiger Markdown-Renderer
 *  - der Prompt gibt nur dieses eine Muster vor (siehe projektZusammenfassung.ts). */
function ZusammenfassungText({ text }: { text: string }) {
  const bloecke = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-4">
      {bloecke.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h3 key={i} className="font-display text-base font-semibold text-ink">
              {block.replace(/^##\s*/, "")}
            </h3>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
            {block}
          </p>
        );
      })}
    </div>
  );
}

function ladeDateiHerunter(dateiname: string, inhalt: string) {
  const blob = new Blob([inhalt], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * "Projekt-Zusammenfassung" (v0.9x): zeigt die zuletzt erstellte, sehr
 * ausfuehrliche KI-Ausarbeitung des gesamten Projektverlaufs (Bewertungen,
 * Chat, Ideen, Kompetenzen, Aufgaben+Notizen) und bietet den Button, eine
 * neue Fassung anzufordern bzw. die vorhandene als Datei herunterzuladen.
 * Fuer alle mit Projektzugriff nutzbar (nicht nur Admins/Kernteam) - die
 * Rechteprüfung sitzt serverseitig in der API-Route.
 */
export default function ProjektZusammenfassung({
  slug,
  projektName,
}: {
  slug: string;
  projektName: string;
}) {
  // undefined = wird noch geladen, null = geladen, aber noch keine vorhanden
  const [zusammenfassung, setZusammenfassung] = useState<
    ProjektZusammenfassungTyp | null | undefined
  >(undefined);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [erstellt, setErstellt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speicherHinweis, setSpeicherHinweis] = useState<string | null>(null);

  async function laden() {
    setLadefehler(null);
    try {
      const res = await fetch(`/api/projects/${slug}/zusammenfassung`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen");
      setZusammenfassung(data.zusammenfassung ?? null);
    } catch (err) {
      setLadefehler(err instanceof Error ? err.message : "Unbekannter Fehler");
      setZusammenfassung(null);
    }
  }

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function erstellen() {
    setErstellt(true);
    setError(null);
    setSpeicherHinweis(null);
    try {
      const res = await fetch(`/api/projects/${slug}/zusammenfassung`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Zusammenfassung fehlgeschlagen");
      setZusammenfassung(data.zusammenfassung);
      if (data.speicherHinweis) setSpeicherHinweis(data.speicherHinweis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setErstellt(false);
    }
  }

  function herunterladen() {
    if (!zusammenfassung) return;
    const datum = zusammenfassung.erstelltAm.slice(0, 10);
    const dateiname = `${projektName.replace(/[^a-z0-9äöüß]+/gi, "-")}-zusammenfassung-${datum}.md`;
    ladeDateiHerunter(dateiname, zusammenfassung.text);
  }

  return (
    <div>
      {ladefehler && <p className="text-sm text-bad">{ladefehler}</p>}
      {zusammenfassung === undefined && !ladefehler && (
        <p className="text-sm text-ink-faint">Lädt…</p>
      )}

      {zusammenfassung === null && !ladefehler && (
        <p className="mb-4 text-sm text-ink-muted">
          Es gibt noch keine Zusammenfassung. Ein Klick auf den Button unten
          lässt die KI aus allen bisherigen Bewertungen, Chat-Nachrichten,
          Ideen, Kompetenz-Einträgen und Aufgaben (samt Notizen) eine
          ausführliche Ausarbeitung des Projektverlaufs erstellen.
        </p>
      )}

      {zusammenfassung && (
        <div className="mb-4 rounded-md border border-line bg-surface-2 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <p className="font-mono text-xs text-ink-faint">
              Erstellt {formatiereZeit(zusammenfassung.erstelltAm)} von{" "}
              {zusammenfassung.erstelltVonName}
            </p>
            <button
              type="button"
              onClick={herunterladen}
              className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-accent"
            >
              Als Datei herunterladen
            </button>
          </div>
          <ZusammenfassungText text={zusammenfassung.text} />
        </div>
      )}

      <button
        type="button"
        onClick={erstellen}
        disabled={erstellt}
        className="inline-flex w-fit items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {erstellt
          ? "Wird erstellt… (kann eine Weile dauern)"
          : zusammenfassung
            ? "Neu erstellen"
            : "Zusammenfassung erstellen"}
      </button>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      {speicherHinweis && (
        <p className="mt-2 text-sm text-ink-faint">{speicherHinweis}</p>
      )}
    </div>
  );
}
