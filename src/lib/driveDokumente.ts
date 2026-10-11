// Liest die Dokumente aus dem verlinkten Google-Drive-Ordner des Projekts
// (Project.dokumenteLink), damit sie beim Erstellen des Businessplans
// automatisch einfliessen. Nutzt die Google-Drive-API v3 mit einem API-
// Schluessel (Umgebungsvariable GOOGLE_DRIVE_API_KEY) - das funktioniert fuer
// Ordner, die auf "Jeder mit dem Link kann ansehen" stehen. Nie fatal: ohne
// Schluessel/Zugriff entsteht der Businessplan trotzdem, die Person bekommt
// aber einen Hinweis (siehe `hinweis`).
//
// Lesbar sind: Google Docs, Google Tabellen (erstes Blatt als CSV), Google
// Praesentationen, Word (.docx), Text/Markdown/CSV/JSON. Andere Dateien (z. B.
// PDF, Excel, Bilder) werden nur mit Namen aufgefuehrt.

import { inflateRawSync } from "zlib";

export interface DriveDokument {
  name: string;
  pfad: string; // Unterordner/Datei
  typ: string; // lesbare Typbezeichnung
  geaendertAm?: string;
  inhalt?: string; // gekuerzter Text, fehlt wenn nicht auslesbar
}

export interface DriveErgebnis {
  dokumente: DriveDokument[];
  /** Menschenlesbarer Hinweis fuer die Person, falls etwas nicht geklappt hat. */
  hinweis?: string;
  ordnerGefunden: boolean;
}

const API = "https://www.googleapis.com/drive/v3";
const MAX_DATEIEN = 40;
const MAX_ZEICHEN_PRO_DATEI = 6000;
const MAX_ZEICHEN_GESAMT = 30000;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TIEFE = 2; // Ordner + 1 Ebene Unterordner
const ZEITLIMIT_MS = 12000;

const MIME_DOC = "application/vnd.google-apps.document";
const MIME_SHEET = "application/vnd.google-apps.spreadsheet";
const MIME_SLIDES = "application/vnd.google-apps.presentation";
const MIME_FOLDER = "application/vnd.google-apps.folder";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface DriveDatei {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
}

export function ordnerIdAusLink(link: string | undefined): string | null {
  if (!link) return null;
  const m1 = link.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m1) return m1[1];
  const m2 = link.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  return m2 ? m2[1] : null;
}

async function holeJson<T>(url: string): Promise<{ ok: boolean; status: number; body: T | null }> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ZEITLIMIT_MS) });
  const body = (await res.json().catch(() => null)) as T | null;
  return { ok: res.ok, status: res.status, body };
}

function kuerzen(text: string, max: number): string {
  const t = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t.length > max ? `${t.slice(0, max)}\n[… gekürzt]` : t;
}

/** Minimaler Zip-Leser: holt "word/document.xml" aus einer .docx und macht Text daraus. */
function docxZuText(buf: Buffer): string | null {
  try {
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return null;
    const anzahl = buf.readUInt16LE(eocd + 10);
    let pos = buf.readUInt32LE(eocd + 16);
    for (let n = 0; n < anzahl; n++) {
      if (buf.readUInt32LE(pos) !== 0x02014b50) return null;
      const methode = buf.readUInt16LE(pos + 10);
      const compSize = buf.readUInt32LE(pos + 20);
      const nameLen = buf.readUInt16LE(pos + 28);
      const extraLen = buf.readUInt16LE(pos + 30);
      const kommLen = buf.readUInt16LE(pos + 32);
      const lokal = buf.readUInt32LE(pos + 42);
      const name = buf.toString("utf8", pos + 46, pos + 46 + nameLen);
      if (name === "word/document.xml") {
        const lNameLen = buf.readUInt16LE(lokal + 26);
        const lExtraLen = buf.readUInt16LE(lokal + 28);
        const start = lokal + 30 + lNameLen + lExtraLen;
        const roh = buf.subarray(start, start + compSize);
        const xml = (methode === 8 ? inflateRawSync(roh) : roh).toString("utf8");
        return xml
          .replace(/<\/w:p>/g, "\n")
          .replace(/<w:tab\/>/g, "\t")
          .replace(/<w:br\/>/g, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
      }
      pos += 46 + nameLen + extraLen + kommLen;
    }
    return null;
  } catch {
    return null;
  }
}

async function liesInhalt(datei: DriveDatei, key: string): Promise<{ typ: string; inhalt?: string }> {
  const k = encodeURIComponent(key);
  const id = encodeURIComponent(datei.id);
  const text = async (url: string) => {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ZEITLIMIT_MS) });
    if (!res.ok) return undefined;
    return await res.text();
  };

  try {
    if (datei.mimeType === MIME_DOC)
      return { typ: "Google Dokument", inhalt: await text(`${API}/files/${id}/export?mimeType=text/plain&key=${k}`) };
    if (datei.mimeType === MIME_SHEET)
      return { typ: "Google Tabelle (erstes Blatt)", inhalt: await text(`${API}/files/${id}/export?mimeType=text/csv&key=${k}`) };
    if (datei.mimeType === MIME_SLIDES)
      return { typ: "Google Präsentation", inhalt: await text(`${API}/files/${id}/export?mimeType=text/plain&key=${k}`) };

    const groesse = Number(datei.size ?? 0);
    if (groesse > MAX_BYTES) return { typ: "zu groß zum Auslesen" };

    if (
      datei.mimeType.startsWith("text/") ||
      datei.mimeType === "application/json" ||
      /\.(md|txt|csv|json)$/i.test(datei.name)
    ) {
      return { typ: "Textdatei", inhalt: await text(`${API}/files/${id}?alt=media&key=${k}`) };
    }

    if (datei.mimeType === MIME_DOCX || /\.docx$/i.test(datei.name)) {
      const res = await fetch(`${API}/files/${id}?alt=media&key=${k}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(ZEITLIMIT_MS),
      });
      if (!res.ok) return { typ: "Word-Dokument" };
      const t = docxZuText(Buffer.from(await res.arrayBuffer()));
      return { typ: "Word-Dokument", inhalt: t ?? undefined };
    }
  } catch {
    // einzelne Datei nicht lesbar -> nur Name auffuehren
  }

  if (/\.pdf$/i.test(datei.name) || datei.mimeType === "application/pdf") return { typ: "PDF (Inhalt nicht auslesbar)" };
  if (/\.xlsx?$/i.test(datei.name)) return { typ: "Excel (Inhalt nicht auslesbar)" };
  if (/\.pptx?$/i.test(datei.name)) return { typ: "PowerPoint (Inhalt nicht auslesbar)" };
  if (datei.mimeType.startsWith("image/")) return { typ: "Bild" };
  return { typ: "Datei (Inhalt nicht auslesbar)" };
}

async function listeOrdner(
  ordnerId: string,
  key: string,
  pfad: string,
  tiefe: number,
  sammler: { datei: DriveDatei; pfad: string }[]
): Promise<{ fehlerStatus?: number }> {
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${ordnerId}' in parents and trashed = false`);
    const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,modifiedTime,size)");
    const url =
      `${API}/files?q=${q}&fields=${fields}&pageSize=100&orderBy=modifiedTime desc` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(key)}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const r = await holeJson<{ files?: DriveDatei[]; nextPageToken?: string }>(url);
    if (!r.ok || !r.body) return { fehlerStatus: r.status };
    for (const f of r.body.files ?? []) {
      if (f.mimeType === MIME_FOLDER) {
        if (tiefe < MAX_TIEFE) await listeOrdner(f.id, key, `${pfad}${f.name}/`, tiefe + 1, sammler);
      } else {
        sammler.push({ datei: f, pfad: `${pfad}${f.name}` });
      }
      if (sammler.length >= MAX_DATEIEN) return {};
    }
    pageToken = r.body.nextPageToken ?? "";
  } while (pageToken && sammler.length < MAX_DATEIEN);
  return {};
}

