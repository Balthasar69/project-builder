import { neon } from "@neondatabase/serverless";
import {
  AufgabenAnalyse,
  AufgabenVorschlag,
  BlockHinweisKey,
  ChatNachricht,
  CheckResult,
  Idee,
  KernteamMitglied,
  KompetenzBeitrag,
  PhaseCode,
  Project,
  ProjektArt,
  SteuerboardInfo,
  TaskNote,
  User,
} from "./types";
import { randomUUID } from "crypto";
import { addWorkgroupMembers, createWorkgroup, setTaskGroup } from "./bitrix24";

// Datenhaltung über Postgres (Neon, via Vercel Marketplace-Integration).
// Jede Zeile ist ein Projekt als JSON-Dokument – bewusst einfach (kein
// aufwendiges relationales Schema), passend zum Grundsatz "kleinstes real
// testbares Produkt" (Kapitel 13/28).
// Tabelle anlegen/Be Happy Again einspielen: `npm run db:init` (siehe README).
//
// Zugänge (Registrierung & Rollen, Kapitel 28) liegen in einer eigenen
// `users`-Tabelle. Ein Projekt ist für eine Person sichtbar, wenn ihre
// E-Mail in `mitglieder` steht oder sie Admin ist (siehe src/lib/auth.ts).

interface ProjectRow {
  data: Project;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  is_admin: boolean;
  created_at: string;
  einfuehrung_gesehen_am: string | null;
}

