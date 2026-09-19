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
 *
 * `hervorgehoben` (v0.74): nach der Projektfreigabe (Phase > 6) wird
 * derselbe Button bewusst größer/auffälliger dargestellt, weil die
 * Steuerung dann der nächste konkrete Schritt ist statt nur ein
 * fernes Ziel.
 */
export default function SteuerungUebergang({
  url,
  hervorgehoben = false,
}: {
  url?: string;
  hervorgehoben?: boolean;
}) {
  const [offen, setOffen] = useState(false);

  const stil = hervorgehoben
    ? "inline-flex w-fit items-center gap-2.5 rounded-md bg-accent px-6 py-3.5 text-base font-semibold text-surface shadow-sm transition hover:bg-accent-ink"
    : "inline-flex w-fit items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink";

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
