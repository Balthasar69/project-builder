"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckAnswers,
  CheckResult,
  PHASES,
  PhaseCode,
  checksProPersonFuerPhase,
  checkKriterienFuerPhase,
} from "@/lib/types";
import { checkScoreRange, durchschnittFuerPhase } from "@/lib/scoring";
import Diktierknopf from "./Diktierknopf";

/** Eine Person mit Projektzugriff (Kernteam oder Team), für die eigene Bewertungsreihe je Frage. */
type Teilnehmer = { name: string; email?: string };

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
  istAdmin,
  teilnehmer,
  bewerterEmail,
  bewerterName,
}: {
  slug: string;
  phase: PhaseCode;
  checkVerlauf: CheckResult[];
  /** Jede Person mit Zugriff auf das Projekt (Kernteam + Team) darf selbst eine Bewertungsreihe abgeben. */
  darfBewerten: boolean;
  /** Admins dürfen zusätzlich im Namen jeder anderen Person mit Projektzugriff bewerten. */
  istAdmin: boolean;
  teilnehmer: Teilnehmer[];
  bewerterEmail: string;
  bewerterName: string;
}) {
  const router = useRouter();
  const eigeneEmail = bewerterEmail.toLowerCase();
  const kriterien = checkKriterienFuerPhase(phase);
  const scoreRange = checkScoreRange(phase);

  // Nur Personen mit hinterlegter E-Mail können sich anmelden und damit
  // überhaupt bewerten – ohne E-Mail (sehr alte Datensätze) gibt es keine
  // eigene Zeile.
  const bewerterListe = useMemo(
    () => teilnehmer.filter((m): m is Teilnehmer & { email: string } => !!m.email),
    [teilnehmer]
  );

  // Bewertungen aller Projektbeteiligten für die aktuelle Phase (jeweils die
  // letzte Abgabe pro Person) – Grundlage für die Bewertungsreihen je Frage
  // sowie den gemeinsamen Durchschnitt.
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
  const eigenesErgebnis = checkProEmail.get(eigeneEmail);

  // Wessen Bewertungsreihe gerade offen zur Bearbeitung ist (kleingeschriebene
  // E-Mail) – normalerweise die eigene; Admins können hier stattdessen auch
  // die einer anderen Person öffnen. `null` = niemand gerade, es werden nur
  // die zuletzt gespeicherten Werte angezeigt (mit "Bearbeiten"-Knopf).
  const [bearbeiteEmail, setBearbeiteEmail] = useState<string | null>(
    darfBewerten && !eigenesErgebnis ? eigeneEmail : null
  );
  const [answers, setAnswers] = useState<CheckAnswers>(
    eigenesErgebnis?.answers ?? {}
  );
  const [notiz, setNotiz] = useState(eigenesErgebnis?.notiz ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bearbeiteIstIch = bearbeiteEmail === eigeneEmail;
  const bearbeitetePerson = bearbeiteEmail
    ? bewerterListe.find((m) => m.email.toLowerCase() === bearbeiteEmail)
    : undefined;

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

  // Frühere Bewertungen anderer Phasen, neueste zuerst – als Durchschnitt pro
  // Phase (Erinnerung, ohne die aktuelle Phase zu überschreiben).
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

  function bearbeitenStarten(email: string) {
    const vorhanden = checkProEmail.get(email);
    setAnswers(vorhanden?.answers ?? {});
    setNotiz(vorhanden?.notiz ?? "");
    setError(null);
    setBearbeiteEmail(email);
  }

  function bearbeitenAbbrechen() {
    setBearbeiteEmail(null);
    setError(null);
  }

  async function speichern() {
    if (!bearbeiteEmail) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          notiz,
          // Nur mitschicken, wenn im Namen einer anderen Person bewertet
          // wird – die API prüft serverseitig erneut, dass das nur Admins
          // dürfen.
          fuerEmail: bearbeiteIstIch ? undefined : bearbeiteEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
      setBearbeiteEmail(null);
      router.refresh();
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
                  Noch keine Mitglieder mit App-Konto hinterlegt.
                </span>
              )}
              {bewerterListe.map((m) => {
                const zielEmail = m.email.toLowerCase();
                const istIch = zielEmail === eigeneEmail;
                const wirdBearbeitet = zielEmail === bearbeiteEmail;
                const wertFuerFrage = wirdBearbeitet
                  ? answers[c.code]
                  : checkProEmail.get(zielEmail)?.answers?.[c.code];
                const interaktiv = wirdBearbeitet;
                return (
                  <div key={m.email} className="flex items-center gap-3">
                    <span
                      className={`w-28 shrink-0 truncate text-xs ${
                        istIch || wirdBearbeitet ? "font-semibold text-ink" : "text-ink-muted"
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
                                ? wirdBearbeitet
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
        bearbeiteEmail ? (
          <>
            {!bearbeiteIstIch && (
              <p className="mb-3 text-sm font-medium text-ink">
                Bewertung im Namen von {bearbeitetePerson?.name ?? bearbeiteEmail}
              </p>
            )}
            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-medium text-ink">
                {bearbeiteIstIch ? "Deine Notiz zur Einschätzung (optional)" : "Notiz zur Einschätzung (optional)"}
              </span>
              <div className="relative">
                <textarea
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  rows={2}
                  placeholder="z. B. Begründung, offene Fragen, Quellen…"
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                />
                <Diktierknopf
                  onText={(erkannt) =>
                    setNotiz((bisher) => (bisher ? `${bisher} ${erkannt}` : erkannt))
                  }
                  className="absolute right-1.5 top-1.5"
                />
              </div>
            </label>

            <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
              <div className="text-sm text-ink-muted">
                {beantwortet} / {kriterien.length} beantwortet
                {beantwortet > 0 && (
                  <span className="ml-2 font-mono tabular text-ink-faint">
                    Zwischensumme {laufendeSumme} / {scoreRange.max}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={bearbeitenAbbrechen}
                  disabled={saving}
                  className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-ink"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={speichern}
                  disabled={!vollstaendig || saving}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving
                    ? "Speichert…"
                    : checkProEmail.has(bearbeiteEmail)
                    ? "Bewertung aktualisieren"
                    : "Bewertung speichern"}
                </button>
              </div>
            </div>

            {!vollstaendig && (
              <p className="mt-2 text-xs text-ink-faint">
                Bitte erst alle {kriterien.length} Fragen oben beantworten, um
                speichern zu können.
              </p>
            )}

            {error && <p className="mt-3 text-sm text-bad">{error}</p>}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4 rounded-md border border-line bg-surface px-4 py-2.5">
              <span className="text-sm text-ink-muted">
                {eigenesErgebnis
                  ? `Deine Bewertung: ${eigenesErgebnis.score} / ${scoreRange.max}`
                  : "Du hast diese Phase noch nicht bewertet."}
              </span>
              <div className="flex items-center gap-3">
                {eigenesErgebnis && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide ${
                      EMPFEHLUNG_STYLE[eigenesErgebnis.empfehlung]
                    }`}
                  >
                    {eigenesErgebnis.empfehlung}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => bearbeitenStarten(eigeneEmail)}
                  className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint transition hover:text-accent"
                >
                  {eigenesErgebnis ? "Bearbeiten" : "Bewerten"}
                </button>
              </div>
            </div>

            {istAdmin &&
              bewerterListe.filter((m) => m.email.toLowerCase() !== eigeneEmail).length > 0 && (
                <div className="mt-2 rounded-md border border-line bg-surface-2 p-3">
                  <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-faint">
                    Als Admin im Namen eines anderen Mitglieds bewerten
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {bewerterListe
                      .filter((m) => m.email.toLowerCase() !== eigeneEmail)
                      .map((m) => {
                        const ergebnis = checkProEmail.get(m.email.toLowerCase());
                        return (
                          <div
                            key={m.email}
                            className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-1.5"
                          >
                            <span className="text-sm text-ink">
                              {m.name}
                              <span className="ml-2 font-mono text-xs text-ink-faint">
                                {ergebnis
                                  ? `${ergebnis.score} / ${scoreRange.max}`
                                  : "noch keine Bewertung"}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => bearbeitenStarten(m.email.toLowerCase())}
                              className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint transition hover:text-accent"
                            >
                              {ergebnis ? "Bearbeiten" : "Bewerten"}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
          </div>
        )
      ) : (
        <p className="rounded-md border border-line bg-surface-2 px-4 py-3 text-sm text-ink-muted">
          Nur Personen mit Zugriff auf dieses Projekt können hier eine eigene
          Bewertungsreihe abgeben. Oben siehst du die Bewertungen aller
          Mitglieder.
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
