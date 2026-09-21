"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bitrix24Task, Bitrix24TaskStage } from "@/lib/types";
import TaskNotes from "./TaskNotes";
import TaskAnalyse from "./TaskAnalyse";
import Diktierknopf from "./Diktierknopf";

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
// Hintergrundton um. Fällt bei unbekannten/fehlerhaften Werten auf ein
// neutrales Grau zurück, statt kaputt auszusehen.
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
function statusBadge(t: Bitrix24Task): { label: string; style?: React.CSSProperties; klasse?: string; farbe?: string } {
  if (t.stage) {
    return {
      label: t.stage.title,
      farbe: t.stage.color,
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

/** Eine Kanban-Spalte – wie im Bitrix24-Arbeitsgruppen-Board, nur zum Ansehen (kein Verschieben per Drag & Drop). */
interface Spalte {
  key: string;
  label: string;
  farbe?: string;
  klasse?: string;
  sort: number;
  tasks: Bitrix24Task[];
}

/**
 * Baut die Spalten primär aus den echten Bitrix24-Kanban-Spalten der
 * Arbeitsgruppe (`stages`, siehe `getGroupStages` in lib/bitrix24.ts) – so
 * erscheint jede Spalte genau wie im Bitrix24-Board, auch wenn sie gerade
 * leer ist (z. B. "Neu 0"), statt nur Spalten zu zeigen, in denen bereits
 * Aufgaben liegen. Nur wenn eine Arbeitsgruppe (noch) gar keine eigenen
 * Spalten hat, fällt die Funktion auf eine Gruppierung nach dem
 * technischen Status zurück.
 */
function spaltenAusTasks(tasks: Bitrix24Task[], stages: Bitrix24TaskStage[]): Spalte[] {
  const nachSchluessel = new Map<string, Spalte>();

  for (const stage of stages) {
    nachSchluessel.set(`stage:${stage.id}`, {
      key: `stage:${stage.id}`,
      label: stage.title,
      farbe: stage.color,
      sort: stage.sort,
      tasks: [],
    });
  }

  for (const t of tasks) {
    const schluessel = t.stage ? `stage:${t.stage.id}` : `status:${t.status}`;
    let spalte = nachSchluessel.get(schluessel);
    if (!spalte) {
      // Kommt nur vor, wenn die Aufgabe keiner der oben geladenen
      // Bitrix24-Spalten zugeordnet werden konnte (z. B. Arbeitsgruppe ganz
      // ohne eigene Spalten) – dann Fallback auf den technischen Status.
      const badge = statusBadge(t);
      spalte = {
        key: schluessel,
        label: badge.label,
        farbe: badge.farbe,
        klasse: badge.klasse,
        sort: sortSchluessel(t),
        tasks: [],
      };
      nachSchluessel.set(schluessel, spalte);
    }
    spalte.tasks.push(t);
  }
  return [...nachSchluessel.values()].sort((a, b) => a.sort - b.sort);
}

/**
 * Bitrix24-Arbeitsgruppe: Projekte werden seit v0.52 automatisch beim
 * Anlegen bzw. spätestens beim ersten Laden dieser Liste damit verbunden
 * (`ensureBitrixGroupId` in data.ts) – kein manueller "Verbinden"-Klick
 * mehr nötig. Nebenbei ordnet der Aufruf auch alle vorher "verlorenen",
 * schon übernommenen KI-Aufgaben-Vorschläge/Ideen automatisch nach
 * (`repariereVerwaisteBitrixAufgaben`) und meldet, wie viele das waren.
 *
 * Anzeige seit v0.9x als Kanban-Board mit echten Bitrix24-Spalten
 * nebeneinander (wie im Bitrix24-Arbeitsgruppen-Board). Karten lassen sich
 * per Drag & Drop in eine andere Spalte ziehen – das schreibt die neue
 * Spalte sofort nach Bitrix24 zurück (`moveTaskStage`/POST .../stage),
 * damit beide Ansichten synchron bleiben. Nur möglich, solange die
 * Arbeitsgruppe eigene Bitrix24-Spalten hat (`stages.length > 0`) – ohne
 * echte Spalten-IDs gäbe es kein Ziel zum Zurückschreiben.
 */
export default function TaskBoard({ slug }: { slug: string }) {
  const [tasks, setTasks] = useState<Bitrix24Task[] | null>(null);
  const [stages, setStages] = useState<Bitrix24TaskStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reparaturHinweis, setReparaturHinweis] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [offenNotizen, setOffenNotizen] = useState<string | null>(null);
  const [offeneAnalyse, setOffeneAnalyse] = useState<string | null>(null);
  const [verschiebeFehler, setVerschiebeFehler] = useState<string | null>(null);
  const [gezogenerTaskId, setGezogenerTaskId] = useState<string | null>(null);
  const [zielSpalte, setZielSpalte] = useState<string | null>(null);

  async function ladeAufgaben() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/tasks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen");
      setTasks(data.tasks);
      setStages(data.stages ?? []);
      if (typeof data.repariert === "number" && data.repariert > 0) {
        setReparaturHinweis(
          `${data.repariert} bereits übernommene Aufgabe${
            data.repariert === 1 ? "" : "n"
          }, die vorher nicht sichtbar war${
            data.repariert === 1 ? "" : "en"
          }, wurde${data.repariert === 1 ? "" : "n"} jetzt zugeordnet.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    ladeAufgaben();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const spalten = useMemo(
    () => (tasks ? spaltenAusTasks(tasks, stages) : []),
    [tasks, stages]
  );

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

  /**
   * Schreibt eine per Drag & Drop verschobene Aufgabe sofort nach
   * Bitrix24 zurück. Optimistisch: die Karte springt schon vor der Antwort
   * des Servers in die neue Spalte; schlägt das Verschieben in Bitrix24
   * fehl (z. B. keine Verbindung), springt sie automatisch zurück und es
   * erscheint eine Fehlermeldung.
   */
  async function verschieben(taskId: string, zielSpalteObj: Spalte) {
    const stageId = zielSpalteObj.key.startsWith("stage:")
      ? zielSpalteObj.key.slice("stage:".length)
      : null;
    if (!stageId || !tasks) return;

    const aktuelleAufgabe = tasks.find((t) => t.id === taskId);
    if (!aktuelleAufgabe || aktuelleAufgabe.stage?.id === stageId) return;

    const vorherigeAufgaben = tasks;
    const neueStage = stages.find((s) => s.id === stageId);
    setTasks(
      tasks.map((t) => (t.id === taskId ? { ...t, stage: neueStage ?? t.stage } : t))
    );
    setVerschiebeFehler(null);

    try {
      const res = await fetch(`/api/projects/${slug}/tasks/${taskId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verschieben fehlgeschlagen");
    } catch (err) {
      setTasks(vorherigeAufgaben);
      setVerschiebeFehler(
        err instanceof Error ? err.message : "Verschieben fehlgeschlagen"
      );
    }
  }

  function aufgabenKarte(t: Bitrix24Task) {
    const ziehbar = stages.length > 0;
    return (
      <div
        key={t.id}
        draggable={ziehbar}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", t.id);
          e.dataTransfer.effectAllowed = "move";
          setGezogenerTaskId(t.id);
        }}
        onDragEnd={() => setGezogenerTaskId(null)}
        className={`rounded-md border border-line bg-surface p-3 ${
          ziehbar ? "cursor-grab select-none active:cursor-grabbing" : ""
        } ${gezogenerTaskId === t.id ? "opacity-40" : ""}`}
        style={
          ziehbar
            ? ({ WebkitUserSelect: "none", userSelect: "none" } as React.CSSProperties)
            : undefined
        }
      >
        <p
          className={`text-sm font-medium ${
            t.erledigt ? "text-ink-faint line-through" : "text-ink"
          }`}
        >
          {t.title}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => setOffeneAnalyse((o) => (o === t.id ? null : t.id))}
            className="font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-accent"
          >
            {offeneAnalyse === t.id ? "Mit KI bearbeiten ▲" : "Mit KI bearbeiten ▾"}
          </button>
          <button
            type="button"
            onClick={() => setOffenNotizen((o) => (o === t.id ? null : t.id))}
            className="font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-accent"
          >
            {offenNotizen === t.id ? "Notizen ▲" : "Notizen ▾"}
          </button>
        </div>
        {offeneAnalyse === t.id && (
          <TaskAnalyse
            slug={slug}
            taskId={t.id}
            titel={t.title}
            onClose={() => setOffeneAnalyse(null)}
          />
        )}
        {offenNotizen === t.id && <TaskNotes slug={slug} taskId={t.id} />}
      </div>
    );
  }

  return (
    <div>
      {reparaturHinweis && (
        <p className="mb-4 rounded-md border border-good/40 bg-good-soft px-3 py-2 text-sm text-good">
          {reparaturHinweis}
        </p>
      )}
      <form onSubmit={hinzufuegen} className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            required
            placeholder="Hast du eine neue Idee? Dann gib ihr einen Titel und füge sie hinzu."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <Diktierknopf
            onText={(erkannt) =>
              setTitle((bisher) => (bisher ? `${bisher} ${erkannt}` : erkannt))
            }
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Legt an…" : "Hinzufügen"}
        </button>
      </form>
      {error && <p className="mb-4 text-sm text-bad">{error}</p>}
      {verschiebeFehler && (
        <p className="mb-4 text-sm text-bad">
          Verschieben fehlgeschlagen: {verschiebeFehler}
        </p>
      )}

      {loading && tasks === null && (
        <p className="mb-4 text-sm text-ink-muted">Lädt Aufgaben…</p>
      )}
      {tasks && tasks.length === 0 && spalten.length === 0 && (
        <p className="mb-4 text-sm text-ink-muted">Noch keine Aufgaben.</p>
      )}
      {tasks && spalten.length > 0 && (
        <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
          {spalten.map((s) => {
            const nimmtDrops = s.key.startsWith("stage:");
            return (
              <div key={s.key} className="w-72 shrink-0 px-1">
                <div
                  className={`flex items-center justify-between rounded-t-md px-3 py-2 ${s.klasse ?? ""}`}
                  style={
                    s.farbe
                      ? { backgroundColor: hexZuHintergrund(s.farbe, 0.28), color: `#${s.farbe}` }
                      : undefined
                  }
                >
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="font-mono text-xs tabular">{s.tasks.length}</span>
                </div>
                <div
                  onDragOver={(e) => {
                    if (!nimmtDrops) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDragEnter={() => {
                    if (nimmtDrops) setZielSpalte(s.key);
                  }}
                  onDragLeave={() =>
                    setZielSpalte((z) => (z === s.key ? null : z))
                  }
                  onDrop={(e) => {
                    if (!nimmtDrops) return;
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData("text/plain");
                    setZielSpalte(null);
                    if (taskId) verschieben(taskId, s);
                  }}
                  className={`flex min-h-16 flex-col gap-2 rounded-b-md border border-t-0 bg-surface-2/60 p-2 transition-colors ${
                    zielSpalte === s.key
                      ? "border-accent bg-accent-soft/40"
                      : "border-line"
                  }`}
                >
                  {s.tasks.map((t) => aufgabenKarte(t))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
