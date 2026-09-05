"use client";

import { useMemo, useState } from "react";
import {
  CheckAnswers,
  CheckResult,
  KernteamMitglied,
  PHASES,
  PhaseCode,
  checksProPersonFuerPhase,
  checkKriterienFuerPhase,
  eigeneCheckFuerPhase,
} from "@/lib/types";
import { checkScoreRange, durchschnittFuerPhase } from "@/lib/scoring";

const EMPFEHLUNG_STYLE: Record<CheckResult["empfehlung"], string> = {
  GO: "bg-good-soft text-good",
  "WEITER PRÜFEN": "bg-warn-soft text-warn",
  STOPP: "bg-bad-soft text-bad",
};

function phasenName(phase: PhaseCode): string {
  return PHASES.find((p) => p.code === phase)?.name ?? phase;
}

function vorname(name: string): string {
  return name.split(" ")[0] || name;
}

export default function ProjectCheckForm({
  slug,
  phase,
  checkVerlauf,
  darfBewerten,
  kernteam,
  bewerterEmail,
  bewerterName,
}: {
  slug: string;
  phase: PhaseCode;
  checkVerlauf: CheckResult[];
  /** Nur Kernteam-Mitglieder und Admins dürfen selbst eine Bewertungsreihe abgeben. */
  darfBewerten: boolean;
  kernteam: KernteamMitglied[];
  bewerterEmail: string;
  bewerterName: string;
}) {
  // Der Check gehört zur aktuellen Phase, und jedes Kernteam-Mitglied
  // bewertet unabhängig (eigene Bewertungsreihe je Frage) – die
  // Komponente wird über key={aktuellePhase} in page.tsx beim
  // Phasenwechsel ohnehin neu gemountet.
  const eigenerCheck = eigeneCheckFuerPhase(checkVerlauf, phase, bewerterEmail);
  const kriterien = checkKriterienFuerPhase(phase);
  const scoreRange = checkScoreRange(phase);

  // Nur Personen mit hinterlegter E-Mail können sich anmelden und damit
  // überhaupt bewerten – ohne E-Mail (sehr alte Datensätze) gibt es keine
  // eigene Zeile.
  const bewerterListe = useMemo(
    () => kernteam.filter((m): m is KernteamMitglied & { email: string } => !!m.email),
    [kernteam]
  );

  const [answers, setAnswers] = useState<CheckAnswers>(
    eigenerCheck?.answers ?? {}
  );
  const [notiz, setNotiz] = useState(eigenerCheck?.notiz ?? "");
  const [meinResult, setMeinResult] = useState<CheckResult | undefined>(eigenerCheck);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beantwortet = Object.keys(answers).length;
  const vollstaendig = beantwortet === kriterien.length;
  const laufendeSumme = useMemo(
    () =>
      Object.values(answers).reduce(
        (s: number, v: number | undefined) => s + (v ?? 0),
        0
      ),
    [answers]
  );

  // Bewertungen aller Kernteam-Mitglieder für die aktuelle Phase (jeweils
  // die letzte Abgabe pro Person) – Grundlage für die Bewertungsreihen je
  // Frage sowie den gemeinsamen Durchschnitt.
  const checksAktuellePhase = useMemo(
    () => checksProPersonFuerPhase(checkVerlauf, phase),
    [checkVerlauf, phase]
  );
  const durchschnitt = useMemo(
    () => durchschnittFuerPhase(checksAktuellePhase, phase),
    [checksAktuellePhase, phase]
  );
  const checkProEmail = useMemo(() => {
    const map = new Map<string, CheckResult>();
    for (const c of checksAktuellePhase) {
      if (c.bewerterEmail) map.set(c.bewerterEmail.toLowerCase(), c);
    }
    return map;
  }, [checksAktuellePhase]);

  // Frühere Bewertungen anderer Phasen, neueste zuerst – als Durchschnitt
  // pro Phase (Erinnerung, ohne die aktuelle Phase zu überschreiben).
  const fruehereChecks = useMemo(() => {
    const phasenMitEintraegen = new Set<PhaseCode>();
    for (const c of checkVerlauf) {
      if (c.phase && c.phase !== phase) phasenMitEintraegen.add(c.phase);
    }
    return [...phasenMitEintraegen]
      .map((p) => {
        const checks = checksProPersonFuerPhase(checkVerlauf, p);
        const agg = durchschnittFuerPhase(checks, p);
        return agg ? { phase: p, agg } : null;
      })
      .filter((x): x is { phase: PhaseCode; agg: NonNullable<ReturnType<typeof durchschnittFuerPhase>> } => !!x)
      .sort((a, b) => new Date(b.agg.zuletztAm).getTime() - new Date(a.agg.zuletztAm).getTime());
  }, [checkVerlauf, phase]);

  async function speichern() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, notiz }),
      });
      if (!res.ok) throw new Error("Speichern fehlgeschlagen");
      const data = await res.json();
      setMeinResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="mb-5 font-mono text-xs uppercase tracking-wide text-ink-faint">
        Bewertung für Phase: {phasenName(phase)}
        {durchschnitt && (
          <span className="ml-2 text-ink-faint">
            · {durchschnitt.anzahlBewerter}{" "}
            {durchschnitt.anzahlBewerter === 1 ? "Bewertung" : "Bewertungen"}
          </span>
        )}
      </p>

      <div className="mb-6 flex flex-col gap-5">
        {kriterien.map((c) => (
          <div key={c.code} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium text-ink">{c.frage}</span>
              <span className="text-xs text-ink-faint">{c.hilfe}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-md border border-line bg-surface-2 p-2">
              {bewerterListe.length === 0 && (
                <span className="px-2 py-1 text-xs text-ink-faint">
                  Noch keine Kernteam-Mitglieder mit App-Konto hinterlegt.
                </span>
              )}
              {bewerterListe.map((m) => {
                const istIch = m.email.toLowerCase() === bewerterEmail.toLowerCase();
                const werte = istIch ? answers : checkProEmail.get(m.email.toLowerCase())?.answers;
                const wertFuerFrage = werte?.[c.code];
                const interaktiv = istIch && darfBewerten;
                return (
                  <div key={m.email} className="flex items-center gap-3">
                    <span
                      className={`w-28 shrink-0 truncate text-xs ${
                        istIch ? "font-semibold text-ink" : "text-ink-muted"
                      }`}
                      title={m.name}
                    >
                      {vorname(m.name)}
                      {istIch && " (ich)"}
                    </span>
                    <div className="flex gap-1.5" role="radiogroup" aria-label={`${c.frage} – ${m.name}`}>
                      {[1, 2, 3, 4, 5].map((wert) => {
                        const aktiv = wertFuerFrage === wert;
                        return (
                          <button
                            key={wert}
                            type="button"
                            role="radio"
                            aria-checked={aktiv}
                            disabled={!interaktiv}
                            onClick={
                              interaktiv
                                ? () => setAnswers((a) => ({ ...a, [c.code]: wert }))
                                : undefined
                            }
                            className={`h-7 w-7 rounded-md font-mono text-xs transition ${
                              interaktiv
                                ? "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                                : "cursor-default"
                            } ${
                              aktiv
                                ? istIch
                                  ? "bg-accent text-surface"
                                  : "bg-ink-faint text-surface"
                                : interaktiv
                                ? "bg-surface text-ink-muted hover:bg-line"
                                : "bg-surface text-ink-faint opacity-50"
                            }`}
                          >
                            {wert}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {darfBewerten ? (
        <>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Deine Notiz zur Einschätzung (optional)
            </span>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={2}
              placeholder="z. B. Begründung, offene Fragen, Quellen…"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
          </label>

          <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
            <div className="text-sm text-ink-muted">
              {beantwortet} / {kriterien.length} von dir beantwortet
              {beantwortet > 0 && (
                <span className="ml-2 font-mono tabular text-ink-faint">
                  Zwischensumme {laufendeSumme} / {scoreRange.max}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={speichern}
              disabled={!vollstaendig || saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Speichert…"
                : eigenerCheck
                ? "Meine Bewertung aktualisieren"
                : "Meine Bewertung speichern"}
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-bad">{error}</p>}

          {meinResult && (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-line bg-surface px-4 py-2.5">
              <span className="text-sm text-ink-muted">
                Deine Bewertung: {meinResult.score} / {scoreRange.max}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide ${
                  EMPFEHLUNG_STYLE[meinResult.empfehlung]
                }`}
              >
                {meinResult.empfehlung}
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="rounded-md border border-line bg-surface-2 px-4 py-3 text-sm text-ink-muted">
          Nur Kernteam-Mitglieder und Admins können hier eine eigene
          Bewertungsreihe abgeben. Oben siehst du die Bewertungen aller
          Kernteam-Mitglieder.
        </p>
      )}

      {durchschnitt && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-ink-faint">
              Gemeinsamer Project Score · {phasenName(phase)}
            </span>
            <span
              className={`rounded-full px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wide ${
                EMPFEHLUNG_STYLE[durchschnitt.empfehlung]
              }`}
            >
              {durchschnitt.empfehlung}
            </span>
          </div>
          <div className="font-display text-3xl font-semibold tabular">
            {durchschnitt.score}
            <span className="ml-1 text-lg font-normal text-ink-faint">
              / {scoreRange.max}
            </span>
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Durchschnitt aus {durchschnitt.anzahlBewerter}{" "}
            {durchschnitt.anzahlBewerter === 1 ? "Bewertung" : "Bewertungen"} ·
            Entscheidungsinstrument, keine automatische Freigabe (Kapitel 11) ·
            zuletzt bewertet am{" "}
            {new Date(durchschnitt.zuletztAm).toLocaleDateString("de-DE")}
          </p>
        </div>
      )}

      {fruehereChecks.length > 0 && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-faint">
            Frühere Bewertungen anderer Phasen
          </p>
          <div className="flex flex-col gap-2">
            {fruehereChecks.map(({ phase: p, agg }) => (
              <div
                key={p}
                className="flex items-center justify-between rounded-md border border-line bg-surface px-4 py-2.5"
              >
                <span className="text-sm font-medium text-ink">
                  {phasenName(p)}
                  <span className="ml-2 font-mono text-xs font-normal text-ink-faint">
                    {agg.anzahlBewerter}{" "}
                    {agg.anzahlBewerter === 1 ? "Bewertung" : "Bewertungen"}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs tabular text-ink-muted">
                    {agg.score} / {checkScoreRange(p).max}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide ${
                      EMPFEHLUNG_STYLE[agg.empfehlung]
                    }`}
                  >
                    {agg.empfehlung}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
