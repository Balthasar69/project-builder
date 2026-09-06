import { PHASES, PhaseCode, BereichStatus } from "@/lib/types";
import { berechneReifegrad } from "@/lib/scoring";

// Dieselben drei Logo-Farben wie im großen Ring (ProjectProgress.tsx) – siehe
// dort für die ausführliche Begründung.
const RING_FARBEN = ["#006fc0", "#be0000", "#8cc63e"];

/**
 * Kompakte Ring-Grafik oben im Projektcockpit-Hub, direkt neben Titel und
 * Beschreibung (seit v0.46). Zeigt dieselben ineinander verschachtelten
 * Phasen-Ringe wie die große Fortschrittsanzeige weiter unten, nur kleiner –
 * und bewusst mit der Prozentzahl UNTER statt IN dem Ring, damit sie bei der
 * kleinen Größe gut lesbar bleibt.
 */
export default function ReifegradRingKompakt({
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
  const reifegrad = berechneReifegrad(bereichStatus);

  const groesse = 88;
  const mitte = groesse / 2;
  const startRadius = 7;
  const ringAbstand = 2.6;
  const strichbreite = 1.8;

  return (
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
              strokeWidth={istAktuell ? strichbreite + 1.2 : strichbreite}
              opacity={erreicht ? 1 : 0.16}
            />
          );
        })}
      </svg>
      <span className="mt-1 font-display text-lg font-semibold leading-none text-ink">
        {reifegrad}%
      </span>
      <span className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-faint">
        Reifegrad
      </span>
    </div>
  );
}
