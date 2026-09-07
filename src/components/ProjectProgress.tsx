import { PHASES, PhaseCode, BereichStatus } from "@/lib/types";
import { berechneReifegrad } from "@/lib/scoring";

// Die drei Logo-Farben, im Wechsel für die Phasen-Ringe (v0.46) – vorher ein
// gleichmäßig über den ganzen Farbkreis verteilter Regenbogen, jetzt bewusst
// nur noch Blau/Rot/Grün aus dem Logo, damit die CD-Farben im ganzen Cockpit
// wiedererkennbar bleiben statt beliebiger Zwischentöne.
const RING_FARBEN = ["#006fc0", "#be0000", "#8cc63e"];

/**
 * Grafische Gesamt-Fortschrittsanzeige oben im Projektcockpit: ein Ring pro
 * Phase, ineinander verschachtelt wie bei einer Zielscheibe – der innerste
 * Ring ist Phase 1, jede weitere Phase kommt als eigener Ring nach außen
 * dazu. Jede Phase bekommt der Reihe nach eine der drei Logo-Farben; erreichte
 * Phasen sind volltonig, offene blass. Der Gesamt-Reifegrad (Kapitel 9) steht
 * als Zahl in der Mitte.
 */
export default function ProjectProgress({
  aktuell,
  bereichStatus,
}: {
  aktuell: PhaseCode;
  bereichStatus: BereichStatus;
}) {
  const hauptPhasen = PHASES.filter((p) => p.code !== "parken").sort(
    (a, b) => a.order - b.order
  );
  const istGeparkt = aktuell === "parken";
  const aktuelleOrder = PHASES.find((p) => p.code === aktuell)?.order ?? 0;
  const aktuellePhaseObj = PHASES.find((p) => p.code === aktuell);
  const reifegrad = berechneReifegrad(bereichStatus);

  const groesse = 208;
  const mitte = groesse / 2;
  const startRadius = 16;
  const ringAbstand = 6.2;
  const strichbreite = 5;

  return (
    <div className="mb-10 flex flex-col items-center gap-6 rounded-lg border border-line bg-surface px-6 py-6 sm:flex-row sm:justify-center sm:gap-10">
      {/* Der Ring zeigt nur noch die Phasen selbst; die Prozentzahl steht
          seit v0.56 nicht mehr direkt darunter, sondern prominent über der
          Überschrift "Projektfortschritt" auf der rechten Seite (auf
          Wunsch), statt wie zuvor eng am Ring zu kleben. */}
      <div className="flex shrink-0 flex-col items-center">
        <svg
          width={groesse}
          height={groesse}
          viewBox={`0 0 ${groesse} ${groesse}`}
        >
          {hauptPhasen.map((phase, i) => {
            const radius = startRadius + i * ringAbstand;
            const erreicht = !istGeparkt && phase.order <= aktuelleOrder;
            const istAktuell = !istGeparkt && phase.order === aktuelleOrder;
            const farbe = RING_FARBEN[i % RING_FARBEN.length];
            return (
              <circle
                key={phase.code}
                cx={mitte}
                cy={mitte}
                r={radius}
                fill="none"
                stroke={farbe}
                strokeWidth={istAktuell ? strichbreite + 2.5 : strichbreite}
                opacity={erreicht ? 1 : 0.16}
              >
                <title>
                  {phase.order}. {phase.name}
                  {istAktuell ? " (aktuell)" : erreicht ? " (erledigt)" : " (offen)"}
                </title>
              </circle>
            );
          })}
        </svg>
      </div>

      <div className="max-w-[42ch] text-center sm:text-left">
        <div className="flex flex-col items-center sm:items-start">
          <span className="font-display text-4xl font-semibold tabular text-ink">
            {reifegrad}%
          </span>
          <span className="text-[0.65rem] uppercase tracking-wide text-ink-faint">
            Reifegrad
          </span>
        </div>
        <span className="mt-3 block font-mono text-xs uppercase tracking-widest text-ink-faint">
          Projektfortschritt
        </span>
        <div className="mt-1 font-display text-lg font-semibold text-ink">
          {istGeparkt
            ? "Projekt ist aktuell geparkt"
            : `Phase ${aktuelleOrder} von ${hauptPhasen.length}: ${aktuellePhaseObj?.name}`}
        </div>
        <p className="mt-1.5 text-sm text-ink-muted">
          Jeder Ring steht für eine Phase – innen Phase 1, außen die letzte
          Phase. Volle Farbe = Phase erreicht, blass = noch offen.
        </p>
      </div>
    </div>
  );
}
