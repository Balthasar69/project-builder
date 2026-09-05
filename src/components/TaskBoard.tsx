"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bitrix24Task } from "@/lib/types";
import TaskNotes from "./TaskNotes";
import TaskAnalyse from "./TaskAnalyse";

// Fallback-Beschriftung für den älteren, technischen Bitrix24-Status
// (Standard-Codes 1–7) – wird nur verwendet, wenn eine Aufgabe keine echte,
// selbst benannte Kanban-Spalte aus Bitrix24 mitbringt (Feld `stage`, siehe
// src/lib/bitrix24.ts). Das ist der Normalfall bei ganz neuen bzw. noch nie
// manuell verschobenen Aufgaben.
const BITRIX_TASK_STATUS: Record<string, { label: string; klasse: string }> = {
  "1": { label: "Neu", klasse: "bg-surface-2 text-ink-muted" },
  "2": { label: "Neu", klasse: "bg-surface-2 text-ink-muted" },
  "3": { label: "In Arbeit", klasse: "bg-accent-soft text-accent-ink" },
  "4": { label: "Zur Kontrolle", klasse: "bg-warn-soft text-warn" },
  "5": { label: "Erledigt", klasse: "bg-good-soft text-good" },
  "6": { label: "Aufgeschoben", klasse: "bg-surface-2 text-ink-muted" },
  "7": { label: "Abgelehnt", klasse: "bg-bad-soft text-bad" },
};

function statusFallbackBadge(status: string) {
  return BITRIX_TASK_STATUS[status] ?? BITRIX_TASK_STATUS["1"];
}

// Wandelt eine Bitrix24-Farbe (z. B. "00C4FB") in einen leicht transparenten
// Hintergrundton fürs Label um. Fällt bei unbekannten/fehlerhaften Werten
// auf ein neutrales Grau zurück, statt kaputt auszusehen.
function hexZuHintergrund(hex: string | undefined, alpha: number): string {
  const wert = parseInt((hex ?? "").replace("#", ""), 16);
  if (Number.isNaN(wert)) return `rgba(140, 140, 140, ${alpha})`;
  const r = (wert >> 16) & 255;
  const g = (wert >> 8) & 255;
  const b = wert & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Zeigt die echte, in Bitrix24 selbst benannte Kanban-Spalte (Name + Farbe)
// einer Aufgabe – oder, falls diese Arbeitsgruppe (noch) keine eigenen
// Spalten nutzt, ersatzweise den technischen Status.
function statusBadge(t: Bitrix24Task): { label: string; style?: React.CSSProperties; klasse?: string } {
  if (t.stage) {
    return {
      label: t.stage.title,
      style: {
        backgroundColor: hexZuHintergrund(t.stage.color, 0.16),
        color: t.stage.color ? `#${t.stage.color}` : undefined,
      },
    };
  }
  const fallback = statusFallbackBadge(t.status);
  return { label: fallback.label, klasse: fallback.klasse };
}

// Sortierung: nach der echten Bitrix24-Spaltenreihenfolge (Feld
// `stage.sort`), wenn vorhanden – das entspricht genau der Reihenfolge der
// Spalten von links nach rechts im Bitrix24-Kanban-Board. Aufgaben ohne
// eigene Spalte fallen auf die grobe Reihenfolge des technischen Status
// zurück.
const STATUS_REIHENFOLGE: Record<string, number> = {
  "1": 0,
  "2": 0,
  "3": 1000,
  "4": 2000,
  "5": 3000,
  "6": 4000,
  "7": 5000,
};

function sortSchluessel(t: Bitrix24Task): number {
  if (t.stage) return t.stage.sort;
  return STATUS_REIHENFOLGE[t.status] ?? 0;
}

export default function TaskBoard({
  slug,
  groupId,
}: {
  slug: string;
  groupId?: number;
}) {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [tasks, setTasks] = useState<Bitrix24Task[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [offenNotizen, setOffenNotizen] = useState<string | null>(null);
  const [offeneAnalyse, setOffeneAnalyse] = useState<string | null>(null);

  async function ladeAufgaben() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/tasks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen");
      setTasks(data.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (groupId) ladeAufgaben();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function verbinden() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/bitrix24/connect`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verbinden fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setConnecting(false);
    }
  }

  async function hinzufuegen(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Anlegen fehlgeschlagen");
      setTitle("");
      await ladeAufgaben();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  if (!groupId) {
    return (
      <div>
        <p className="mb-4 text-sm text-ink-muted">
          Noch keine Bitrix24-Arbeitsgruppe verbunden. Damit bekommt dieses
          Projekt eine eigene Aufgabenliste in Bitrix24, die hier direkt
          bearbeitet werden kann.
        </p>
        <button
          type="button"
          onClick={verbinden}
          disabled={connecting}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {connecting ? "Verbindet…" : "Mit Bitrix24 verbinden"}
        </button>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={hinzufuegen} className="mb-4 flex gap-2">
        <input
          type="text"
          required
          placeholder="Hast du eine neue Idee? Dann gib ihr einen Titel und füge sie hinzu."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Legt an…" : "Hinzufügen"}
        </button>
      </form>
      {error && <p className="mb-4 text-sm text-bad">{error}</p>}

      {loading && tasks === null && (
        <p className="mb-4 text-sm text-ink-muted">Lädt Aufgaben…</p>
      )}
      {tasks && tasks.length === 0 && (
        <p className="mb-4 text-sm text-ink-muted">Noch keine Aufgaben.</p>
      )}
      {tasks && tasks.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {[...tasks]
            .sort((a, b) => sortSchluessel(a) - sortSchluessel(b))
            .map((t) => {
              const badge = statusBadge(t);
              return (
            <div
              key={t.id}
              className="rounded-md border border-line bg-surface px-4 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`text-sm font-medium ${
                    t.erledigt ? "text-ink-faint line-through" : "text-ink"
                  }`}
                >
                  {t.title}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide ${
                      badge.klasse ?? ""
                    }`}
                    style={badge.style}
                  >
                    {badge.label}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setOffeneAnalyse((o) => (o === t.id ? null : t.id))
                    }
                    className="font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-accent"
                  >
                    {offeneAnalyse === t.id
                      ? "Mit KI bearbeiten ▲"
                      : "Mit KI bearbeiten ▾"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOffenNotizen((o) => (o === t.id ? null : t.id))
                    }
                    className="font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-accent"
                  >
                    {offenNotizen === t.id ? "Notizen ▲" : "Notizen ▾"}
                  </button>
                </div>
              </div>
              {offeneAnalyse === t.id && (
                <TaskAnalyse slug={slug} taskId={t.id} titel={t.title} />
              )}
              {offenNotizen === t.id && <TaskNotes slug={slug} taskId={t.id} />}
            </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
