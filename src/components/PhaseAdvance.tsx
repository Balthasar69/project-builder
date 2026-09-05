"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { naechstePhase, PHASES, PhaseCode } from "@/lib/types";

/**
 * Zwei getrennte Bedienelemente für den Phasenverlauf:
 * - „Weiter zu: …" – regulärer Ein-Schritt-Knopf, nur sichtbar, wenn
 *   `darfSteuern` true ist (Kernteam-Mitglieder und Admins, siehe
 *   `istKernteam` in src/lib/auth.ts).
 * - „Phase direkt setzen" – Admin-only Auswahl, mit der beliebig vor oder
 *   zurück gesprungen werden kann, z. B. um eine versehentlich zu früh
 *   geschaltete Phase zu korrigieren ("zurücksetzen").
 */
export default function PhaseAdvance({
  slug,
  aktuell,
  darfSteuern,
  istAdmin,
}: {
  slug: string;
  aktuell: PhaseCode;
  darfSteuern: boolean;
  istAdmin: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [zielPhase, setZielPhase] = useState<PhaseCode>(aktuell);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const naechste = naechstePhase(aktuell);
  const naechsteName = naechste
    ? PHASES.find((p) => p.code === naechste)?.name ?? naechste
    : null;

  async function weiter() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/phase`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Phasenwechsel fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function direktSetzen() {
    setResetSaving(true);
    setResetError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: zielPhase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Phase konnte nicht gesetzt werden");
      router.refresh();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setResetSaving(false);
    }
  }

  if (!darfSteuern && !istAdmin) return null;

  return (
    <div className="mt-3 flex flex-col gap-4">
      {darfSteuern && naechste && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={weiter}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Wechselt…" : `Weiter zu: ${naechsteName}`}
          </button>
          {error && <span className="text-sm text-bad">{error}</span>}
        </div>
      )}

      {istAdmin && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface-2 px-4 py-3">
          <span className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
            Admin: Phase direkt setzen
          </span>
          <select
            value={zielPhase}
            onChange={(e) => setZielPhase(e.target.value as PhaseCode)}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          >
            {PHASES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.order}. {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={direktSetzen}
            disabled={resetSaving || zielPhase === aktuell}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {resetSaving ? "Setzt…" : "Setzen / Zurücksetzen"}
          </button>
          {resetError && <span className="text-sm text-bad">{resetError}</span>}
        </div>
      )}
    </div>
  );
}
