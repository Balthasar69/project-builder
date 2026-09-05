"use client";

import { useState } from "react";
import { CheckResult, KernteamMitglied, PHASES, PhaseCode } from "@/lib/types";
import PhaseBewertungDetail from "./PhaseBewertungDetail";

const BITRIX_LABEL: Record<string, string> = {
  nein: "App",
  teilweise: "App / teilweise",
  übergang: "Übergang",
  ja: "Bitrix24",
};

export default function PhaseTracker({
  aktuell,
  checkVerlauf,
  kernteam,
}: {
  aktuell: PhaseCode;
  checkVerlauf: CheckResult[];
  kernteam: KernteamMitglied[];
}) {
  const [offenePhase, setOffenePhase] = useState<PhaseCode | null>(null);
  const aktuelleOrder = PHASES.find((p) => p.code === aktuell)?.order ?? 0;
  const hauptPhasen = PHASES.filter((p) => p.code !== "parken");
  const parken = PHASES.find((p) => p.code === "parken")!;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex flex-col divide-y divide-line">
        {hauptPhasen.map((phase) => {
          const status =
            phase.order < aktuelleOrder
              ? "erledigt"
              : phase.order === aktuelleOrder
              ? "aktuell"
              : "offen";
          const istOffen = offenePhase === phase.code;
          return (
            <div key={phase.code}>
              <button
                type="button"
                onClick={() =>
                  setOffenePhase((p) => (p === phase.code ? null : phase.code))
                }
                className={`grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-4 px-4 py-2.5 text-left transition hover:brightness-95 ${
                  status === "aktuell" ? "bg-accent-soft" : "bg-surface"
                }`}
              >
                <span
                  className={`text-right font-mono text-sm ${
                    status === "aktuell"
                      ? "font-semibold text-accent-ink"
                      : status === "erledigt"
                      ? "text-ink-faint"
                      : "text-ink-faint"
                  }`}
                >
                  {String(phase.order).padStart(2, "0")}
                </span>
                <span>
                  <span
                    className={`text-sm ${
                      status === "offen"
                        ? "text-ink-muted"
                        : "font-medium text-ink"
                    }`}
                  >
                    {phase.name}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {phase.ziel}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {status === "erledigt" && (
                    <span className="rounded-full bg-good-soft px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-good">
                      erledigt
                    </span>
                  )}
                  {status === "aktuell" && (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-surface">
                      aktuell
                    </span>
                  )}
                  {phase.code === "freigabe" && (
                    <span className="rounded-full bg-warn-soft px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-warn">
                      Gate
                    </span>
                  )}
                  <span className="hidden font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint sm:inline">
                    {BITRIX_LABEL[phase.bitrix24]}
                  </span>
                  <span className="font-mono text-xs text-ink-faint">
                    {istOffen ? "▲" : "▾"}
                  </span>
                </span>
              </button>
              {istOffen && (
                <div className="border-t border-line bg-surface-2">
                  <PhaseBewertungDetail
                    phase={phase.code}
                    checkVerlauf={checkVerlauf}
                    kernteam={kernteam}
                  />
                </div>
              )}
            </div>
          );
        })}
        <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 bg-pending-soft px-4 py-2.5">
          <span className="text-right font-mono text-sm text-ink-faint">—</span>
          <span>
            <span className="text-sm text-ink-muted">{parken.name}</span>
            <span className="block text-xs text-ink-muted">{parken.ziel}</span>
          </span>
          <span />
        </div>
      </div>
    </div>
  );
}
