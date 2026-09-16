"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SteuerboardInfo } from "@/lib/types";

/**
 * Löst die Einrichtung der Steuerboard-Kopie für die Phasen 2–5 aus (siehe
 * `docs/factory-automatisierung.md` im Steuerboard-Repo) – bewusst nur per
 * Klick, nie automatisch beim Anlegen eines Projekts oder bei einem
 * Phasenwechsel hier im Project Builder. Sichtbar nur für Kernteam und
 * Admins (`darfAusloesen`), wie beim Phasenwechsel.
 *
 * Nach erfolgreicher Einrichtung ersetzt der Link dauerhaft den Knopf –
 * ein Projekt bekommt nur eine Kopie (siehe API-Route). Das Löschen einer
 * bestehenden Kopie (`darfLoeschen`) ist bewusst strenger gefasst: nur
 * Balthasar selbst, weil es reale, kostenpflichtige Cloud-Ressourcen
 * unwiderruflich entfernt.
 */
export default function SteuerboardLink({
  slug,
  steuerboard,
  darfAusloesen,
  darfLoeschen,
}: {
  slug: string;
  steuerboard?: SteuerboardInfo;
  darfAusloesen: boolean;
  darfLoeschen?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bestaetigen, setBestaetigen] = useState(false);
  const [loeschenBestaetigen, setLoeschenBestaetigen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function loeschen() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/steuerboard`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Steuerboard-Kopie konnte nicht gelöscht werden");
      setLoeschenBestaetigen(false);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setDeleting(false);
    }
  }

  if (steuerboard) {
    return (
      <div className="mt-3 rounded-md border border-line bg-surface-2 px-4 py-3">
        <div className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
          Steuerboard-Kopie eingerichtet
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            href={steuerboard.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-accent hover:text-accent-ink"
          >
            {steuerboard.url} ↗
          </a>
          <span className="text-xs text-ink-faint">
            von {steuerboard.erstelltVonName},{" "}
            {new Date(steuerboard.erstelltAm).toLocaleDateString("de-DE")}
          </span>
        </div>
        {darfLoeschen && (
          <div className="mt-2">
            {!loeschenBestaetigen ? (
              <button
                type="button"
                onClick={() => setLoeschenBestaetigen(true)}
                className="text-xs text-ink-faint underline decoration-dotted hover:text-bad"
              >
                Kopie löschen
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
                <span className="text-xs text-ink-muted">
                  Löscht das Vercel-Projekt und die Datenbank dieser Kopie
                  unwiderruflich. Nicht rückgängig zu machen.
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={loeschen}
                    disabled={deleting}
                    className="whitespace-nowrap rounded-md bg-bad px-3 py-1.5 text-xs font-medium text-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deleting ? "Wird gelöscht…" : "Ja, endgültig löschen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoeschenBestaetigen(false)}
                    disabled={deleting}
                    className="whitespace-nowrap text-xs text-ink-faint hover:text-ink"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
            {deleteError && (
              <span className="mt-1 block text-xs text-bad">{deleteError}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!darfAusloesen) return null;

  async function ausloesen() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/steuerboard`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Steuerboard-Kopie konnte nicht angelegt werden");
      setBestaetigen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {!bestaetigen ? (
        <button
          type="button"
          onClick={() => setBestaetigen(true)}
          className="self-start rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:text-accent"
        >
          Steuerboard-Kopie erstellen
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface-2 px-4 py-3">
          <span className="text-sm text-ink-muted">
            Legt jetzt eine eigene, laufende Steuerboard-Kopie für dieses
            Projekt an (eigenes Vercel-Projekt, eigene Datenbank). Das lässt
            sich nicht rückgängig machen und passiert nur einmal pro Projekt.
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={ausloesen}
              disabled={saving}
              className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Wird eingerichtet…" : "Ja, jetzt anlegen"}
            </button>
            <button
              type="button"
              onClick={() => setBestaetigen(false)}
              disabled={saving}
              className="whitespace-nowrap text-sm text-ink-faint hover:text-ink"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {error && <span className="text-sm text-bad">{error}</span>}
    </div>
  );
}
