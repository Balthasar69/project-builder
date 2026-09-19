import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Brand from "@/components/Brand";
import WillkommenClient from "@/components/WillkommenClient";
import Aufklappbar from "@/components/Aufklappbar";
import { PHASES } from "@/lib/types";

export const dynamic = "force-dynamic";

// Erster Vorname aus dem vollen angezeigten Namen – für die persönliche
// Begrüßung (analog zu NaechsteSchritte.tsx).
function ersterVorname(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * Einmaliger Willkommens-Bildschirm (v0.62): erscheint automatisch, sobald
 * sich eine Person zum ersten Mal registriert bzw. anmeldet (siehe
 * Weiterleitung in `src/app/page.tsx`, gesteuert über
 * `User.einfuehrungGesehenAm`), und ist danach jederzeit über den kleinen
 * Link "Wie funktioniert das hier?" auf der Startseite erneut erreichbar.
 *
 * Text ab der Überschrift bis zur Phasenübersicht (v0.69) ist bewusst
 * wörtlich vorgegeben und nicht KI-frei formuliert – Änderungen daran
 * bitte nur direkt hier im Code vornehmen, nicht automatisch umschreiben.
 */
export default async function WillkommenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const vorname = ersterVorname(session.name);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="mb-10">
        <Brand />
      </div>

      <h1 className="mb-6 font-display text-3xl font-semibold text-ink sm:text-4xl">
        Willkommen {vorname} bei insightworx, deinem Projektmanagement.
      </h1>

      <p className="mb-4 max-w-[55ch] text-ink-muted">
        Hier setzt du deine Ideen mit deinem Team zusammen mit der
        Entscheiderakademie um. Du kannst hier all deine Ideen sammeln, alle
        Fähigkeiten und deine Vorstellungen des Teams festhalten. Die
        Entscheiderakademie begleitet das Vorhaben und führt es zu einer
        Business-Idee, und du kannst dich strukturiert und konzentriert auf
        deine Kompetenzen konzentrieren.
      </p>

      <p className="mb-8 max-w-[55ch] text-ink-muted">
        Im ersten Schritt sammeln wir, was Du und Dein Team an Kompetenz,
        Kapazität und an Zielen hast, danach schreiten wir in den nächsten
        Prozessabschnitt.
      </p>

      <div className="mb-10">
        <Aufklappbar buttonText="Phasenübersicht ansehen">
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line">
            {PHASES.filter((phase) => phase.code !== "parken").map((phase) => (
              <div
                key={phase.code}
                className="flex items-start gap-4 bg-surface px-4 py-2.5"
              >
                <span className="w-8 shrink-0 text-right font-mono text-sm text-ink-faint">
                  {String(phase.order).padStart(2, "0")}
                </span>
                <span>
                  <span className="text-sm font-medium text-ink">
                    {phase.name}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {phase.ziel}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Aufklappbar>
      </div>

      <div className="mb-10 flex flex-col gap-4">
        <div className="rounded-lg border border-line bg-surface px-5 py-4">
          <div className="mb-1 font-display text-base font-semibold text-ink">
            So funktioniert&apos;s
          </div>
          <p className="text-sm text-ink-muted">
            Ein Projekt durchläuft mehrere Phasen – von der Idee bis zum
            Verkauf. Auf der Projektseite siehst du immer auf einen Blick,
            wo ihr gerade steht und was als Nächstes ansteht.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface px-5 py-4">
          <div className="mb-1 font-display text-base font-semibold text-ink">
            Du musst nichts auswendig wissen
          </div>
          <p className="text-sm text-ink-muted">
            Du füllst einfach aus, was gerade gefragt ist – die App sagt dir,
            was als Nächstes drankommt, teils mit Unterstützung durch KI. In
            den meisten Feldern kannst du auch einfach draufsprechen, statt
            zu tippen.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface px-5 py-4">
          <div className="mb-1 font-display text-base font-semibold text-ink">
            Gemeinsam statt allein
          </div>
          <p className="text-sm text-ink-muted">
            Ihr arbeitet als Team an einem Projekt. Alle sehen denselben
            Stand, können sich austauschen und eigene Ideen einbringen.
          </p>
        </div>
      </div>

      <WillkommenClient />

      <p className="mt-6 text-xs text-ink-faint">
        Diese Erklärung findest du später jederzeit wieder über den Link
        „Wie funktioniert das hier?“ auf der Startseite.
      </p>
    </main>
  );
}
