import { NextRequest, NextResponse } from "next/server";
import { getProject, setSteuerboard } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";
import { erstelleSteuerboardKopie } from "@/lib/steuerboardFactory";
import { benachrichtigeKernteam } from "@/lib/notify";

// Ruft extern die Vercel-/Neon-APIs auf (siehe steuerboardFactory.ts) – das
// kann spürbar länger als die Vercel-Standardzeitgrenze dauern.
export const maxDuration = 60;

/** Best-effort-Benachrichtigung; darf das Anlegen selbst nie blockieren. */
async function benachrichtigeKopieErstellt(params: {
  project: Awaited<ReturnType<typeof getProject>>;
  url: string;
  ausloeserName: string;
  ausloeserEmail: string;
}) {
  if (!params.project) return;
  try {
    await benachrichtigeKernteam({
      kernteam: params.project.kernteam,
      ausloeserEmail: params.ausloeserEmail,
      subject: `Steuerboard-Kopie eingerichtet: ${params.project.name}`,
      html: `
        <p>Hallo,</p>
        <p>${params.ausloeserName} hat für <strong>${params.project.name}</strong> die
        Steuerboard-Kopie für die weiteren Phasen eingerichtet:</p>
        <p><a href="${params.url}">${params.url}</a></p>
      `,
    });
  } catch {
    // Best effort.
  }
}

/**
 * Legt für dieses Projekt eine eigene Steuerboard-Kopie an (Phasen 2–5 im
 * Steuerboard-Ökosystem) – ausschließlich durch einen bewussten Klick im
 * Kernteam-Bereich (siehe `SteuerboardLink`-Komponente), nie automatisch.
 * Ein Projekt bekommt höchstens eine Kopie: ist `project.steuerboard`
 * bereits gesetzt, wird der Aufruf abgelehnt, statt versehentlich ein
 * zweites Vercel-/Neon-Projekt für dasselbe Vorhaben anzulegen.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  if (!istKernteam(session, project)) {
    return NextResponse.json(
      {
        error:
          "Nur Kernteam-Mitglieder oder Admins dürfen die Steuerboard-Kopie auslösen.",
      },
      { status: 403 }
    );
  }

  if (project.steuerboard?.url) {
    return NextResponse.json(
      {
        error:
          "Für dieses Projekt existiert bereits eine Steuerboard-Kopie.",
        steuerboard: project.steuerboard,
      },
      { status: 409 }
    );
  }

  const ergebnis = await erstelleSteuerboardKopie({ projectName: project.name });

  if (!ergebnis.ok) {
    return NextResponse.json({ error: ergebnis.message }, { status: ergebnis.status });
  }

  const updated = await setSteuerboard(params.slug, {
    url: ergebnis.url,
    resourceName: ergebnis.resourceName,
    vercelProjectId: ergebnis.vercelProjectId || undefined,
    neonProjectId: ergebnis.neonProjectId || undefined,
    erstelltAm: new Date().toISOString(),
    erstelltVonName: session.name,
    erstelltVonEmail: session.email,
  });

  await benachrichtigeKopieErstellt({
    project: updated,
    url: ergebnis.url,
    ausloeserName: session.name,
    ausloeserEmail: session.email,
  });

  return NextResponse.json({ project: updated });
}
