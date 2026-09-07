// Jede Farbklasse steht hier bewusst als vollständiger, wörtlicher
// Tailwind-Klassenname (statt zur Laufzeit aus einem Farbnamen
// zusammengesetzt) – Tailwinds Build-Schritt erkennt nur Klassennamen, die
// irgendwo im Quelltext als vollständige Zeichenkette auftauchen; aus
// Teilstücken zusammengesetzte Namen (z. B. `hover:${farbe}`) würden sonst
// beim Bauen der Seite lautlos wegfallen.
const SPALTEN: {
  label: string;
  // Textfarbe für Icon + Spaltentitel dieser Spalte. Dynamik nutzt bewusst
  // "text-good" (dunkleres Oliv-Grün aus derselben Logo-Farbfamilie) statt
  // des helleren "brand-green" direkt – als große, fette Schrift auf dem
  // hellen Hintergrund wäre "brand-green" sonst zu schwach lesbar.
  textKlasse: string;
  hoverKlasse: string; // z. B. "hover:text-brand-blue" für die Unterpunkte
  dotKlasse: string; // Hintergrundfarbe für den "neu"-Punkt, z. B. "bg-brand-blue"
  borderKlasse: string;
  bgKlasse: string; // sanfter Farbton als Hintergrund der ganzen Spalte
  icon: JSX.Element;
  punkte: { label: string; href: string; neu?: boolean }[];
}[] = [
  {
    label: "Orga",
    textKlasse: "text-brand-blue",
    hoverKlasse: "hover:text-brand-blue",
    dotKlasse: "bg-brand-blue",
    borderKlasse: "border-brand-blue",
    bgKlasse: "bg-accent-soft/70",
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
    textKlasse: "text-brand-red",
    hoverKlasse: "hover:text-brand-red",
    dotKlasse: "bg-brand-red",
    borderKlasse: "border-brand-red",
    bgKlasse: "bg-bad-soft/70",
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
    textKlasse: "text-good",
    hoverKlasse: "hover:text-good",
    dotKlasse: "bg-good",
    borderKlasse: "border-brand-green",
    bgKlasse: "bg-brand-green-soft/70",
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
 * innen). Seit v0.55 deutlich prominenter: jede Spalte ist eine eigene,
 * farblich getönte Karte, Titel und Icon sind größer und tragen die
 * Spaltenfarbe direkt (statt nur den Rahmen), die Unterpunkte sind größer
 * und fetter gesetzt.
 */
export default function ProjektHubNav() {
  return (
    <div className="mb-3">
      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        {SPALTEN.map((spalte) => (
          <div
            key={spalte.label}
            className={`min-w-0 rounded-lg ${spalte.bgKlasse} px-2 py-3 sm:px-3 sm:py-4`}
          >
            <div
              className={`mb-2 flex flex-col items-center gap-1.5 border-b-2 pb-2.5 sm:pb-3 ${spalte.borderKlasse}`}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`sm:h-8 sm:w-8 ${spalte.textKlasse}`}
              >
                {spalte.icon}
              </svg>
              <span
                className={`font-display text-base font-bold uppercase tracking-wide sm:text-lg ${spalte.textKlasse}`}
              >
                {spalte.label}
              </span>
            </div>
            <div className="flex flex-col">
              {spalte.punkte.map((punkt) => (
                <a
                  key={punkt.href}
                  href={punkt.href}
                  className={`border-t border-line/70 py-2.5 text-center text-sm font-medium leading-snug text-ink transition first:border-t-0 sm:text-base ${spalte.hoverKlasse}`}
                >
                  {punkt.label}
                  {punkt.neu && (
                    <span
                      aria-hidden
                      className={`ml-1.5 inline-block h-2 w-2 rounded-full align-middle ${spalte.dotKlasse}`}
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
