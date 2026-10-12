// Gemeinsame Prüfung für angehängte Bilder/Screenshots (Aufgaben-Notizen und
// Team-Chat). Die Bilder kommen vom Browser bereits verkleinert als JPEG
// (siehe bildKlient.ts) und werden hier trotzdem serverseitig geprüft.

export const MAX_BILDER_PRO_NACHRICHT = 4;
const MAX_EINZEL_ZEICHEN = 1_500_000; // ≈ 1,1 MB je Bild
const MAX_GESAMT_ZEICHEN = 3_600_000; // Vercel erlaubt ca. 4,5 MB je Anfrage

const KOPF = /^data:image\/(jpeg|png|webp);base64,/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function pruefeBilder(roh: unknown): { bilder: string[] } | { fehler: string } {
  if (roh == null) return { bilder: [] };
  if (!Array.isArray(roh)) return { fehler: "Ungültige Bilddaten." };
  if (roh.length > MAX_BILDER_PRO_NACHRICHT) {
    return { fehler: `Höchstens ${MAX_BILDER_PRO_NACHRICHT} Bilder pro Nachricht.` };
  }
  let gesamt = 0;
  const bilder: string[] = [];
  for (const b of roh) {
    if (typeof b !== "string") return { fehler: "Ungültige Bilddaten." };
    const kopf = KOPF.exec(b);
    if (!kopf || !BASE64.test(b.slice(kopf[0].length))) {
      return { fehler: "Nur Bilder (JPEG, PNG oder WebP) sind erlaubt." };
    }
    if (b.length > MAX_EINZEL_ZEICHEN) {
      return { fehler: "Ein Bild ist zu groß. Bitte ein kleineres Bild oder einen Ausschnitt verwenden." };
    }
    gesamt += b.length;
    bilder.push(b);
  }
  if (gesamt > MAX_GESAMT_ZEICHEN) {
    return { fehler: "Die Bilder sind zusammen zu groß. Bitte weniger oder kleinere Bilder senden." };
  }
  return { bilder };
}
