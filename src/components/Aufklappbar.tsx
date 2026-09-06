"use client";

import { ReactNode, useState } from "react";

/**
 * Allgemeiner Ein-/Ausklapp-Baustein: zeigt zunächst nur einen Button mit
 * `buttonText" (z. B. "Kernteam sehen") und blendet den eigentlichen Inhalt
 * erst nach einem Klick ein – genutzt für Kernteam/Team im Projektcockpit,
 * damit diese (oft längeren) Bereiche nicht sofort die ganze Seite füllen.
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
        className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:text-accent"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
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
