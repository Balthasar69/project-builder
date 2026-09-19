import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Brand from "@/components/Brand";
import WillkommenClient from "@/components/WillkommenClient";

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
 * Bewusst kurz und ohne Fachbegriffe gehalten (siehe Vorgabe: die
 * Mitglieder haben in der Regel keine Projektmanagement- oder
 * IT-Kenntnisse) – drei einfache Blöcke statt einer langen Anleitung.
 *
 * Hinweis (v0.70): die projektspezifische insightworx/Entscheiderakademie-
 * Einordnung samt Phasenübersicht steht jetzt direkt in Phase 1 jedes
 * Projekts (siehe src/app/projects/[slug]/page.tsx), nicht mehr hier –
 * hier bleibt bewusst nur die allgemeine, phasenunabhängige Erklärung.
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

      <h1 className="mb-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
        Willkommen, {vorname}!
      </h1>
      <p className="mb-10 max-w-[55ch] text-ink-muted">
        Schön, dass du dabei bist. Diese App begleitet euch Schritt für
        Schritt dabei, aus einer Idee ein echtes, erfolgreiches Projekt zu
        machen – von der ersten Idee bis zum ersten zahlenden Kunden.
      </p>

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