// Lazy, idempotente Migration statt eines lokalen Skripts (v0.62): das
// bestehende `npm run db:init` kann Balthasar nicht selbst ausführen (setzt
// `vercel env pull` voraus), deshalb legt der Server die neue Spalte beim
// ersten echten Datenbankzugriff automatisch an. Bestehende Konten
// bekommen dabei sofort ein Datum eingetragen ("schon gesehen"), damit nur
// künftig NEU registrierte Personen den Willkommens-Bildschirm angezeigt
// bekommen – deshalb der DEFAULT NOW() beim Anlegen, gefolgt von DROP
// DEFAULT, damit spätere Registrierungen wieder bewusst NULL eintragen
// (siehe `createUser`). `usersTableMigriert` verhindert, dass das bei jedem
// Aufruf erneut geprüft wird (die ALTER-Befehle sind zwar idempotent, aber
// unnötiger Overhead pro Anfrage).
let usersTableMigriert = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureUsersTableMigriert(sql: any) {
  if (usersTableMigriert) return;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS einfuehrung_gesehen_am TIMESTAMPTZ DEFAULT NOW()`;
  await sql`ALTER TABLE users ALTER COLUMN einfuehrung_gesehen_am DROP DEFAULT`;
  usersTableMigriert = true;
}

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    // Wird erst beim tatsächlichen Datenbankzugriff geworfen, nicht beim
    // Import – so scheitert `next build` nicht, wenn (noch) keine
    // Datenbank verbunden ist.
    throw new Error(
      'Keine Datenbank-Verbindung gefunden (DATABASE_URL/POSTGRES_URL). ' +
        'Siehe README, Abschnitt "Online stellen (Vercel)".'
    );
  }
  return neon(url);
}

// Balthasar (Geschäftsführung) soll grundsätzlich in jedem Projekt Zugriff
// und Bewertungsrecht haben — unabhängig davon, wer das Projekt angelegt
// hat oder mit welchem seiner beiden Konten er gerade eingeloggt ist. Er
// nutzt zwei E-Mail-Adressen parallel (historisch gewachsen); beide zählen
// hier als "er selbst", damit die Automatik ihn nicht doppelt einträgt,
// wenn eine der beiden in einem Projekt schon vorhanden ist. Fehlen beide,
// wird die erste (`STANDARD_KERNTEAM_EMAIL`) ergänzt. Siehe auch
// `effektiverAdminStatus` in auth.ts für die passenden Admin-Rechte beim
// Login. Kein Datenbank-Update nötig: Wird ein Projekt danach ohnehin
// gespeichert (z. B. weil jemand etwas anderes ändert), landet die Ergänzung
// dabei automatisch dauerhaft in der Datenbank.
const BALTHASAR_EMAILS = [
  "management@balthasar-fleischmann.de",
  "balthasar@balthasar-fleischmann.de",
];
const STANDARD_KERNTEAM_EMAIL = BALTHASAR_EMAILS[0];
const STANDARD_KERNTEAM_MITGLIED: KernteamMitglied = {
  name: "Balthasar Fleischmann",
  rolle: "Geschäftsführung",
  email: STANDARD_KERNTEAM_EMAIL,
};

// Ältere Projekt-Zeilen (vor v0.3) kennen `mitglieder` noch nicht – beim
// Lesen ergänzen wir ein leeres Array, statt die Datenbank zu migrieren und
// dabei bestehende Daten anzufassen.
function normalizeProject(data: Project): Project {
  // Kernteam: genau einen Balthasar-Eintrag sicherstellen. Bereits doppelt
  // eingetragene Projekte (z. B. weil vor dieser Korrektur sowohl
  // "balthasar@…" als auch "management@…" gleichzeitig ergänzt wurden)
  // werden dabei automatisch bereinigt — der erste vorhandene Eintrag
  // bleibt erhalten, weitere werden entfernt; fehlt er ganz, wird der
  // Standard-Eintrag ergänzt.
  const kernteamRoh = data.kernteam ?? [];
  const istBalthasar = (m: KernteamMitglied) =>
    !!m.email && BALTHASAR_EMAILS.includes(m.email.toLowerCase());
  let ersterBalthasarGefunden = false;
  const kernteamBereinigt: KernteamMitglied[] = [];
  for (const m of kernteamRoh) {
    if (istBalthasar(m)) {
      if (ersterBalthasarGefunden) continue; // Duplikat überspringen
      ersterBalthasarGefunden = true;
    }
    kernteamBereinigt.push(m);
  }
  const kernteam = ersterBalthasarGefunden
    ? kernteamBereinigt
    : [...kernteamBereinigt, STANDARD_KERNTEAM_MITGLIED];

  // Team-Liste ("mitglieder"): Balthasar taucht dort bewusst NICHT
  // zusätzlich auf, sobald er (wie oben sichergestellt) im Kernteam steht —
  // Kernteam-Zugriff deckt den vollen Zugriff bereits ab (siehe
  // `hatProjektZugriff` in auth.ts), eine doppelte Nennung in "Team" wäre
  // nur verwirrend. Etwaige alte, redundante Einträge werden hier entfernt.
  const mitglieder = (data.mitglieder ?? []).filter(
    (e) => !BALTHASAR_EMAILS.includes(e.toLowerCase())
  );

  return {
    ...data,
    mitglieder,
    kernteam,
    beschreibung: data.beschreibung ?? "",
    hinweise: data.hinweise ?? {},
    ideen: data.ideen ?? [],
    aufgabenAnalysen: data.aufgabenAnalysen ?? {},
    aufgabenVorschlaege: data.aufgabenVorschlaege ?? [],
    kompetenzbeitraege: data.kompetenzbeitraege ?? [],
    chat: data.chat ?? [],
  };
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
    einfuehrungGesehenAm: row.einfuehrung_gesehen_am ?? null,
  };
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // Umlaute/Akzente entfernen
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "projekt"
  );
}

export async function getAllProjects(): Promise<Project[]> {
  const sql = getSql();
  const rows = (await sql`SELECT data FROM projects ORDER BY slug`) as ProjectRow[];
  return rows.map((r) => normalizeProject(r.data));
}

export async function getProject(slug: string): Promise<Project | null> {
  const sql = getSql();
  const rows =
    (await sql`SELECT data FROM projects WHERE slug = ${slug}`) as ProjectRow[];
  return rows[0] ? normalizeProject(rows[0].data) : null;
}

export async function saveCheckResult(
  slug: string,
  result: CheckResult
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.letzterCheck = result;
  project.checkVerlauf = [...(project.checkVerlauf ?? []), result];
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/** Legt ein neues Projekt an; die anlegende Person wird automatisch Mitglied und Kernteam. */
export async function createProject(params: {
  name: string;
  ownerEmail: string;
  ownerName: string;
  beschreibung?: string;
}): Promise<Project> {
  const sql = getSql();
  const baseSlug = slugify(params.name);

  let slug = baseSlug;
  let suffix = 2;
  // Eindeutigen Slug sicherstellen (kleine Tabelle, einfache Schleife reicht).
  while ((await getProject(slug)) !== null) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const kernteam: KernteamMitglied[] = [
    {
      name: params.ownerName,
      rolle: "Projektleitung",
      email: params.ownerEmail.trim().toLowerCase(),
    },
  ];

  const project: Project = {
    slug,
    name: params.name,
    rolleImSystem: "Neues Projekt",
    beschreibung: params.beschreibung?.trim() || "",
    aktuellePhase: "idee",
    kernteam,
    mitglieder: [params.ownerEmail.toLowerCase()],
    bereichStatus: {
      idee_markt: 0,
      konzept: 0,
      team: 0,
      voraussetzungen: 0,
      produkt: 0,
      business_case: 0,
      pilot: 0,
      marketing: 0,
      vertrieb: 0,
    },
    checkVerlauf: [],
    bitrix24: { dealId: 0, categoryId: 0, zuordnung: "noch nicht angelegt" },
    aktualisiertAm: new Date().toISOString(),
  };

  await sql`
    INSERT INTO projects (slug, data)
    VALUES (${slug}, ${JSON.stringify(project)}::jsonb)
  `;

  // Bitrix24-Arbeitsgruppe direkt beim Anlegen mitverbinden, statt erst auf
  // einen manuellen Klick zu warten – die Aufgabenliste ist dadurch von
  // Anfang an einsatzbereit. Best effort: ist Bitrix24 gerade nicht
  // erreichbar, bleibt das Projekt trotzdem nutzbar; `ensureBitrixGroupId`
  // holt die Verbindung beim nächsten Öffnen der Aufgaben automatisch nach.
  try {
    const { project: verbunden } = await ensureBitrixGroupId(project);
    return verbunden;
  } catch {
    return project;
  }
}

/** Fügt eine E-Mail-Adresse zu den Mitgliedern eines Projekts hinzu (idempotent). */
export async function addMitglied(slug: string, email: string): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  const normalized = email.trim().toLowerCase();
  if (!project.mitglieder.includes(normalized)) {
    project.mitglieder = [...project.mitglieder, normalized];
    project.aktualisiertAm = new Date().toISOString();

    const sql = getSql();
    await sql`
      UPDATE projects
      SET data = ${JSON.stringify(project)}::jsonb
      WHERE slug = ${slug}
    `;
  }
  return project;
}

/**
 * Fügt eine Person zum Kernteam hinzu (idempotent nach E-Mail) und stellt
 * sicher, dass sie auch als normales Mitglied eingetragen ist – ohne
 * `mitglieder`-Eintrag könnte sich die Person gar nicht anmelden und ihre
 * Kernteam-Rechte (Phasenwechsel, Bewertung) nie nutzen. Rechteprüfung
 * (nur Admins) sitzt in der API-Route.
 */
export async function addKernteamMitglied(
  slug: string,
  params: { name: string; rolle: string; email: string }
): Promise<Project> {
  const normalized = params.email.trim().toLowerCase();

  // Zugriff sicherstellen (idempotent) – nutzt bewusst dieselbe Funktion
  // wie das normale Hinzufügen unter "Team".
  const project = await addMitglied(slug, normalized);

  const bestehenderIndex = project.kernteam.findIndex(
    (m) => m.email?.toLowerCase() === normalized
  );
  const eintrag: KernteamMitglied = {
    name: params.name.trim(),
    rolle: params.rolle.trim() || "Kernteam",
    email: normalized,
  };
  if (bestehenderIndex >= 0) {
    project.kernteam = project.kernteam.map((m, i) =>
      i === bestehenderIndex ? eintrag : m
    );
  } else {
    project.kernteam = [...project.kernteam, eintrag];
  }
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Entfernt eine Person wieder aus dem Kernteam (nicht aus `mitglieder` –
 * der App-Zugriff auf das Projekt bleibt bestehen, nur die erweiterten
 * Kernteam-Rechte entfallen). Rechteprüfung sitzt in der API-Route.
 */
export async function removeKernteamMitglied(
  slug: string,
  email: string
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  const normalized = email.trim().toLowerCase();
  project.kernteam = project.kernteam.filter(
    (m) => m.email?.toLowerCase() !== normalized
  );
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Entfernt einen Kernteam-Eintrag OHNE hinterlegte E-Mail-Adresse anhand
 * seiner Position in der Liste – für ältere Einträge von vor der Zeit, als
 * eine E-Mail-Adresse im Kernteam noch nicht zwingend war (lassen sich
 * sonst nirgends eindeutig identifizieren, `removeKernteamMitglied` braucht
 * eine E-Mail-Adresse). Rechteprüfung – nur Admins – sitzt in der
 * API-Route. Zur Sicherheit werden Name und Rolle zusätzlich verglichen,
 * damit ein inzwischen anderer Datensatz an dieser Position nicht
 * versehentlich mitgelöscht wird.
 */
export async function removeKernteamMitgliedOhneEmail(
  slug: string,
  params: { index: number; name: string; rolle: string }
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  const eintrag = project.kernteam[params.index];
  if (
    !eintrag ||
    eintrag.email ||
    eintrag.name !== params.name ||
    (eintrag.rolle || "") !== (params.rolle || "")
  ) {
    throw new Error(
      "Der Eintrag wurde inzwischen geändert – bitte Seite neu laden und erneut versuchen."
    );
  }

  project.kernteam = project.kernteam.filter((_, i) => i !== params.index);
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Bearbeitet Name, Rolle und/oder E-Mail-Adresse eines bestehenden
 * Kernteam-Eintrags, ohne ihn zu entfernen und neu anzulegen (Rechteprüfung
 * – nur Admins – sitzt in der API-Route). Adressiert den Eintrag über seine
 * Position in der Liste (funktioniert dadurch auch bei Einträgen ohne
 * E-Mail-Adresse), mit einer Sicherheitsprüfung anhand der bisherigen
 * Werte, damit ein inzwischen anderer Datensatz an dieser Position nicht
 * versehentlich überschrieben wird. Wird dabei eine neue E-Mail-Adresse
 * hinterlegt, bekommt diese automatisch auch Team-Zugriff (wie beim
 * normalen Hinzufügen) – eine vorher hinterlegte Adresse behält ihren
 * Zugriff ebenfalls und wird NICHT automatisch entfernt.
 */
export async function bearbeiteKernteamEintrag(
  slug: string,
  params: {
    index: number;
    bisherigerName: string;
    bisherigeRolle: string;
    bisherigeEmail?: string;
    neuerName: string;
    neueRolle: string;
    neueEmail?: string;
  }
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  const eintrag = project.kernteam[params.index];
  if (
    !eintrag ||
    eintrag.name !== params.bisherigerName ||
    (eintrag.rolle || "") !== (params.bisherigeRolle || "") ||
    (eintrag.email || "") !== (params.bisherigeEmail || "")
  ) {
    throw new Error(
      "Der Eintrag wurde inzwischen geändert – bitte Seite neu laden und erneut versuchen."
    );
  }

  const neuerName = params.neuerName.trim();
  if (!neuerName) throw new Error("Name ist erforderlich.");
  const neueEmail = params.neueEmail?.trim().toLowerCase() || undefined;
  if (neueEmail && !neueEmail.includes("@")) {
    throw new Error("Bitte eine gültige E-Mail-Adresse angeben (oder das Feld leer lassen).");
  }

  project.kernteam = project.kernteam.map((m, i) =>
    i === params.index
      ? { ...m, name: neuerName, rolle: params.neueRolle.trim(), email: neueEmail }
      : m
  );
  if (neueEmail && !project.mitglieder.includes(neueEmail)) {
    project.mitglieder = [...project.mitglieder, neueEmail];
  }
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Entfernt eine E-Mail-Adresse wieder aus den Mitgliedern eines Projekts
 * (Rechteprüfung sitzt in der API-Route, gedacht nur für Admins). Entfernt
 * die Person dabei auch automatisch aus `kernteam`, falls sie dort steht –
 * sonst bliebe sie mit Kernteam-Rechten (Phasenwechsel, Bewertung)
 * eingetragen, obwohl „Team entfernen" eigentlich jeglichen Zugriff
 * beenden soll. (Frühere Version entfernte bewusst nicht aus dem
 * Kernteam – das führte genau zu diesem inkonsistenten Zustand.)
 */
export async function removeMitglied(slug: string, email: string): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  const normalized = email.trim().toLowerCase();
  project.mitglieder = project.mitglieder.filter((m) => m !== normalized);
  project.kernteam = project.kernteam.filter(
    (m) => m.email?.toLowerCase() !== normalized
  );
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Ändert die hinterlegte E-Mail-Adresse eines Team-Mitglieds (z. B. bei
 * einem Tippfehler oder einer neuen dienstlichen Adresse), ohne die Person
 * zu entfernen und neu einzuladen – Rechteprüfung (nur Admins) sitzt in der
 * API-Route. Steht dieselbe Adresse auch im Kernteam, wird sie dort
 * ebenfalls aktualisiert, damit beide Listen konsistent bleiben.
 */
export async function bearbeiteMitgliedEmail(
  slug: string,
  params: { bisherigeEmail: string; neueEmail: string }
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  const alt = params.bisherigeEmail.trim().toLowerCase();
  const neu = params.neueEmail.trim().toLowerCase();
  if (!neu || !neu.includes("@")) {
    throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");
  }
  if (!project.mitglieder.includes(alt)) {
    throw new Error(
      "Diese Person steht nicht (mehr) im Team – bitte Seite neu laden und erneut versuchen."
    );
  }
  if (neu !== alt && project.mitglieder.includes(neu)) {
    throw new Error("Diese E-Mail-Adresse ist bereits im Team eingetragen.");
  }

  project.mitglieder = project.mitglieder.map((m) => (m === alt ? neu : m));
  project.kernteam = project.kernteam.map((k) =>
    k.email?.toLowerCase() === alt ? { ...k, email: neu } : k
  );
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/** Setzt/ändert die Projektbeschreibung (Rechteprüfung sitzt in der API-Route: Kernteam/Admins). */
export async function setBeschreibung(slug: string, beschreibung: string): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.beschreibung = beschreibung.trim();
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Setzt/ändert die individuelle Kurzanweisung eines einzelnen Cockpit-Blocks
 * (Rechteprüfung sitzt in der API-Route: Kernteam/Admins). Ein leerer Text
 * löscht die individuelle Anweisung wieder – dann greift automatisch
 * `STANDARD_HINWEISE` aus src/lib/types.ts.
 */
export async function setBlockHinweis(
  slug: string,
  key: BlockHinweisKey,
  text: string
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  const hinweise = { ...(project.hinweise ?? {}) };
  const getrimmt = text.trim();
  if (getrimmt) {
    hinweise[key] = getrimmt;
  } else {
    delete hinweise[key];
  }
  project.hinweise = hinweise;
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/** Hinterlegt die ID der verbundenen Bitrix24-Arbeitsgruppe für ein Projekt. */
export async function setBitrixGroupId(slug: string, groupId: number): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.bitrix24 = { ...project.bitrix24, groupId };
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Stellt sicher, dass ein Projekt eine Bitrix24-Arbeitsgruppe hat, und legt
 * sie bei Bedarf automatisch an (dieselbe Logik wie der Button "Mit
 * Bitrix24 verbinden") – genutzt beim Übernehmen von KI-Aufgaben-
 * Vorschlägen und Ideen, DAMIT eine dabei neu angelegte Bitrix24-Aufgabe
 * auch garantiert einer Gruppe zugeordnet ist. Ohne das würde die Aufgabe
 * zwar in Bitrix24 entstehen, aber nirgends im Aufgaben-Bereich der App
 * auftauchen (der immer nach Arbeitsgruppe filtert) – genau der Fehler, der
 * bei Projekten auftrat, die vor dem ersten "Übernehmen" noch nie manuell
 * verbunden worden waren.
 */
export async function ensureBitrixGroupId(
  project: Project
): Promise<{ project: Project; groupId: number; neuVerbunden: boolean }> {
  if (project.bitrix24.groupId) {
    return { project, groupId: project.bitrix24.groupId, neuVerbunden: false };
  }

  const groupId = await createWorkgroup({
    name: project.name,
    description: `Automatisch angelegt vom Project Builder für „${project.name}".`,
  });

  const mitgliederIds = project.kernteam
    .map((m) => m.bitrix24UserId)
    .filter((id): id is number => typeof id === "number");
  try {
    await addWorkgroupMembers(groupId, mitgliederIds);
  } catch {
    // bewusst ignoriert, siehe Kommentar in bitrix24/connect/route.ts
  }

  const updated = await setBitrixGroupId(project.slug, groupId);
  return { project: updated, groupId, neuVerbunden: true };
}

