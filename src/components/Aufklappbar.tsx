"use client";

import { ReactNode, useState } from "react";

/**
 * Allgemeiner Ein-/Ausklapp-Baustein: zeigt zunächst nur einen Button mit
 * `buttonText" (z. B. "Kernteam sehen") und blendet den eigentlichen Inhalt
 * erst nach einem Klick ein – genutzt für Kernteam/Team im Projektcockpit,
 * seit v0.58 zusätzlich für Kompetenzen, Reifegrad je Bereich,
 * Phasenverlauf, Projekt-Check und Aufgaben, damit diese (oft längeren)
 * Bereiche nicht sofort die ganze Seite füllen.
 *
 * Der Button ist bewusst auffällig (kräftige Akzentfarbe statt nur ein
 * dünner Rahmen) gestaltet, damit der Klick zum Öffnen nicht übersehen
 * wird – auf ausdrücklichen Wunsch.
 */
export default function Aufklappbar({
  buttonText,
  children,
}: {
  buttonText: string;
  children: ReactNode;
}) {
  const [offen, setOffen] = useState(false);

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-surface shadow-sm transition hover:bg-accent-ink"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        {buttonText}
      </button>
    );
  }

  return <>{children}</>;
}
