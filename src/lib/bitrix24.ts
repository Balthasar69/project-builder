import { Bitrix24Task, Bitrix24TaskStage } from "./types";

// Schlanker REST-Client für die Bitrix24-Aufgaben-/Arbeitsgruppen-Anbindung
// (Kapitel 25, „Nächste Ausbaustufen"). Nutzt denselben eingehenden Webhook,
// der schon für die CRM-Einrichtung angelegt wurde – braucht dafür aber
// zusätzlich die Scopes "tasks" und "sonet_group" (siehe README, Abschnitt
// „Bitrix24-Aufgaben"). Bewusst ohne Zwischenspeicherung: Aufgaben werden
// bei jedem Aufruf live aus Bitrix24 geladen, statt eine eigene Kopie in
// der App-Datenbank zu pflegen (kleinstes real testbares Produkt).
//
// Zum Anlegen/Erledigen von Aufgaben wird bewusst weiter die ÄLTERE
// Methodenfamilie "task.item.*" verwendet statt der neueren "tasks.task.*".
// Getestet (per Bitrix24s eigenem "Anfragen-Builder" am Webhook) verweigert
// "tasks.task.add" bei eingehenden Webhooks grundsätzlich den Dienst ("The
// request requires higher privileges than provided by the webhook token")
// – vermutlich, weil diese neuere Methodenfamilie zum SCHREIBEN nur für
// richtige Bitrix24-Apps (OAuth) gedacht ist, nicht für einfache Webhooks.
//
// Zum LESEN der Aufgabenliste (siehe `listTasks` unten) wird dagegen bewusst
// "tasks.task.list" verwendet (funktioniert über den Webhook einwandfrei,
// nur das Schreiben ist gesperrt) – denn nur diese neuere Methode liefert
// zusätzlich das Feld "STAGE_ID": die tatsächliche, per Drag & Drop gesetzte
// Kanban-Spalte. Die ältere "task.item.list" liefert zwar ebenfalls einen
// Status, der aber – wie ein Praxistest mit echten Daten gezeigt hat – bei
// per Drag & Drop verschobenen Aufgaben veraltet sein kann und nicht mehr
// zur wirklich angezeigten Spalte passt. "task.stages.get" liefert dazu die
// Klarnamen, Farben und Reihenfolge der in der jeweiligen Arbeitsgruppe
// selbst konfigurierten Spalten (z. B. "Neu", "In Arbeit", "Erledigt").

export class Bitrix24Error extends Error {}

function getWebhookUrl(): string {
  const url = process.env.BITRIX24_WEBHOOK_URL;
  if (!url) {
    throw new Bitrix24Error(
      'BITRIX24_WEBHOOK_URL fehlt. Siehe README, Abschnitt "Bitrix24-Aufgaben".'
    );
  }
  return url.endsWith("/") ? url : `${url}/`;
}

interface Bitrix24Response<T> {
  result?: T;
  error?: string;
  error_description?: string;
}

