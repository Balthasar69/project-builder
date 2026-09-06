"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KompetenzBeitrag } from "@/lib/types";

/**
 * Neuer Cockpit-Bereich seit v0.46: jede Person mit Projektzugriff trägt für
 * sich selbst ein, was sie zum Projekt beitragen kann bzw. beitragen
 * möchte – reine Selbstauskunft, kein Freigabeprozess. Der eigene Eintrag
 * ist immer editierbar (accent-umrandete Karte), die Einträge der anderen
 * werden nur gelesen; wer noch nichts eingetragen hat, erscheint mit einem
 * Platzhalter "Noch nicht ausgefüllt", damit sichtbar bleibt, wer im Projekt
 * überhaupt mitwirkt.
 */
export default function KompetenzenManager({
  slug,
  teilnehmer,
  beitraege,
  sessionEmail,
}: {
  slug: string;
  teilnehmer: { email: string; name: string }[];
  beitraege: KompetenzBeitrag[];
  sessionEmail: string;
}) {
  const router = useRouter();
  const eigenerEintrag = beitraege.find(
    (b) => b.email.toLowerCase() === sessionEmail.toLowerCase()
  );

  const [bearbeiten, setBearbeiten] = useState(!eigenerEintrag);
  const [kannBeitragen, setKannBeitragen] = useState(
    eigenerEintrag?.kannBeitragen ?? ""
  );
  const [moechteBeitragen, setMoechteBeitragen] = useState(
    eigenerEintrag?.moechteBeitragen ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/kompetenzen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kannBeitragen, moechteBeitragen }),
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

  // Alle übrigen Teilnehmer:innen (nicht die angemeldete Person selbst),
  // Namen alphabetisch – jede mit Eintrag (gelesen) oder ohne (Platzhalter).
  const andere = teilnehmer
    .filter((t) => t.email.toLowerCase() !== sessionEmail.toLowerCase())
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border-2 border-accent bg-accent-soft/40 px-4 py-3.5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="font-mono text-xs uppercase tracking-wide text-accent-ink">
            Dein Eintrag
          </span>
          {!bearbeiten && (
            <button
              type="button"
              onClick={() => setBearbeiten(true)}
              className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-accent hover:text-accent-ink"
            >
              Bearbeiten
            </button>
          )}
        </div>

        {bearbeiten ? (
          <form onSubmit={speichern} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">
                Das kann ich beitragen
              </span>
              <textarea
                rows={2}
                value={kannBeitragen}
                onChange={(e) => setKannBeitragen(e.target.value)}
                placeholder="z. B. Erfahrung im Vertrieb, technisches Know-how, Kontakte …"
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">
                Das möchte ich beitragen
              </span>
              <textarea
                rows={2}
                value={moechteBeitragen}
                onChange={(e) => setMoechteBeitragen(e.target.value)}
                placeholder="z. B. mehr Verantwortung übernehmen, in einem bestimmten Bereich mitwirken …"
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || (!kannBeitragen.trim() && !moechteBeitragen.trim())}
                className="self-start whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Speichert…" : "Speichern"}
              </button>
              {eigenerEintrag && (
                <button
                  type="button"
                  onClick={() => {
                    setKannBeitragen(eigenerEintrag.kannBeitragen);
                    setMoechteBeitragen(eigenerEintrag.moechteBeitragen);
                    setBearbeiten(false);
                    setError(null);
                  }}
                  className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-ink"
                >
                  Abbrechen
                </button>
              )}
            </div>
            {error && <p className="text-sm text-bad">{error}</p>}
          </form>
        ) : (
          <div className="flex flex-col gap-2 text-sm text-ink">
            <div>
              <span className="font-medium">Kann beitragen: </span>
              {eigenerEintrag?.kannBeitragen || (
                <span className="text-ink-faint">– nicht ausgefüllt</span>
              )}
            </div>
            <div>
              <span className="font-medium">Möchte beitragen: </span>
              {eigenerEintrag?.moechteBeitragen || (
                <span className="text-ink-faint">– nicht ausgefüllt</span>
              )}
            </div>
          </div>
        )}
      </div>

      {andere.map((person) => {
        const eintrag = beitraege.find(
          (b) => b.email.toLowerCase() === person.email.toLowerCase()
        );
        return (
          <div
            key={person.email}
            className="rounded-md border border-line bg-surface px-4 py-3"
          >
            <div className="mb-1.5 font-mono text-xs uppercase tracking-wide text-ink-faint">
              {person.name}
            </div>
            {eintrag ? (
              <div className="flex flex-col gap-1.5 text-sm text-ink">
                <div>
                  <span className="font-medium">Kann beitragen: </span>
                  {eintrag.kannBeitragen || (
                    <span className="text-ink-faint">– nicht ausgefüllt</span>
                  )}
                </div>
                <div>
                  <span className="font-medium">Möchte beitragen: </span>
                  {eintrag.moechteBeitragen || (
                    <span className="text-ink-faint">– nicht ausgefüllt</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-faint">Noch nicht ausgefüllt</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
