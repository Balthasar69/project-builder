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
 * Der Button ist bewusst auffällig (fette, farbige Schrift statt nur
 * dünnem Rahmen) gestaltet, damit der Klick zum Öffnen nicht übersehen
 * wird – ohne flächigen Farbhintergrund, der auf Wunsch als zu präsent
 * empfunden wurde (v0.59).
 *
 * Seit v0.64 lässt sich ein geöffneter Bereich über einen dezenten
 * "Schließen"-Button unter dem Inhalt auch wieder einklappen (vorher: nur
 * einmaliges, dauerhaftes Öffnen) – für Übersichtlichkeit, wenn mehrere
 * Bereiche nacheinander geöffnet wurden.
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
        className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm font-bold text-accent transition hover:text-accent-ink"
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

  return (
    <div>
      {children}
      <button
        type="button"
        onClick={() => setOffen(false)}
        className="mt-4 flex items-center gap-2 rounded-md px-1 py-1.5 text-sm font-medium text-ink-faint transition hover:text-ink"
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
          <path d="M6 15l6-6 6 6" />
        </svg>
        Schließen
      </button>
    </div>
  );
}