/**
 * Ordnet übernommene KI-Aufgaben-Vorschläge und Ideen, deren Bitrix24-
 * Aufgabe noch keiner Arbeitsgruppe zugeordnet ist (`bitrixGruppeZugeordnet`
 * fehlt bzw. ist `false` – z. B. weil sie vor dieser Korrektur oder vor dem
 * Verbinden des Projekts entstanden ist), nachträglich der aktuellen
 * Arbeitsgruppe zu. Läuft best effort: eine einzelne fehlgeschlagene
 * Zuordnung (z. B. weil die Aufgabe in Bitrix24 inzwischen gelöscht wurde)
 * hält die übrigen nicht auf. Wird ohne Bitrix24-Verbindung oder ohne
 * offene Fälle sofort ohne Datenbank-Zugriff beendet.
 */
export async function repariereVerwaisteBitrixAufgaben(
  project: Project
): Promise<{ project: Project; repariert: number }> {
  const groupId = project.bitrix24.groupId;
  if (!groupId) return { project, repariert: 0 };

  const offeneVorschlaege = (project.aufgabenVorschlaege ?? []).filter(
    (v) => v.uebernommenAlsTaskId && !v.bitrixGruppeZugeordnet
  );
  const offeneIdeen = (project.ideen ?? []).filter(
    (i) => i.uebernommenAlsTaskId && !i.bitrixGruppeZugeordnet
  );
  if (offeneVorschlaege.length === 0 && offeneIdeen.length === 0) {
    return { project, repariert: 0 };
  }

  const erfolgreich = new Set<string>();
  for (const eintrag of [...offeneVorschlaege, ...offeneIdeen]) {
    try {
      await setTaskGroup(eintrag.uebernommenAlsTaskId as string, groupId);
      erfolgreich.add(eintrag.uebernommenAlsTaskId as string);
    } catch {
      // bewusst ignoriert, siehe Kommentar oben
    }
  }
  if (erfolgreich.size === 0) return { project, repariert: 0 };

  const aktuell = await getProject(project.slug);
  if (!aktuell) return { project, repariert: 0 };

  aktuell.aufgabenVorschlaege = (aktuell.aufgabenVorschlaege ?? []).map((v) =>
    v.uebernommenAlsTaskId && erfolgreich.has(v.uebernommenAlsTaskId)
      ? { ...v, bitrixGruppeZugeordnet: true }
      : v
  );
  aktuell.ideen = (aktuell.ideen ?? []).map((i) =>
    i.uebernommenAlsTaskId && erfolgreich.has(i.uebernommenAlsTaskId)
      ? { ...i, bitrixGruppeZugeordnet: true }
      : i
  );
  aktuell.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(aktuell)}::jsonb
    WHERE slug = ${project.slug}
  `;
  return { project: aktuell, repariert: erfolgreich.size };
}

/** Setzt die Phase eines Projekts (nur für Kernteam/Admins gedacht – Rechteprüfung sitzt in der API-Route). */
export async function setPhase(slug: string, phase: PhaseCode): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.aktuellePhase = phase;
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Hinterlegt die von der Steuerboard-Factory zurückgegebenen Informationen
 * am Projekt (Rechteprüfung – Kernteam/Admins – sitzt in der API-Route).
 * Überschreibt ein etwaiges früheres Ergebnis nicht automatisch – die
 * API-Route lehnt einen erneuten Aufruf ab, solange schon eine Kopie
 * hinterlegt ist (siehe dort), diese Funktion selbst prüft das nicht noch
 * einmal.
 */
export async function setSteuerboard(
  slug: string,
  info: SteuerboardInfo
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.steuerboard = info;
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const sql = getSql();
  await ensureUsersTableMigriert(sql);
  const rows =
    (await sql`SELECT * FROM users WHERE email = ${email.trim().toLowerCase()}`) as UserRow[];
  return rows[0] ? toUser(rows[0]) : null;
}

/** Erste registrierte Person wird automatisch Admin (sieht/verwaltet alle Projekte). */
export async function createUser(params: {
  email: string;
  passwordHash: string;
  name: string;
}): Promise<User> {
  const sql = getSql();
  await ensureUsersTableMigriert(sql);
  const [{ count }] = (await sql`SELECT COUNT(*)::int AS count FROM users`) as {
    count: number;
  }[];
  const isAdmin = count === 0;

  const rows = (await sql`
    INSERT INTO users (email, password_hash, name, is_admin)
    VALUES (${params.email.trim().toLowerCase()}, ${params.passwordHash}, ${params.name}, ${isAdmin})
    RETURNING *
  `) as UserRow[];
  return toUser(rows[0]);
}

/**
 * Markiert den Willkommens-Bildschirm (v0.62) als gesehen – aufgerufen,
 * sobald die Person dort auf "Los geht's" klickt. Danach führt die
 * Startseite nicht mehr dorthin.
 */
export async function markiereEinfuehrungGesehen(email: string): Promise<void> {
  const sql = getSql();
  await ensureUsersTableMigriert(sql);
  await sql`
    UPDATE users
    SET einfuehrung_gesehen_am = NOW()
    WHERE email = ${email.trim().toLowerCase()}
  `;
}

interface TaskNoteRow {
  id: string;
  task_id: string;
  author_name: string;
  author_email: string;
  text: string | null;
  audio_data_url: string | null;
  transcript: string | null;
  created_at: string;
}

function toTaskNote(row: TaskNoteRow): TaskNote {
  return {
    id: row.id,
    taskId: row.task_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    text: row.text ?? undefined,
    audioDataUrl: row.audio_data_url ?? undefined,
    transcript: row.transcript ?? undefined,
    erstelltAm: row.created_at,
  };
}

/** Alle Text-/Sprachnotizen zu einer einzelnen Bitrix24-Aufgabe, älteste zuerst. */
export async function listTaskNotes(
  slug: string,
  taskId: string
): Promise<TaskNote[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM task_notes
    WHERE slug = ${slug} AND task_id = ${taskId}
    ORDER BY created_at ASC
  `) as TaskNoteRow[];
  return rows.map(toTaskNote);
}