async function call<T>(
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const base = getWebhookUrl();

  let res: Response;
  try {
    res = await fetch(`${base}${method}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      cache: "no-store",
    });
  } catch {
    throw new Bitrix24Error(
      "Bitrix24 war nicht erreichbar. Bitte Internetverbindung/BITRIX24_WEBHOOK_URL prüfen."
    );
  }

  const body = (await res.json().catch(() => null)) as Bitrix24Response<T> | null;

  if (!res.ok || !body || body.error) {
    const detail = body?.error_description || body?.error || `HTTP ${res.status}`;
    throw new Bitrix24Error(
      `Bitrix24 hat "${method}" abgelehnt: ${detail}. Vermutlich fehlt dem Webhook ` +
        'eine Berechtigung (Scope "tasks" bzw. "sonet_group") – siehe README, ' +
        'Abschnitt "Bitrix24-Aufgaben".'
    );
  }
  return body.result as T;
}

// Bitrix24 verlangt beim Anlegen einer Aufgabe zwingend einen Verantwortlichen
// (RESPONSIBLE_ID). Ist im Kernteam niemand mit Bitrix24-Nutzer-ID hinterlegt,
// wird ersatzweise der Bitrix24-Nutzer verwendet, dem der Webhook gehört
// (per "user.current" ermittelt, kurz zwischengespeichert).
let cachedSelfUserId: number | null = null;

async function getSelfUserId(): Promise<number> {
  if (cachedSelfUserId) return cachedSelfUserId;
  const result = await call<{ ID: string }>("user.current", {});
  cachedSelfUserId = Number(result.ID);
  return cachedSelfUserId;
}

// Bitrix24-Aufgabenstatus als String: "5" = fertig/abgeschlossen.
const ERLEDIGT_STATUS = new Set(["5"]);

// Die ältere Methodenfamilie "task.item.*" liefert Feldnamen in
// GROSSBUCHSTABEN (wie im Bitrix24-Datenmodell selbst).
interface RawTask {
  ID: string | number;
  TITLE: string;
  STATUS: string | number;
  RESPONSIBLE_ID?: string | number;
  CREATED_DATE?: string;
}

function toBitrix24Task(raw: RawTask): Bitrix24Task {
  return {
    id: String(raw.ID),
    title: raw.TITLE,
    status: String(raw.STATUS),
    erledigt: ERLEDIGT_STATUS.has(String(raw.STATUS)),
    responsibleId: raw.RESPONSIBLE_ID ? String(raw.RESPONSIBLE_ID) : undefined,
    erstelltAm: raw.CREATED_DATE || undefined,
  };
}

// Die neuere Methodenfamilie "tasks.task.*" liefert Feldnamen dagegen in
// kleinbuchstaben/camelCase – hier defensiv beide Schreibweisen abgefangen,
// falls Bitrix24 das je nach Portal-Version unterschiedlich handhabt.
interface RawTaskV2 {
  id?: string | number;
  ID?: string | number;
  title?: string;
  TITLE?: string;
  status?: string | number;
  STATUS?: string | number;
  stageId?: string | number;
  STAGE_ID?: string | number;
  responsibleId?: string | number;
  RESPONSIBLE_ID?: string | number;
  createdDate?: string;
  CREATED_DATE?: string;
}

// Eine Kanban-Spalte, wie "task.stages.get" sie für eine Arbeitsgruppe
// liefert (als Objekt keyed nach Spalten-ID, nicht als Array).
interface RawStage {
  ID: string;
  TITLE: string;
  SORT: string | number;
  COLOR?: string;
  SYSTEM_TYPE?: string;
}

/**
 * Holt die selbst benannten Kanban-Spalten einer Bitrix24-Arbeitsgruppe
 * (Name, Farbe, Reihenfolge) – rein lesend, best effort: schlägt der Aufruf
 * fehl (z. B. weil eine ältere Arbeitsgruppe noch keine eigenen Spalten
 * hat), wird einfach eine leere Liste zurückgegeben, statt die ganze
 * Aufgabenliste scheitern zu lassen.
 */
export async function getGroupStages(groupId: number): Promise<Bitrix24TaskStage[]> {
  try {
    const result = await call<Record<string, RawStage>>("task.stages.get", {
      entityid: groupId,
    });
    return Object.values(result ?? {})
      .map((s) => ({
        id: String(s.ID),
        title: s.TITLE,
        color: s.COLOR,
        sort: Number(s.SORT) || 0,
      }))
      .sort((a, b) => a.sort - b.sort);
  } catch {
    return [];
  }
}

// Manche Aufgaben haben keine per Drag & Drop gesetzte Spalte (STAGE_ID
// "0" bzw. fehlend) – z. B. weil sie noch nie manuell verschoben wurden.
// Für diesen Fall wird ersatzweise eine passende Spalte geraten: bei
// bereits erledigten Aufgaben (Status 5) die Spalte, deren Name nach
// "erledigt" klingt (sonst die mit der höchsten Reihenfolge – meist die
// letzte/rechte Spalte); sonst die als "SYSTEM_TYPE = NEW" markierte
// Standard-Spalte für neue Aufgaben (sonst die mit der niedrigsten
// Reihenfolge – meist die erste/linke Spalte).
function rateStage(
  status: string,
  stageId: string | undefined,
  stages: Bitrix24TaskStage[],
  rawStages: RawStage[]
): Bitrix24TaskStage | undefined {
  if (stages.length === 0) return undefined;

  const exakt = stageId ? stages.find((s) => s.id === stageId) : undefined;
  if (exakt) return exakt;

  if (status === "5") {
    const erledigtSpalte = stages.find((s) =>
      /erledigt|fertig|abgeschlossen|complete|done/i.test(s.title)
    );
    return erledigtSpalte ?? stages[stages.length - 1];
  }

  const systemNeu = rawStages.find((s) => s.SYSTEM_TYPE === "NEW");
  const neuSpalte = systemNeu ? stages.find((s) => s.id === String(systemNeu.ID)) : undefined;
  return neuSpalte ?? stages[0];
}

function toBitrix24TaskV2(
  raw: RawTaskV2,
  stages: Bitrix24TaskStage[],
  rawStages: RawStage[]
): Bitrix24Task {
  const status = String(raw.status ?? raw.STATUS ?? "");
  const stageIdRaw = raw.stageId ?? raw.STAGE_ID;
  const stageId = stageIdRaw !== undefined ? String(stageIdRaw) : undefined;
  return {
    id: String(raw.id ?? raw.ID ?? ""),
    title: (raw.title ?? raw.TITLE ?? "") as string,
    status,
    erledigt: ERLEDIGT_STATUS.has(status),
    responsibleId:
      raw.responsibleId ?? raw.RESPONSIBLE_ID
        ? String(raw.responsibleId ?? raw.RESPONSIBLE_ID)
        : undefined,
    stage: rateStage(status, stageId, stages, rawStages),
    erstelltAm: raw.createdDate || raw.CREATED_DATE || undefined,
  };
}

export async function listTasks(params: {
  groupId?: number;
  dealId?: number;
}): Promise<Bitrix24Task[]> {
  if (!params.groupId) return [];

  // Bevorzugt: die neuere Methode "tasks.task.list" (liefert zusätzlich die
  // echte Kanban-Spalte, siehe Hinweis oben). Schlägt sie fehl – z. B. weil
  // ein Webhook das doch einmal nicht erlaubt –, wird auf die ältere,
  // garantiert funktionierende Methode "task.item.list" zurückgefallen
  // (dann ohne die Spalten-Zuordnung, nur mit dem technischen Status).
  try {
    const [taskResult, rawStagesResult, stages] = await Promise.all([
      call<{ tasks?: RawTaskV2[] } | RawTaskV2[]>("tasks.task.list", {
        filter: { GROUP_ID: params.groupId },
        select: ["ID", "TITLE", "STATUS", "STAGE_ID", "RESPONSIBLE_ID", "CREATED_DATE"],
      }),
      call<Record<string, RawStage>>("task.stages.get", {
        entityid: params.groupId,
      }).catch(() => ({}) as Record<string, RawStage>),
      getGroupStages(params.groupId),
    ]);
    const liste = Array.isArray(taskResult) ? taskResult : (taskResult?.tasks ?? []);
    const rawStages = Object.values(rawStagesResult ?? {});
    return liste.map((t) => toBitrix24TaskV2(t, stages, rawStages));
  } catch {
    // Die ältere Methode "task.item.list" lässt beim Filtern keine
    // Kombination aus Arbeitsgruppe (GROUP_ID) und CRM-Deal (UF_CRM_TASK) zu
    // ("must not contain key UF_CRM_TASK") – da Aufgaben in dieser App an
    // eine eigene Arbeitsgruppe pro Projekt gebunden sind, reicht der
    // Gruppenfilter allein.
    const result = await call<RawTask[]>("task.item.list", {
      order: { ID: "desc" },
      filter: { GROUP_ID: params.groupId },
      params: {},
    });
    return (result ?? []).map(toBitrix24Task);
  }
}

export async function createTask(params: {
  title: string;
  groupId?: number;
  dealId?: number;
  responsibleId?: number;
}): Promise<Bitrix24Task> {
  const fields: Record<string, unknown> = { TITLE: params.title };
  if (params.groupId) fields.GROUP_ID = params.groupId;
  if (params.dealId) fields.UF_CRM_TASK = [`D_${params.dealId}`];
  const responsibleId = params.responsibleId ?? (await getSelfUserId());
  fields.RESPONSIBLE_ID = responsibleId;

  // task.item.add liefert nur die neue Aufgaben-ID zurück, keine vollen
  // Felder – wir bauen die Anzeige-Daten deshalb selbst zusammen. Beim
  // nächsten Laden der Liste (listTasks) kommt ohnehin der echte,
  // aktuelle Stand aus Bitrix24.
  const newId = await call<number | string>("task.item.add", { fields });
  return {
    id: String(newId),
    title: params.title,
    status: "2",
    erledigt: false,
    responsibleId: String(responsibleId),
  };
}

export async function completeTask(taskId: string): Promise<void> {
  await call("task.item.complete", { TASKID: taskId });
}

/**
 * Ordnet eine bereits bestehende Bitrix24-Aufgabe nachträglich einer
 * Arbeitsgruppe zu. Wird gebraucht, um Aufgaben zu reparieren, die entstanden
 * sind, BEVOR ein Projekt mit einer Arbeitsgruppe verbunden war (siehe
 * `ensureBitrixGroupId` in data.ts) – ohne Gruppe tauchen Aufgaben nämlich
 * nirgends im Aufgaben-Bereich der App auf, obwohl sie in Bitrix24 selbst
 * ganz normal existieren.
 */
export async function setTaskGroup(taskId: string, groupId: number): Promise<void> {
  await call("task.item.update", { TASKID: taskId, FIELDS: { GROUP_ID: groupId } });
}

/**
 * Verschiebt eine Aufgabe in eine andere Kanban-Spalte (Drag & Drop im
 * Aufgaben-Board, v0.9x) – schreibt direkt nach Bitrix24 zurück, damit
 * beide Ansichten synchron bleiben. Nutzt bewusst dieselbe ältere Methode
 * "task.item.update" wie `setTaskGroup` oben (siehe Hinweis ganz oben in
 * dieser Datei: die neuere Methodenfamilie "tasks.task.*" verweigert
 * Schreibzugriffe über einfache Webhooks).
 */
export async function moveTaskStage(taskId: string, stageId: string): Promise<void> {
  await call("task.item.update", { TASKID: taskId, FIELDS: { STAGE_ID: stageId } });
}

/**
 * Postet eine Notiz aus dem Project Builder (Text und/oder vertextete
 * Sprachnotiz) als Kommentar bei der zugehörigen Bitrix24-Aufgabe – so
 * sehen auch Team-Mitglieder, die nur in Bitrix24 arbeiten, die Notiz,
 * ohne die App öffnen zu müssen. Die eigentliche Audiodatei bleibt bewusst
 * nur im Project Builder (kein Datei-Upload über den Webhook, siehe
 * Hinweis oben zu "task.item.*").
 */
export async function addTaskComment(
  taskId: string,
  message: string
): Promise<void> {
  await call("task.commentitem.add", {
    TASKID: taskId,
    FIELDS: { POST_MESSAGE: message },
  });
}

/** Legt eine eigene Bitrix24-Arbeitsgruppe für ein Projekt an, gibt deren ID zurück. */
export async function createWorkgroup(params: {
  name: string;
  description?: string;
}): Promise<number> {
  return call<number>("sonet_group.create", {
    NAME: params.name,
    DESCRIPTION: params.description ?? "",
    VISIBLE: "Y",
    OPENED: "N",
  });
}

/**
 * Fügt Kernteam-Mitglieder direkt (ohne Einladung/Bestätigung) zur
 * Bitrix24-Arbeitsgruppe hinzu, damit sie diese – und die Aufgaben darin –
 * auch in Bitrix24 selbst sehen, nicht nur über die App. Der Ersteller
 * (Webhook-Besitzer) ist ohnehin automatisch Mitglied/Besitzer.
 */
export async function addWorkgroupMembers(
  groupId: number,
  userIds: number[]
): Promise<void> {
  if (userIds.length === 0) return;
  await call("sonet_group.user.add", { GROUP_ID: groupId, USER_ID: userIds });
}

/**
 * Löscht eine bereits nach Bitrix24 übernommene Aufgabe wieder, wenn sie im
 * Project Builder entfernt wird (z. B. eine Idee oder ein Aufgaben-Vorschlag,
 * die/der schon übernommen war, aber doch verworfen wird) – damit
 * Löschungen genauso synchron laufen wie das Anlegen (siehe `removeIdee`
 * und `entferneAufgabenVorschlag` in `data.ts`). Best effort: ist die
 * Aufgabe in Bitrix24 bereits gelöscht oder Bitrix24 gerade nicht
 * erreichbar, wird der Fehler von den Aufrufern bewusst verschluckt, damit
 * das Löschen im Project Builder trotzdem gelingt (siehe Kommentar bei
 * `ensureBitrixGroupId` oben).
 */
export async function deleteTask(taskId: string): Promise<void> {
  await call("task.item.delete", { TASKID: taskId });
}

/**
 * Löscht die Bitrix24-Arbeitsgruppe eines Projekts, wenn das Projekt selbst
 * im Project Builder unwiderruflich gelöscht wird (siehe `deleteProject` in
 * `data.ts`) – damit auch auf Bitrix24-Seite nichts verwaist zurückbleibt.
 */
export async function deleteWorkgroup(groupId: number): Promise<void> {
  await call("sonet_group.delete", { GROUP_ID: groupId });
}
