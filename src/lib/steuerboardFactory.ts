// Client für die Steuerboard-Factory: der Endpunkt `api/factory/create-copy`
// im Steuerboard-Repo (siehe dort `docs/factory-automatisierung.md`), der
// aus einem Projektnamen eine fertig eingerichtete, laufende
// Steuerboard-Kopie für die Phasen 2–5 macht (eigenes Vercel-Projekt,
// eigene Neon-Datenbank, Standard-Spaltenvorlage, Stufe 2 „Im Aufbau").
//
// Läuft bewusst nur, wenn explizit im Project Builder ausgelöst (Klick im
// Kernteam-Bereich eines Projekts) – nie automatisch beim Anlegen eines
// Projekts oder bei einem Phasenwechsel.

export interface FactoryErfolg {
  ok: true;
  projectName: string;
  resourceName: string;
  url: string;
  vercelProjectId: string;
  neonProjectId: string;
  deploymentId: string;
  stage: number;
  columns: string[];
}

export interface FactoryFehler {
  ok: false;
  status: number;
  message: string;
}

export type FactoryErgebnis = FactoryErfolg | FactoryFehler;

/**
 * Ruft die Steuerboard-Factory auf. Braucht `STEUERBOARD_FACTORY_URL` und
 * `STEUERBOARD_FACTORY_SECRET` als Umgebungsvariablen (siehe
 * `.env.local.example`) – fehlen sie, wird gar nicht erst versucht, den
 * externen Dienst zu erreichen, sondern sofort ein klarer Fehler
 * zurückgegeben.
 */
