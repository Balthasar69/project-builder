import Image from "next/image";

/**
 * Logo im Kopfbereich jeder Seite (CD-Branding KULTO insightworx – O&K).
 * Ersetzt den früheren reinen Text-Schriftzug "Project Builder".
 * Die Bilddatei liegt unter /public/logo.png.
 *
 * `size` steuert die Höhe: "normal" (Standard, für Login/Registrierung/
 * Übersicht) oder "gross" (fürs Projektcockpit, auf Wunsch größer als der
 * Rest der App).
 */
export default function Brand({ size = "normal" }: { size?: "normal" | "gross" }) {
  return (
    <Image
      src="/logo.png"
      alt="KULTO insightworx – O&K Organisation und Kommunikation"
      width={440}
      height={140}
      priority
      className={size === "gross" ? "h-20 w-auto sm:h-24" : "h-14 w-auto sm:h-16"}
    />
  );
}
