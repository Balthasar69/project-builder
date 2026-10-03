import Image from "next/image";

/**
 * Partner-Badge "Ein Projekt der Entscheiderakademie" (Redesign 10/2026).
 *
 * Hintergrund: Der Project Builder bekommt ein globales Farb-/Typografie-
 * Redesign im Stil der Entscheiderakademie-Website (siehe tailwind.config.ts
 * + layout.tsx), gilt für ALLE Projekte in diesem Tool. Das bisherige
 * insightworx/O&K-Logo (Brand.tsx) bleibt dabei ausdrücklich die
 * Haupt-Marke – auf ausdrücklichen Wunsch unverändert. Dieses Badge steht
 * rechts daneben und ordnet zusätzlich ein: alle Projekte hier entstehen aus
 * dem Netzwerk der Entscheiderakademie.
 *
 * Logo-Datei `/public/eak-logo.png`: pixelgenau aus einem echten Screenshot
 * von entscheiderakademie.de ausgeschnitten (nicht nachgebaut).
 */
export default function EakBadge() {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <Image
        src="/eak-logo.png"
        alt="Entscheiderakademie"
        width={40}
        height={38}
        unoptimized
        className="h-5 w-auto sm:h-6"
      />
      <span className="text-xs font-medium text-ink-faint sm:text-sm">
        Ein Projekt der Entscheiderakademie
      </span>
    </span>
  );
}