export async function erstelleSteuerboardKopie(params: {
  projectName: string;
  /**
   * Alle bisherigen Informationen aus diesem Projekt (Beschreibung, Ideen,
   * Fragebogen-Antworten, Kompetenzbeiträge – siehe `projektKontext.ts`,
   * `buildeProjektKontext`). Wird als Snapshot in der Steuerboard-Kopie
   * gespeichert und dort von der "KI-Hilfe" je Aufgabenkarte genutzt.
   * Optional: fehlt der Wert, entsteht die Kopie trotzdem, nur ohne diesen
   * Zusatzkontext.
   */
  projectContext?: string;
  /**
   * Slug dieses Projekts hier im Project Builder (v0.9x): die Factory
   * hinterlegt daraus in der neuen Steuerboard-Kopie einen direkten Link
   * zurück zur "Aktuelle Zusammenfassung" dieses Projekts (Phase 1), siehe
   * `PROJEKT_ZUSAMMENFASSUNG_URL` in create-copy.js. Optional: fehlt der
   * Slug, entsteht die Kopie trotzdem, nur ohne diesen Rücklink.
   */
  slug: string;
  /**
   * Link zur Dokumenten-Ablage dieses Projekts (Google Drive, siehe
   * `dokumenteLink` in `src/lib/types.ts` / `DokumenteLink.tsx`). Wird 1:1
   * als Startwert fuer den "Dokumente"-Link der neuen Steuerboard-Kopie
   * uebernommen (siehe `driveLink` in create-copy.js), damit er dort nicht
   * ein zweites Mal eingetragen werden muss. Optional: fehlt er, bleibt der
   * Link in der Kopie einfach leer und laesst sich dort spaeter unabhaengig
   * setzen.
   */
  dokumenteLink?: string;
}): Promise<FactoryErgebnis> {
  const factoryUrl = process.env.STEUERBOARD_FACTORY_URL;
  const factorySecret = process.env.STEUERBOARD_FACTORY_SECRET;

  if (!factoryUrl || !factorySecret) {
    return {
      ok: false,
      status: 503,
      message:
        'Steuerboard-Kopie kann nicht automatisch angelegt werden: ' +
        '"STEUERBOARD_FACTORY_URL" und/oder "STEUERBOARD_FACTORY_SECRET" ' +
        "sind auf dieser Instanz nicht gesetzt. Alternativ manuell nach " +
        'dem "Kopier-Rezept" im Steuerboard-Repo anlegen.',
    };
  }

  let res: Response;
  try {
    res = await fetch(new URL("/api/factory/create-copy", factoryUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-factory-secret": factorySecret,
      },
      body: JSON.stringify({
        projectName: params.projectName,
        projectContext: params.projectContext,
        projectBuilderSlug: params.slug,
        dokumenteLink: params.dokumenteLink,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      message:
        "Steuerboard-Factory nicht erreichbar: " +
        (err instanceof Error ? err.message : "Unbekannter Netzwerkfehler"),
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : undefined) ??
      (body && typeof body === "object" && "error" in body
        ? String((body as { error?: unknown }).error)
        : undefined) ??
      `Steuerboard-Factory antwortete mit Status ${res.status}`;
    return { ok: false, status: res.status, message };
  }

  const data = body as Partial<FactoryErfolg> | null;
  if (!data || !data.url || !data.resourceName) {
    return {
      ok: false,
      status: 502,
      message: "Steuerboard-Factory lieferte eine unerwartete Antwort.",
    };
  }

  return {
    ok: true,
    projectName: data.projectName ?? params.projectName,
    resourceName: data.resourceName,
    url: data.url,
    vercelProjectId: data.vercelProjectId ?? "",
    neonProjectId: data.neonProjectId ?? "",
    deploymentId: data.deploymentId ?? "",
    stage: data.stage ?? 2,
    columns: data.columns ?? [],
  };
}

export interface FactoryLoeschErgebnis {
  ok: boolean;
  status: number;
  message?: string;
}

/**
 * Gegenstück zu `erstelleSteuerboardKopie`: löscht das Vercel-Projekt und/
 * oder die Neon-Datenbank einer zuvor angelegten Kopie wieder
 * (`api/factory/delete-copy` im Steuerboard-Repo). Rechteprüfung (nur
 * Balthasar, siehe `istBalthasar` in auth.ts) sitzt in der aufrufenden
 * API-Route, nicht hier.
 */
export async function loescheSteuerboardKopie(params: {
  vercelProjectId?: string;
  neonProjectId?: string;
}): Promise<FactoryLoeschErgebnis> {
  const factoryUrl = process.env.STEUERBOARD_FACTORY_URL;
  const factorySecret = process.env.STEUERBOARD_FACTORY_SECRET;

  if (!factoryUrl || !factorySecret) {
    return {
      ok: false,
      status: 503,
      message:
        'Steuerboard-Kopie kann nicht automatisch gelöscht werden: ' +
        '"STEUERBOARD_FACTORY_URL" und/oder "STEUERBOARD_FACTORY_SECRET" ' +
        "sind auf dieser Instanz nicht gesetzt. Alternativ manuell im " +
        "Vercel-/Neon-Dashboard löschen.",
    };
  }

  if (!params.vercelProjectId && !params.neonProjectId) {
    // Nichts zu löschen (z.B. weil die Kopie ganz ohne die entsprechenden
    // IDs hinterlegt wurde) – kein Fehler, einfach nichts zu tun.
    return { ok: true, status: 200 };
  }

  let res: Response;
  try {
    res = await fetch(new URL("/api/factory/delete-copy", factoryUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-factory-secret": factorySecret,
      },
      body: JSON.stringify({
        vercelProjectId: params.vercelProjectId,
        neonProjectId: params.neonProjectId,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      message:
        "Steuerboard-Factory nicht erreichbar: " +
        (err instanceof Error ? err.message : "Unbekannter Netzwerkfehler"),
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : undefined) ??
      (body && typeof body === "object" && "error" in body
        ? String((body as { error?: unknown }).error)
        : undefined) ??
      `Steuerboard-Factory antwortete mit Status ${res.status}`;
    return { ok: false, status: res.status, message };
  }

  return { ok: true, status: 200 };
}
