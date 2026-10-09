"use client";

/**
 * Oeffnet den Druckdialog des Browsers - dort "Als PDF sichern" waehlen
 * (Mac: unten links im Dialog "PDF"; Windows/Chrome: Ziel "Als PDF
 * speichern"). Die Seite ist dafuer mit eigenen Druck-Regeln (A4, Seiten-
 * umbrueche, ohne Buttons) ausgestattet, siehe globals.css.
 */
export default function BusinessplanDruckButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink"
    >
      Als PDF speichern / drucken
    </button>
  );
}
