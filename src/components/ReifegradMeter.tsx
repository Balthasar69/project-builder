import { REIFEGRAD_BEREICHE, BereichStatus } from "@/lib/types";
import { ampelFuerBereich, berechneReifegrad } from "@/lib/scoring";

const AMPEL_KLASSE: Record<string, string> = {
  gruen: "bg-good",
  gelb: "bg-warn",
  rot: "bg-bad",
};

export default function ReifegradMeter({ status }: { status: BereichStatus }) {
  const reifegrad = berechneReifegrad(status);

  return (
    <div>
      <div className="mb-4 flex items-end gap-3">
        <span className="font-display text-4xl font-semibold tabular">
          {reifegrad}%
        </span>
        <span className="mb-1 text-sm text-ink-muted">Gesamt-Reifegrad</span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${reifegrad}%` }}
        />
      </div>
      <div className="flex flex-col gap-2">
        {REIFEGRAD_BEREICHE.map((b) => {
          const wert = status[b.code] ?? 0;
          const ampel = ampelFuerBereich(wert);
          return (
            <div key={b.code} className="flex items-center gap-3">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${AMPEL_KLASSE[ampel]}`}
                aria-hidden
              />
              <span className="w-32 shrink-0 text-sm text-ink">
                {b.name}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-ink-faint"
                  style={{ width: `${wert}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-xs tabular text-ink-faint">
                {wert}%
              </span>
              <span className="w-10 shrink-0 text-right font-mono text-[0.65rem] text-ink-faint">
                {b.gewicht}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
