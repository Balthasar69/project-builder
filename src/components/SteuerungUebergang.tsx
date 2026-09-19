"use client";

import { useState } from "react";

/**
 * Button "Zur Steuerung (Projektmanagement)" oben im Projektcockpit
 * (v0.73) – bewusst von Anfang an sichtbar, nicht erst ab der
 * Projektfreigabe, um schon früh Motivation und ein klares Zielbild zu
 * schaffen ("wo geht die Reise hin"). Solange für dieses Projekt noch
 * keine Steuerboard-Kopie existiert (`url` also nicht gesetzt ist),
 * führt ein Klick nirgendwo hin, sondern klappt stattdessen einen
 * kurzen, festen Hinweistext auf/zu. Sobald `url` gesetzt ist, wird
 * daraus ein echter, extern öffnender Link.
 */
export default function SteuerungUebergang({ url }: { url?: string }) {
  const [offen, setOffen] = useState(false);

  const stil =
    "inline-flex w-fit items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink";

  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={stil}>
        Zur Steuerung (Projektmanagement) →
      </a>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className={stil}
      >
        Zur Steuerung (Projektmanagement) →
      </button>
      {offen && (
        <p className="max-w-[55ch] rounded-md border border-line bg-surface-2 px-4 py-3 text-sm text-ink-muted">
          Bald ist es so weit: Die Phase Project Building ist dann
          vollendet, und es geht ins Projektmanagement. Komm dann wieder
          hier zurück.
        </p>
      )}
    </div>
  );
}
