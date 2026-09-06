const SPALTEN: {
  label: string;
  farbeKlasse: string; // Tailwind-Textfarbe für Icon + Rahmen dieser Spalte
  icon: JSX.Element;
  punkte: { label: string; href: string; neu?: boolean }[];
}[] = [
  {
    label: "Orga",
    farbeKlasse: "text-accent border-accent",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
      </>
    ),
    punkte: [
      { label: "Kernteam", href: "#kernteam" },
      { label: "Team", href: "#team" },
      { label: "Kompetenzen", href: "#kompetenzen", neu: true },
    ],
  },
  {
    label: "Dashboard",
    farbeKlasse: "text-brand-red border-brand-red",
    icon: (
      <>
        <path d="M5 3v18" />
        <path d="M5 4h11l-2 4 2 4H5" />
      </>
    ),
    punkte: [
      { label: "Fortschritt", href: "#fortschritt" },
      { label: "Phasen", href: "#phasenverlauf" },
      { label: "Bewertung", href: "#bewertung" },
    ],
  },
  {
    label: "Dynamik",
    farbeKlasse: "text-brand-green border-brand-green",
    icon: (
      <>
        <path d="M4 6h2M4 12h2M4 18h2" />
        <path d="M9 6h11M9 12h11M9 18h11" />
      </>
    ),
    punkte: [
      { label: "Aufgaben", href: "#aufgaben" },
      { label: "Ideen", href: "#ideen" },
      { label: "Chat", href: "#chat", neu: true },
    ],
  },
];

/**
 * Kompakte Hub-Navigation oben im Projektcockpit (seit v0.46, ersetzt die
 * frühere 4er-Schnellzugriff-Kachelreihe): drei schmale Spalten – Orga,
 * Dashboard, Dynamik –, deren Unterpunkte alle sofort sichtbar sind statt in
 * Reitern versteckt. Jeder Punkt ist ein Sprunglink zum jeweiligen Bereich
 * weiter unten auf derselben Seite (der dort bereits vollständig sichtbar
 * ist); die Spaltenfarben greifen bewusst die drei Logo-Farben auf, in
 * derselben Reihenfolge wie im Ring darüber (Blau/Rot/Grün von außen nach
 * innen).
 */
export default function ProjektHubNav() {
  return (
    <div className="mb-2">
      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        {SPALTEN.map((spalte) => (
          <div key={spalte.label} className="min-w-0">
            <div
              className={`mb-2 flex flex-col items-center gap-1 border-b-2 pb-2 ${spalte.farbeKlasse}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {spalte.icon}
              </svg>
              <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-ink">
                {spalte.label}
              </span>
            </div>
            <div className="flex flex-col">
              {spalte.punkte.map((punkt) => (
                <a
                  key={punkt.href}
                  href={punkt.href}
                  className="border-t border-line py-2 text-center text-[0.8rem] leading-snug text-ink transition first:border-t-0 hover:text-accent"
                >
                  {punkt.label}
                  {punkt.neu && (
                    <span
                      aria-hidden
                      className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle"
                    />
                  )}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
