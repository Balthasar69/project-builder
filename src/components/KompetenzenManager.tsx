"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KompetenzBeitrag } from "@/lib/types";
import Diktierknopf from "./Diktierknopf";

/**
 * Neuer Cockpit-Bereich seit v0.46: jede Person mit Projektzugriff trägt für
 * sich selbst ein, was sie zum Projekt beitragen kann bzw. beitragen
 * möchte – reine Selbstauskunft, kein Freigabeprozess. Der eigene Eintrag
 * ist immer editierbar (accent-umrandete Karte). Seit v0.9x dürfen
 * zusätzlich Admins (`istAdmin`) den Eintrag jeder anderen Person mit
 * Projektzugriff bearbeiten bzw. für sie nachtragen (z. B. wenn diese
 * Person sich selbst (noch) nicht einloggen kann) – wie schon beim
 * Projekt-Check und im Chat. Ohne Admin-Rechte bleiben die Einträge der
 * anderen weiterhin nur lesbar; wer noch nichts eingetragen hat, erscheint
 * mit einem Platzhalter "Noch nicht ausgefüllt", damit sichtbar bleibt, wer
 * im Projekt überhaupt mitwirkt.
 */
export default function KompetenzenManager({
  slug,
  teilnehmer,
  beitraege,
  sessionEmail,
  istAdmin,
}: {
  slug: string;
  teilnehmer: { email: string; name: string }[];
  beitraege: KompetenzBeitrag[];
  sessionEmail: string;
  istAdmin: boolean;
}) {
  const router = useRouter();
  const eigenerEintrag = beitraege.find(
    (b) => b.email.toLowerCase() === sessionEmail.toLowerCase()
  );

  // Wessen Eintrag gerade bearbeitet wird: null = niemand (nur Lese-Ansicht
  // bei den anderen), sonst die E-Mail der Person – das ist entweder man
  // selbst oder, nur für Admins, eine andere Person mit Projektzugriff.
  const [bearbeiteEmail, setBearbeiteEmail] = useState<string | null>(
    eigenerEintrag ? null : sessionEmail
  );
  const [kannBeitragen, setKannBeitragen] = useState(
    eigenerEintrag?.kannBeitragen ?? ""
  );
  const [moechteBeitragen, setMoechteBeitragen] = useState(
    eigenerEintrag?.moechteBeitragen ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function bearbeitenStarten(email: string, eintrag: KompetenzBeitrag | undefined) {
    setBearbeiteEmail(email);
    setKannBeitragen(eintrag?.kannBeitragen ?? "");
    setMoechteBeitragen(eintrag?.moechteBeitragen ?? "");
    setError(null);
  }

  function bearbeitenAbbrechen() {
    setBearbeiteEmail(null);
    setError(null);
  }

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (!bearbeiteEmail) return;
    const bearbeiteIstIch = bearbeiteEmail.toLowerCase() === sessionEmail.toLowerCase();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/kompetenzen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kannBeitragen,
          moechteBeitragen,
          fuerEmail: bearbeiteIstIch ? undefined : bearbeiteEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
      setBearbeiteEmail(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  function bearbeitenFormular() {
    return (
      <form onSubmit={speichern} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-muted">
            Das kann {bearbeiteEmail?.toLowerCase() === sessionEmail.toLowerCase() ? "ich" : "diese Person"} beitragen
          </span>
          <div className="relative">
            <textarea
              rows={2}
              value={kannBeitragen}
              onChange={(e) => setKannBeitragen(e.target.value)}
              placeholder="z. B. Erfahrung im Vertrieb, technisches Know-how, Kontakte …"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
            <Diktierknopf
              onText={(erkannt) =>
                setKannBeitragen((bisher) => (bisher ? `${bisher} ${erkannt}` : erkannt))
              }
              className="absolute right-1.5 top-1.5"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-muted">
            Das möchte {bearbeiteEmail?.toLowerCase() === sessionEmail.toLowerCase() ? "ich" : "diese Person"} beitragen
          </span>
          <div className="relative">
            <textarea
              rows={2}
              value={moechteBeitragen}
              onChange={(e) => setMoechteBeitragen(e.target.value)}
              placeholder="z. B. mehr Verantwortung übernehmen, in einem bestimmten Bereich mitwirken …"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
            <Diktierknopf
              onText={(erkannt) =>
                setMoechteBeitragen((bisher) => (bisher ? `${bisher} ${erkannt}` : erkannt))
              }
              className="absolute right-1.5 top-1.5"
            />
          </div>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || (!kannBeitragen.trim() && !moechteBeitragen.trim())}
            className="self-start whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
          <button
            type="button"
            onClick={bearbeitenAbbrechen}
            className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-ink"
          >
            Abbrechen
          </button>
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
      </form>
    );
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
          {bearbeiteEmail?.toLowerCase() !== sessionEmail.toLowerCase() && (
            <button
              type="button"
              onClick={() => bearbeitenStarten(sessionEmail, eigenerEintrag)}
              className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-accent hover:text-accent-ink"
            >
              Bearbeiten
            </button>
          )}
        </div>

        {bearbeiteEmail?.toLowerCase() === sessionEmail.toLowerCase() ? (
          bearbeitenFormular()
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
        const wirdBearbeitet = bearbeiteEmail?.toLowerCase() === person.email.toLowerCase();
        return (
          <div
            key={person.email}
            className={`rounded-md border px-4 py-3 ${
              wirdBearbeitet ? "border-2 border-accent bg-accent-soft/40" : "border-line bg-surface"
            }`}
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-faint">
                {person.name}
              </span>
              {istAdmin && !wirdBearbeitet && (
                <button
                  type="button"
                  onClick={() => bearbeitenStarten(person.email, eintrag)}
                  className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-accent hover:text-accent-ink"
                >
                  {eintrag ? "Bearbeiten" : "Eintragen"}
                </button>
              )}
            </div>
            {wirdBearbeitet ? (
              bearbeitenFormular()
            ) : eintrag ? (
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