export async function ladeDriveDokumente(dokumenteLink: string | undefined): Promise<DriveErgebnis> {
  const ordnerId = ordnerIdAusLink(dokumenteLink);
  if (!ordnerId) {
    return {
      dokumente: [],
      ordnerGefunden: false,
      hinweis: dokumenteLink
        ? "Der Dokumenten-Link ist kein Google-Drive-Ordner-Link – die Dokumente konnten nicht berücksichtigt werden."
        : undefined,
    };
  }
  const key = process.env.GOOGLE_DRIVE_API_KEY;
  if (!key) {
    return {
      dokumente: [],
      ordnerGefunden: true,
      hinweis:
        "Die Dokumente im Google-Drive-Ordner konnten noch nicht berücksichtigt werden: Es ist kein Google-Zugangsschlüssel (GOOGLE_DRIVE_API_KEY) hinterlegt.",
    };
  }

  try {
    const sammler: { datei: DriveDatei; pfad: string }[] = [];
    const { fehlerStatus } = await listeOrdner(ordnerId, key, "", 0, sammler);
    if (fehlerStatus) {
      return {
        dokumente: [],
        ordnerGefunden: true,
        hinweis:
          fehlerStatus === 403 || fehlerStatus === 404
            ? "Der Google-Drive-Ordner ist nicht lesbar. Bitte den Ordner auf „Jeder mit dem Link kann ansehen“ stellen (oder den Schlüssel prüfen)."
            : `Der Google-Drive-Ordner konnte nicht gelesen werden (Status ${fehlerStatus}).`,
      };
    }

    // Dateien parallel (in kleinen Gruppen) auslesen
    const ergebnis: DriveDokument[] = [];
    let gesamt = 0;
    for (let i = 0; i < sammler.length; i += 5) {
      const gruppe = sammler.slice(i, i + 5);
      const gelesen = await Promise.all(gruppe.map((g) => liesInhalt(g.datei, key)));
      gruppe.forEach((g, idx) => {
        const l = gelesen[idx];
        let inhalt = l.inhalt ? kuerzen(l.inhalt, MAX_ZEICHEN_PRO_DATEI) : undefined;
        if (inhalt && gesamt + inhalt.length > MAX_ZEICHEN_GESAMT) {
          inhalt = gesamt >= MAX_ZEICHEN_GESAMT ? undefined : kuerzen(inhalt, MAX_ZEICHEN_GESAMT - gesamt);
        }
        if (inhalt) gesamt += inhalt.length;
        ergebnis.push({
          name: g.datei.name,
          pfad: g.pfad,
          typ: l.typ,
          geaendertAm: g.datei.modifiedTime,
          inhalt,
        });
      });
    }
    const nichtLesbar = ergebnis.filter((d) => !d.inhalt).length;
    return {
      dokumente: ergebnis,
      ordnerGefunden: true,
      hinweis:
        nichtLesbar > 0
          ? `${nichtLesbar} Datei(en) im Drive-Ordner (z. B. PDF oder Excel) sind nur mit Namen berücksichtigt, ihr Inhalt lässt sich nicht automatisch lesen.`
          : undefined,
    };
  } catch {
    return {
      dokumente: [],
      ordnerGefunden: true,
      hinweis: "Der Google-Drive-Ordner war gerade nicht erreichbar – der Businessplan entstand ohne die Dokumente.",
    };
  }
}
