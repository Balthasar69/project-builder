// Browser-Helfer für Bilder/Screenshots in Aufgaben-Notizen und Team-Chat:
// Bild einlesen, auf max. 1400 Pixel Kantenlänge verkleinern und als JPEG
// (data:-URL) zurückgeben, damit die Anfrage klein bleibt.

export const MAX_BILDER = 4;
const MAX_KANTE = 1400;
const MAX_ZEICHEN = 1_100_000;

export async function bildAlsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Nur Bilddateien können angehängt werden.");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () =>
        reject(new Error("Dieses Bild konnte nicht gelesen werden (z. B. HEIC). Bitte als JPEG oder PNG senden."));
      i.src = url;
    });
    const faktor = Math.min(1, MAX_KANTE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * faktor));
    const h = Math.max(1, Math.round(img.naturalHeight * faktor));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    let qualitaet = 0.82;
    let out = canvas.toDataURL("image/jpeg", qualitaet);
    while (out.length > MAX_ZEICHEN && qualitaet > 0.4) {
      qualitaet -= 0.1;
      out = canvas.toDataURL("image/jpeg", qualitaet);
    }
    if (out.length > MAX_ZEICHEN) throw new Error("Das Bild ist zu groß.");
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Fügt neue Bilddateien zu den bereits gewählten hinzu (max. MAX_BILDER). */
export async function bilderHinzufuegen(dateien: File[], aktuell: string[]): Promise<string[]> {
  const platz = MAX_BILDER - aktuell.length;
  if (platz <= 0) throw new Error(`Höchstens ${MAX_BILDER} Bilder pro Nachricht.`);
  const neue: string[] = [];
  for (const f of dateien.slice(0, platz)) neue.push(await bildAlsDataUrl(f));
  if (dateien.length > platz) {
    throw new Error(`Höchstens ${MAX_BILDER} Bilder pro Nachricht – die übrigen wurden nicht angehängt.`);
  }
  return [...aktuell, ...neue];
}

/** Bilddateien aus einem Einfügen-Ereignis (Cmd+V / Strg+V eines Screenshots). */
export function bilderAusPaste(e: { clipboardData: DataTransfer | null }): File[] {
  const items = Array.from(e.clipboardData?.items ?? []);
  return items
    .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
    .map((it) => it.getAsFile())
    .filter((f): f is File => !!f);
}
