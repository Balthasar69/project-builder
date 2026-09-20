import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllProjects } from "@/lib/data";
import { getSession, istBalthasar } from "@/lib/auth";
import { ermittleProjektStatus, ProjektStatus } from "@/lib/dashboardStatus";
import Brand from "@/components/Brand";
import LogoutButton from "@/components/LogoutButton";
import ReifegradRingKompakt from "@/components/ReifegradRingKompakt";

/** Dünner, horizontaler Reifegrad-Balken für die Tabelle ganz unten (kompakter als der Ring). */
function ReifegradBalken({ wert }: { wert: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.max(0, Math.min(100, wert))}%` }}
        />
      </div>
      <span className="tabular text-ink-muted">{wert}%</span>
    </div>
  );
}

export const dynamic = "force-dynamic";

function relativeZeit(iso: string | null): string {
  if (!iso) return "keine Angabe";
  const tage = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  );
  if (tage === 0) return "heute";
  if (tage === 1) return "gestern";
  return `vor ${tage} Tagen`;
}

function bewertungsFarbe(empfehlung?: "GO" | "WEITER PRÜFEN" | "STOPP" | null) {
  if (empfehlung === "GO") return "text-good";
  if (empfehlung === "STOPP") return "text-bad";
  if (empfehlung === "WEITER PRÜFEN") return "text-warn";
  return "text-ink-faint";
}

/**
 * Projektübergreifendes Dashboard (v0.66) – bewusst NUR für Balthasar
 * sichtbar (siehe `istBalthasar`), nicht für andere Admins oder Teams: zeigt
 * auf einen Blick, wie alle erfassten Projekte vorankommen, was ansteht,
 * was vorangeht und was hemmt. Nutzt ausschließlich bereits vorhandene
 * Daten (Phase, Reifegrad, Bewertung, Aktivität, offene Bitrix24-Aufgaben)
 * ohne zusätzliche KI-Einschätzung – auf Wunsch schnell und ohne Wartezeit.
 * Die genaue Herleitung von "hemmt"/"vorangeht" steht in
 * `src/lib/dashboardStatus.ts`.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!istBalthasar(session.email)) redirect("/");

  const projekte = await getAllProjects();
  const status: ProjektStatus[] = await Promise.all(
    projekte.map((p) => ermittleProjektStatus(p))
  );

  const hemmt = status.filter((s) => s.status === "hemmt");
  const vorangeht = status.filter((s) => s.status === "vorangeht");
  const ansteht = status.filter((s) => s.status === "ansteht");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Brand size="gross" />
          <span className="h-6 w-px bg-line" />
          <span className="whitespace-nowrap font-mono text-sm uppercase tracking-widest text-accent">
            Dashboard
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="whitespace-nowrap font-mono text-sm uppercase tracking-wide text-ink-faint hover:text-ink"
          >
            ← Alle Projekte
          </Link>
          <span className="h-4 w-px bg-line" />
          <span className="whitespace-nowrap text-sm text-ink-muted">{session.name}</span>
          <LogoutButton />
        </div>
      </div>

      <h1 className="mb-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
        Alle Projekte im Überblick
      </h1>
      <p className="mb-10 max-w-[60ch] text-ink-muted">
        Nur für dich sichtbar. Zeigt auf einen Blick, wie jedes Projekt
        vorankommt – auf Basis von Phase, Reifegrad, letzter Bewertung und
        Aktivität, ohne zusätzliche KI-Einschätzung.
      </p>

      {projekte.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-5 py-8 text-center text-sm text-ink-muted">
          Noch keine Projekte erfasst.
        </p>
      ) : (
        <>
          {/* Kennzahlen-Kacheln, wie im Projektcockpit (v0.63) */}
          <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            <div className="bg-surface px-4 py-3">
              <div className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
                Projekte
              </div>
              <div className="text-sm font-medium">{status.length}</div>
            </div>
            <div className="bg-surface px-4 py-3">
              <div className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
                Hemmt
              </div>
              <div className="text-sm font-medium text-bad">{hemmt.length}</div>
            </div>
            <div className="bg-surface px-4 py-3">
              <div className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
                Vorangeht
              </div>
              <div className="text-sm font-medium text-good">{vorangeht.length}</div>
            </div>
            <div className="bg-surface px-4 py-3">
              <div className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
                Ansteht
              </div>
              <div className="text-sm font-medium">{ansteht.length}</div>
            </div>
          </div>

          {hemmt.length > 0 && (
            <section className="mb-8 rounded-lg border border-line bg-surface p-5 sm:p-6">
              <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
                <h2 className="font-display text-xl font-semibold text-bad">
                  ⚠ Was hemmt
                </h2>
              </div>
              <div className="flex flex-col gap-5">
                {hemmt.map((s) => (
                  <div key={s.slug} className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${s.slug}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {s.name}
                      </Link>
                      <span className="ml-2 text-xs text-ink-faint">
                        {s.phase.order}. {s.phase.name}
                      </span>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {s.gruende.map((g, i) => (
                          <li key={i} className="text-sm text-ink-muted">
                            – {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <ReifegradRingKompakt
                      aktuell={s.phase.code}
                      bereichStatus={s.bereichStatus}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {vorangeht.length > 0 && (
            <section className="mb-8 rounded-lg border border-line bg-surface p-5 sm:p-6">
              <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
                <h2 className="font-display text-xl font-semibold text-good">
                  ✓ Was vorangeht
                </h2>
              </div>
              <div className="flex flex-col gap-5">
                {vorangeht.map((s) => (
                  <div key={s.slug} className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${s.slug}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {s.name}
                      </Link>
                      <span className="ml-2 text-xs text-ink-faint">
                        {s.phase.order}. {s.phase.name}
                      </span>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {s.gruende.map((g, i) => (
                          <li key={i} className="text-sm text-ink-muted">
                            – {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <ReifegradRingKompakt
                      aktuell={s.phase.code}
                      bereichStatus={s.bereichStatus}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {ansteht.length > 0 && (
            <section className="mb-10 rounded-lg border border-line bg-surface p-5 sm:p-6">
              <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
                <h2 className="font-display text-xl font-semibold">
                  Was als Nächstes ansteht
                </h2>
              </div>
              <div className="flex flex-col gap-5">
                {ansteht.map((s) => (
                  <div key={s.slug} className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${s.slug}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {s.name}
                      </Link>
                      <span className="ml-2 text-xs text-ink-faint">
                        {s.phase.order}. {s.phase.name}
                      </span>
                      <p className="mt-1 text-sm text-ink-muted">{s.phase.ziel}</p>
                    </div>
                    <ReifegradRingKompakt
                      aktuell={s.phase.code}
                      bereichStatus={s.bereichStatus}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Vollständige Tabelle aller Projekte, unabhängig vom Status oben. */}
          <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
            <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
              <h2 className="font-display text-xl font-semibold">Alle Projekte</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
                    <th className="pb-2 pr-3">Projekt</th>
                    <th className="pb-2 pr-3">Phase</th>
                    <th className="pb-2 pr-3">Reifegrad</th>
                    <th className="pb-2 pr-3">Bewertung</th>
                    <th className="pb-2 pr-3">Aufgaben offen</th>
                    <th className="pb-2">Letzte Aktivität</th>
                  </tr>
                </thead>
                <tbody>
                  {status.map((s) => (
                    <tr key={s.slug} className="border-t border-line">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/projects/${s.slug}`}
                          className="font-medium text-ink hover:text-accent"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-ink-muted">
                        {s.phase.order}. {s.phase.name}
                      </td>
                      <td className="py-2 pr-3">
                        <ReifegradBalken wert={s.reifegrad} />
                      </td>
                      <td className={`py-2 pr-3 font-medium ${bewertungsFarbe(s.bewertung?.empfehlung)}`}>
                        {s.bewertung?.empfehlung ?? "–"}
                      </td>
                      <td className="py-2 pr-3 tabular text-ink-muted">
                        {s.offeneAufgaben ?? "–"}
                      </td>
                      <td className="py-2 text-ink-muted">
                        {relativeZeit(s.letzteAktivitaetAm)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