/** Legt eine neue Text- und/oder Sprachnotiz zu einer Aufgabe an. */
export async function addTaskNote(params: {
  slug: string;
  taskId: string;
  authorName: string;
  authorEmail: string;
  text?: string;
  audioDataUrl?: string;
  transcript?: string;
}): Promise<TaskNote> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO task_notes (slug, task_id, author_name, author_email, text, audio_data_url, transcript)
    VALUES (
      ${params.slug},
      ${params.taskId},
      ${params.authorName},
      ${params.authorEmail},
      ${params.text ?? null},
      ${params.audioDataUrl ?? null},
      ${params.transcript ?? null}
    )
    RETURNING *
  `) as TaskNoteRow[];
  return toTaskNote(rows[0]);
}

/**
 * Legt eine neue Idee an (Rechteprüfung – nur Kernteam – sitzt in der
 * API-Route). Bewusst kein eigenes Formular mit vielen Feldern, nur ein
 * kurzer Text.
 */
export async function addIdee(
  slug: string,
  params: { text: string; erstelltVonName: string; erstelltVonEmail: string }
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  const neueIdee: Idee = {
    id: randomUUID(),
    text: params.text.trim(),
    erstelltVonName: params.erstelltVonName,
    erstelltVonEmail: params.erstelltVonEmail,
    erstelltAm: new Date().toISOString(),
  };
  project.ideen = [...(project.ideen ?? []), neueIdee];
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/** Entfernt eine noch nicht übernommene Idee wieder (Rechteprüfung: Kernteam). */
export async function removeIdee(slug: string, ideeId: string): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.ideen = (project.ideen ?? []).filter((i) => i.id !== ideeId);
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Markiert eine Idee als übernommen, nachdem daraus in Bitrix24 eine echte
 * Aufgabe angelegt wurde (siehe API-Route, die zuerst `createTask` aus
 * `bitrix24.ts` aufruft und dann hier die Verknüpfung speichert).
 */
export async function markiereIdeeUebernommen(
  slug: string,
  ideeId: string,
  bitrixTaskId: string
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.ideen = (project.ideen ?? []).map((i) =>
    i.id === ideeId
      ? { ...i, uebernommenAlsTaskId: bitrixTaskId, bitrixGruppeZugeordnet: true }
      : i
  );
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Speichert die von Claude erstellte Hilfestellung zu einer einzelnen
 * Bitrix24-Aufgabe (überschreibt eine vorhandene Einschätzung derselben
 * Aufgabe, statt eine Historie zu führen — es geht um den aktuellen
 * Denkanstoß, nicht um ein Protokoll).
 */
export async function setAufgabenAnalyse(
  slug: string,
  taskId: string,
  analyse: AufgabenAnalyse
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.aufgabenAnalysen = {
    ...(project.aufgabenAnalysen ?? {}),
    [taskId]: analyse,
  };
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Startet einen neuen Projektstart-Fragebogen ("Aufgaben von der KI
 * vorschlagen lassen") – nur Admins (Rechteprüfung sitzt in der API-Route).
 * Ersetzt einen etwaigen vorherigen Fragebogen samt offener Vorschläge
 * vollständig, statt ihn zu ergänzen – pro Projekt läuft immer nur eine
 * Runde gleichzeitig.
 */
export async function starteProjektstartFragebogen(
  slug: string,
  params: { projektleiterEmail: string; projektleiterName: string }
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.projektstartFragebogen = {
    projektleiterEmail: params.projektleiterEmail.trim().toLowerCase(),
    projektleiterName: params.projektleiterName,
    gestartetAm: new Date().toISOString(),
  };
  project.aufgabenVorschlaege = [];
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/** Bricht einen laufenden, noch nicht beantworteten Projektstart-Fragebogen ab (nur Admins). */
export async function brichProjektstartFragebogenAb(slug: string): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.projektstartFragebogen = undefined;
  project.aufgabenVorschlaege = [];
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Speichert die Antworten des Projektleiters auf den Projektstart-
 * Fragebogen (Rechteprüfung – nur der zugewiesene Projektleiter oder ein
 * Admin – sitzt in der API-Route). Die anschließende KI-Generierung der
 * Aufgaben-Vorschläge erfolgt separat (siehe `setAufgabenVorschlaege` bzw.
 * `setProjektstartFehler`), damit ein Fehlschlagen der KI die gespeicherten
 * Antworten nicht gefährdet.
 */
export async function beantworteProjektstartFragebogen(
  slug: string,
  antworten: {
    projektArt: ProjektArt;
    zielsituation: string;
    umsatzziel?: string;
    liquiditaet?: string;
    meilensteine: string;
  }
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);
  if (!project.projektstartFragebogen) {
    throw new Error("Kein offener Projektstart-Fragebogen für dieses Projekt.");
  }

  project.projektstartFragebogen = {
    ...project.projektstartFragebogen,
    ...antworten,
    beantwortetAm: new Date().toISOString(),
    fehler: undefined,
  };
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/** Speichert die von der KI generierten Aufgaben-Vorschläge nach dem Beantworten des Fragebogens. */
export async function setAufgabenVorschlaege(
  slug: string,
  titel: string[]
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.aufgabenVorschlaege = titel.map(
    (t): AufgabenVorschlag => ({ id: randomUUID(), titel: t })
  );
  if (project.projektstartFragebogen) {
    project.projektstartFragebogen = {
      ...project.projektstartFragebogen,
      fehler: undefined,
    };
  }
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/** Hält fest, dass die KI-Generierung der Aufgaben-Vorschläge fehlgeschlagen ist (Antworten bleiben erhalten). */
export async function setProjektstartFehler(
  slug: string,
  fehler: string
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);
  if (project.projektstartFragebogen) {
    project.projektstartFragebogen = {
      ...project.projektstartFragebogen,
      fehler,
    };
  }
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/** Entfernt einen noch nicht übernommenen Aufgaben-Vorschlag wieder (Rechteprüfung: Kernteam). */
export async function entferneAufgabenVorschlag(
  slug: string,
  vorschlagId: string
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.aufgabenVorschlaege = (project.aufgabenVorschlaege ?? []).filter(
    (v) => v.id !== vorschlagId
  );
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Markiert einen Aufgaben-Vorschlag als übernommen, nachdem daraus in
 * Bitrix24 eine echte Aufgabe angelegt wurde (siehe API-Route, die zuerst
 * `createTask` aus `bitrix24.ts` aufruft und dann hier die Verknüpfung
 * speichert) – analog zu `markiereIdeeUebernommen`.
 */
export async function markiereVorschlagUebernommen(
  slug: string,
  vorschlagId: string,
  bitrixTaskId: string
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  project.aufgabenVorschlaege = (project.aufgabenVorschlaege ?? []).map((v) =>
    v.id === vorschlagId
      ? { ...v, uebernommenAlsTaskId: bitrixTaskId, bitrixGruppeZugeordnet: true }
      : v
  );
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Legt den eigenen Kompetenzen-Eintrag an oder überschreibt ihn (Rechteprüfung
 * – nur der/die Angemeldete selbst – sitzt in der API-Route: jede Person
 * pflegt ausschließlich ihren eigenen Eintrag, nie den einer anderen).
 */
export async function setKompetenzBeitrag(
  slug: string,
  params: { email: string; name: string; kannBeitragen: string; moechteBeitragen: string }
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  const normalized = params.email.trim().toLowerCase();
  const eintrag: KompetenzBeitrag = {
    email: normalized,
    name: params.name,
    kannBeitragen: params.kannBeitragen.trim(),
    moechteBeitragen: params.moechteBeitragen.trim(),
    aktualisiertAm: new Date().toISOString(),
  };
  const bisherige = project.kompetenzbeitraege ?? [];
  const index = bisherige.findIndex((k) => k.email.toLowerCase() === normalized);
  project.kompetenzbeitraege =
    index >= 0
      ? bisherige.map((k, i) => (i === index ? eintrag : k))
      : [...bisherige, eintrag];
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}

/**
 * Hängt eine neue Nachricht an den internen Projekt-Chat an (Rechteprüfung –
 * Kernteam & Team dieses Projekts – sitzt in der API-Route). Bewusst kein
 * Limit/Löschen im ersten Schritt, nur ein fortlaufendes Protokoll.
 */
export async function addChatNachricht(
  slug: string,
  params: { autorEmail: string; autorName: string; text: string }
): Promise<Project> {
  const project = await getProject(slug);
  if (!project) throw new Error(`Projekt "${slug}" nicht gefunden`);

  const neueNachricht: ChatNachricht = {
    id: randomUUID(),
    autorEmail: params.autorEmail.trim().toLowerCase(),
    autorName: params.autorName,
    text: params.text.trim(),
    erstelltAm: new Date().toISOString(),
  };
  project.chat = [...(project.chat ?? []), neueNachricht];
  project.aktualisiertAm = new Date().toISOString();

  const sql = getSql();
  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;
  return project;
}
