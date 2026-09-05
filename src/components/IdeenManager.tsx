"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Idee } from "@/lib/types";

/**
 * Loses Sammelbecken für kurze Ideen (Kapitel 25, Ergänzung "Ideen"). Jeder
 * mit Projektzugriff sieht die Liste, aber nur das Kernteam kann Ideen
 * anlegen, entfernen oder nach Bitrix24 übernehmen – bewusst analog zu
 * KernteamManager/TeamManager gehalten.
 */
export default function IdeenManager({
  slug,
  ideen,
  istKernteam,
}: {
  slug: string;
  ideen: Idee[];
  istKernteam: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aktionLaeuft, setAktionLaeuft] = useState<string | null>(null);
  const [aktionFehler, setAktionFehler] = useState<string | null>(null);

  async function hinzufuegen(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/ideen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hinzufügen fehlgeschlagen");
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function entfernen(idee: Idee) {
    if (!window.confirm(`Idee „${idee.text}" wirklich entfernen?`)) return;
    setAktionLaeuft(idee.id);
    setAktionFehler(null);
    try {
      const res = await fetch(`/api/projects/${slug}/ideen`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idee.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Entfernen fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setAktionFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setAktionLaeuft(null);
    }
  }

  async function uebernehmen(idee: Idee) {
    setAktionLaeuft(idee.id);
    setAktionFehler(null);
    try {
      const res = await fetch(`/api/projects/${slug}/ideen/${idee.id}/uebernehmen`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Übernehmen fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setAktionFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setAktionLaeuft(null);
    }
  }

  if (ideen.length === 0 && !istKernteam) {
    return <p className="text-sm text-ink-faint">Noch keine Ideen eingetragen.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2">
        {ideen.length === 0 && (
          <p className="text-sm text-ink-faint">Noch keine Ideen eingetragen.</p>
        )}
        {ideen.map((idee) => (
          <div
            key={idee.id}
            className="flex items-start justify-between gap-4 rounded-md border border-line bg-surface px-4 py-2.5"
          >
            <div>
              <p className="text-sm">{idee.text}</p>
              <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
                {idee.erstelltVonName} ·{" "}
                {new Date(idee.erstelltAm).toLocaleDateString("de-DE")}
                {idee.uebernommenAlsTaskId && " · in Bitrix24 übernommen"}
              </p>
            </div>
            {istKernteam && !idee.uebernommenAlsTaskId && (
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => uebernehmen(idee)}
                  disabled={aktionLaeuft === idee.id}
                  className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-accent transition hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {aktionLaeuft === idee.id ? "Übernimmt…" : "In Bitrix24 übernehmen"}
                </button>
                <button
                  type="button"
                  onClick={() => entfernen(idee)}
                  disabled={aktionLaeuft === idee.id}
                  className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-bad transition hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Entfernen
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {aktionFehler && <p className="mb-3 text-sm text-bad">{aktionFehler}</p>}

      {istKernteam && (
        <form onSubmit={hinzufuegen} className="flex flex-col gap-2">
          <textarea
            required
            rows={2}
            placeholder="Kurze Idee…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !text.trim()}
            className="self-start whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Speichert…" : "Idee hinzufügen"}
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </div>
  );
}
