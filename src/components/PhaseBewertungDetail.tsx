import {
  CheckResult,
  KernteamMitglied,
  PhaseCode,
  checkKriterienFuerPhase,
  checksProPersonFuerPhase,
} from "@/lib/types";
import { checkScoreRange, durchschnittFuerPhase } from "@/lib/scoring";

const EMPFEHLUNG_STYLE: Record<CheckResult["empfehlung"], string> = {
  GO: "bg-good-soft text-good",
  "WEITER PRÜFEN": "bg-warn-soft text-warn",
  STOPP: "bg-bad-soft text-bad",
};

function vorname(name: string): string {
  return name.split(" ")[0] || name;
}

/**
 * Rein lesende Ansicht der Bewertungen einer einzelnen Phase – für alle mit
 * Projektzugriff, unabhängig davon, wer bewerten darf. Zeigt genau dieselben
 * Bewertungsreihen je Frage wie im aktiven Projekt-Check, aber ohne
 * Eingabemöglichkeit, damit sich frühere (oder die aktuelle) Bewertungen
 * jederzeit nachvollziehen lassen, ohne sie versehentlich zu verändern.
 * Das Setzen/Zurücksetzen der Phase selbst bleibt davon unberührt weiterhin
 * ausschließlich Admins vorbehalten (siehe PhaseAdvance).
 */
export default function PhaseBewertungDetail({
  phase,
  checkVerlauf,
  kernteam,
}: {
  phase: PhaseCode;
  checkVerlauf: CheckResult[];
  kernteam: KernteamMitglied[];
}) {
  const kriterien = checkKriterienFuerPhase(phase);
  const scoreRange = checkScoreRange(phase);
  const checks = checksProPersonFuerPhase(checkVerlauf, phase);
  const durchschnitt = durchschnittFuerPhase(checks, phase);

  const bewerterListe = kernteam.filter(
    (m): m is KernteamMitglied & { email: string } => !!m.email
  );
  const checkProEmail = new Map<string, CheckResult>();
  for (const c of checks) {
    if (c.bewerterEmail) checkProEmail.set(c.bewerterEmail.toLowerCase(), c);
  }
  // Nur Personen anzeigen, die für diese Phase tatsächlich etwas abgegeben
  // haben – anders als im aktiven Check, wo auch noch-nicht-bewertende
  // Kernteam-Mitglieder als leere Zeile auftauchen sollen.
  const bewerterMitEintrag = bewerterListe.filter((m) =>
    checkProEmail.has(m.email.toLowerCase())
  );

  if (checks.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-ink-faint">
        Noch keine Bewertung für diese Phase abgegeben.
      </p>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-4 flex flex-col gap-4">
        {kriterien.map((c) => (
          <div key={c.code} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium text-ink">{c.frage}</span>
              <span className="text-xs text-ink-faint">{c.hilfe}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-md border border-line bg-surface-2 p-2">
              {bewerterMitEintrag.map((m) => {
                const wert = checkProEmail.get(m.email.toLowerCase())?.answers[c.code];
                return (
                  <div key={m.email} className="flex items-center gap-3">
                    <span
                      className="w-28 shrink-0 truncate text-xs text-ink-muted"
                      title={m.name}
                    >
                      {vorname(m.name)}
                    </span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((stufe) => (
                        <span
                          key={stufe}
                          className={`flex h-7 w-7 items-center justify-center rounded-md font-mono text-xs ${
                            wert === stufe
                              ? "bg-ink-faint text-surface"
                              : "bg-surface text-ink-faint opacity-50"
                          }`}
                        >
                          {stufe}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {durchschnitt && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-md border border-line bg-surface px-4 py-2.5">
          <span className="text-sm text-ink-muted">
            Gemeinsamer Score: {durchschnitt.score} / {scoreRange.max} ·{" "}
            {durchschnitt.anzahlBewerter}{" "}
            {durchschnitt.anzahlBewerter === 1 ? "Bewertung" : "Bewertungen"} ·
            zuletzt am{" "}
            {new Date(durchschnitt.zuletztAm).toLocaleDateString("de-DE")}
          </span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide ${
              EMPFEHLUNG_STYLE[durchschnitt.empfehlung]
            }`}
          >
            {durchschnitt.empfehlung}
          </span>
        </div>
      )}

      {checks.some((c) => c.notiz) && (
        <div className="flex flex-col gap-2">
          {checks
            .filter((c) => c.notiz)
            .map((c) => (
              <div
                key={c.bewerterEmail ?? c.durchgefuehrtAm}
                className="rounded-md border border-line bg-surface px-3 py-2"
              >
                <span className="block text-xs font-medium text-ink">
                  {c.bewerterName ?? "Unbekannt"}
                </span>
                <span className="text-sm text-ink-muted">{c.notiz}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
