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
      body: JSON.stringify({ projectName: params.projectName }),
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
