"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AufgabenVorschlag, KernteamMitglied, ProjektArt, ProjektstartFragebogen as Fragebogen } from "@/lib/types";
import Diktierknopf from "./Diktierknopf";

/**
 * "Aufgaben von der KI vorschlagen lassen": Admin bestimmt einen
 * Projektleiter aus dem Kernteam (kann er selbst sein), dieser beantwortet
 * einen kurzen Fragebogen (Geschäft/privat, Zielsituation, Meilensteine),
 * danach generiert die KI Aufgaben-Vorschläge zur Durchsicht durchs
 * Kernteam – bewusst kein automatisches Übernehmen. Bleibt in einem
 * einzigen Block, damit der Aufgaben-Bereich übersichtlich bleibt.
 */
export default function ProjektstartFragebogen({
  slug,
  kernteam,
  istAdmin,
  istKernteam,
  sessionEmail,
  fragebogen,
  vorschlaege,
}: {
  slug: string;
  kernteam: KernteamMitglied[];
  istAdmin: boolean;
  istKernteam: boolean;
  sessionEmail: string;
  fragebogen?: Fragebogen;
  vorschlaege: AufgabenVorschlag[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  // Start-Formular (nur Admin, solange kein Fragebogen läuft)
  const [starteOffen, setStarteOffen] = useState(false);
  const [projektleiterEmail, setProjektleiterEmail] = useState("");

  // Ausfüll-Formular
  const [projektArt, setProjektArt] = useState<ProjektArt | "">("");
  const [zielsituation, setZielsituation] = useState("");
  const [umsatzziel, setUmsatzziel] = useState("");
  const [liquiditaet, setLiquiditaet] = useState("");
  const [meilensteine, setMeilensteine] = useState("");

  // Durchsicht der Vorschläge: bearbeitbare Titel je Vorschlag
  const [bearbeiteteTitel, setBearbeiteteTitel] = useState<Record<string, string>>({});
  const [aktionLaeuft, setAktionLaeuft] = useState<string | null>(null);

  const eigeneEmail = sessionEmail.toLowerCase();
  const istZugewiesenerProjektleiter =
    !!fragebogen && fragebogen.projektleiterEmail === eigeneEmail;
  const darfAntworten = istZugewiesenerProjektleiter || istAdmin;

  async function starten(e: FormEvent) {
    e.preventDefault();
    if (!projektleiterEmail) return;
    setLaeuft(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/fragebogen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projektleiterEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Starten fehlgeschlagen");
      setStarteOffen(false);
      setProjektleiterEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLaeuft(false);
    }
  }

  async function abbrechen() {
    if (!window.confirm("Diese Fragebogen-Runde wirklich beenden?")) return;
    setLaeuft(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/fragebogen`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Beenden fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLaeuft(false);
    }
  }

  async function antworten(e: FormEvent) {
    e.preventDefault();
    if (!projektArt) return;
    setLaeuft(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/fragebogen/antworten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projektArt,
          zielsituation,
          umsatzziel: projektArt === "geschaeft" ? umsatzziel : undefined,
          liquiditaet: projektArt === "geschaeft" ? liquiditaet : undefined,
          meilensteine,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLaeuft(false);
    }
  }

  async function erneutVersuchen() {
    setLaeuft(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/fragebogen/neu-generieren`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLaeuft(false);
    }
  }

  async function uebernehmen(v: AufgabenVorschlag) {
    setAktionLaeuft(v.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${slug}/aufgaben-vorschlaege/${v.id}/uebernehmen`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titel: bearbeiteteTitel[v.id] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Übernehmen fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setAktionLaeuft(null);
    }
  }

  async function verwerfen(v: AufgabenVorschlag) {
    setAktionLaeuft(v.id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/aufgaben-vorschlaege`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verwerfen fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setAktionLaeuft(null);
    }
  }

  const inputKlasse =
    "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none";

  // --- A) Kein Fragebogen aktiv ---
  if (!fragebogen) {
    if (!istAdmin) return null;
    return (
      <div className="mb-6 rounded-md border border-line bg-surface px-4 py-3">
        {!starteOffen ? (
          <button
            type="button"
            onClick={() => setStarteOffen(true)}
            className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-accent transition hover:text-accent-ink"
          >
            Aufgaben von der KI vorschlagen lassen
          </button>
        ) : (
          <form onSubmit={starten} className="flex flex-col gap-2">
            <label className="text-sm text-ink-muted">
              Wer soll die Fragen zum Projektstart beantworten? (kann auch du selbst sein)
            </label>
            <select
              required
              value={projektleiterEmail}
              onChange={(e) => setProjektleiterEmail(e.target.value)}
              className={inputKlasse}
            >
              <option value="" disabled>
                Person auswählen…
              </option>
              {kernteam.map((m) => (
                <option key={m.email ?? m.name} value={m.email}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={laeuft || !projektleiterEmail}
                className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {laeuft ? "Startet…" : "Fragebogen starten"}
              </button>
              <button
                type="button"
                onClick={() => setStarteOffen(false)}
                className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-ink"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </div>
    );
  }

  // --- B) Fragebogen läuft, noch nicht beantwortet ---
  if (!fragebogen.beantwortetAm) {
    return (
      <div className="mb-6 rounded-md border border-line bg-surface px-4 py-3">
        {darfAntworten ? (
          <form onSubmit={antworten} className="flex flex-col gap-3">
            <p className="text-sm font-medium">Fragen zum Projektstart</p>
            <div>
              <label className="mb-1 block text-sm text-ink-muted">
                Ist dies ein Geschäftsprojekt oder ein privates/persönliches Projekt?
              </label>
              <select
                required
                value={projektArt}
                onChange={(e) => setProjektArt(e.target.value as ProjektArt)}
                className={inputKlasse}
              >
                <option value="" disabled>
                  Bitte wählen…
                </option>
                <option value="geschaeft">Geschäftsprojekt</option>
                <option value="privat">Privates/persönliches Projekt</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-muted">
                Zielsituation: Was soll am Ende erreicht sein?
              </label>
              <div className="relative">
                <textarea
                  required
                  rows={3}
                  value={zielsituation}
                  onChange={(e) => setZielsituation(e.target.value)}
                  className={`${inputKlasse} pr-9`}
                />
                <Diktierknopf
                  onText={(erkannt) =>
                    setZielsituation((bisher) =>
                      bisher ? `${bisher} ${erkannt}` : erkannt
                    )
                  }
                  className="absolute right-1.5 top-1.5"
                />
              </div>
            </div>
            {projektArt === "geschaeft" && (
              <>
                <div>
                  <label className="mb-1 block text-sm text-ink-muted">Umsatzziel</label>
                  <div className="relative">
                    <textarea
                      rows={2}
                      value={umsatzziel}
                      onChange={(e) => setUmsatzziel(e.target.value)}
                      className={`${inputKlasse} pr-9`}
                    />
                    <Diktierknopf
                      onText={(erkannt) =>
                        setUmsatzziel((bisher) =>
                          bisher ? `${bisher} ${erkannt}` : erkannt
                        )
                      }
                      className="absolute right-1.5 top-1.5"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-ink-muted">
                    Liquiditätslage/-planung
                  </label>
                  <div className="relative">
                    <textarea
                      rows={2}
                      value={liquiditaet}
                      onChange={(e) => setLiquiditaet(e.target.value)}
                      className={`${inputKlasse} pr-9`}
                    />
                    <Diktierknopf
                      onText={(erkannt) =>
                        setLiquiditaet((bisher) =>
                          bisher ? `${bisher} ${erkannt}` : erkannt
                        )
                      }
                      className="absolute right-1.5 top-1.5"
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-sm text-ink-muted">
                Meilensteine (ein Meilenstein pro Zeile)
              </label>
              <div className="relative">
                <textarea
                  required
                  rows={4}
                  value={meilensteine}
                  onChange={(e) => setMeilensteine(e.target.value)}
                  className={`${inputKlasse} pr-9`}
                />
                <Diktierknopf
                  onText={(erkannt) =>
                    setMeilensteine((bisher) =>
                      bisher ? `${bisher}\n${erkannt}` : erkannt
                    )
                  }
                  className="absolute right-1.5 top-1.5"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={laeuft}
                className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {laeuft ? "Erstellt Vorschläge…" : "Vorschläge erstellen"}
              </button>
              {istAdmin && (
                <button
                  type="button"
                  onClick={abbrechen}
                  disabled={laeuft}
                  className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-bad hover:text-accent-ink"
                >
                  Fragebogen abbrechen
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-muted">
              Fragebogen offen für {fragebogen.projektleiterName} — wartet auf Antwort.
            </p>
            {istAdmin && (
              <button
                type="button"
                onClick={abbrechen}
                disabled={laeuft}
                className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-bad hover:text-accent-ink"
              >
                Abbrechen
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </div>
    );
  }

  // --- C/D) Beantwortet: Fehler, oder Vorschläge zur Durchsicht ---
  const offeneVorschlaege = vorschlaege.filter((v) => !v.uebernommenAlsTaskId);

  return (
    <div className="mb-6 rounded-md border border-line bg-surface px-4 py-3">
      <p className="mb-2 text-sm font-medium">
        KI-Aufgabenvorschläge zum Projektstart ({fragebogen.projektleiterName})
      </p>

      {fragebogen.fehler && (
        <div className="mb-3">
          <p className="text-sm text-bad">{fragebogen.fehler}</p>
          {darfAntworten && (
            <button
              type="button"
              onClick={erneutVersuchen}
              disabled={laeuft}
              className="mt-2 whitespace-nowrap font-mono text-xs uppercase tracking-wide text-accent hover:text-accent-ink"
            >
              {laeuft ? "Versucht erneut…" : "Erneut versuchen"}
            </button>
          )}
        </div>
      )}

      {offeneVorschlaege.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {offeneVorschlaege.map((v) => (
            <div
              key={v.id}
              className="flex flex-col gap-2 rounded-md border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <input
                type="text"
                value={bearbeiteteTitel[v.id] ?? v.titel}
                onChange={(e) =>
                  setBearbeiteteTitel((prev) => ({ ...prev, [v.id]: e.target.value }))
                }
                className="flex-1 rounded-md border border-line bg-transparent px-2 py-1 text-sm focus:border-accent focus:outline-none"
              />
              {istKernteam && (
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => uebernehmen(v)}
                    disabled={aktionLaeuft === v.id}
                    className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-accent hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {aktionLaeuft === v.id ? "…" : "Übernehmen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => verwerfen(v)}
                    disabled={aktionLaeuft === v.id}
                    className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-bad hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Verwerfen
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {offeneVorschlaege.length === 0 && !fragebogen.fehler && (
        <p className="mb-3 text-sm text-ink-faint">
          Alle Vorschläge wurden bereits übernommen oder verworfen.
        </p>
      )}

      {istAdmin && (
        <button
          type="button"
          onClick={abbrechen}
          disabled={laeuft}
          className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-ink"
        >
          Fertig, ausblenden
        </button>
      )}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </div>
  );
}
