import Image from "next/image";

/**
 * Logo im Kopfbereich jeder Seite (CD-Branding insightworx – O&K). Ersetzt
 * den früheren reinen Text-Schriftzug "Project Builder". Die Bilddatei
 * liegt unter /public/logo.png (seit v0.46 ohne die Zeile "KULTO"; seit
 * v0.57 mit repariertem Kreis-Icon – die rechte Hälfte des Rings war durch
 * einen alten Bearbeitungsfehler leicht verschoben und dadurch nicht mehr
 * rund/geschlossen, jetzt spiegelbildlich zur unbeschädigten linken Hälfte
 * neu zusammengesetzt).
 *
 * Der Anhang "?v=46" an der Bild-URL ist bewusst gesetzt: Browser/CDN
 * merken sich Bilder unter derselben Adresse oft sehr lange (auch nach
 * einem neuen Deployment) – ohne diesen Zusatz hätten manche Nutzer:innen
 * trotz korrekt ausgetauschter Datei noch die alte Version im Cache
 * gesehen. Bei einem künftigen erneuten Logo-Austausch einfach die Zahl
 * hochzählen (z. B. "?v=47"), dann laden alle garantiert die neue Version.
 *
 * `size` steuert die Höhe: "normal" (Standard, für Login/Registrierung/
 * Übersicht) oder "gross" (fürs Projektcockpit, auf Wunsch größer als der
 * Rest der App).
 */
export default function Brand({ size = "normal" }: { size?: "normal" | "gross" }) {
  return (
    <Image
      src="/logo.png?v=57"
      alt="insightworx – O&K Organisation und Kommunikation"
      width={440}
      height={140}
      priority
      unoptimized
      className={size === "gross" ? "h-20 w-auto sm:h-24" : "h-14 w-auto sm:h-16"}
    />
  );
}
