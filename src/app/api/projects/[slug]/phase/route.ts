import { NextRequest, NextResponse } from "next/server";
import { getProject, setPhase } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";
import { naechstePhase, PHASES, PhaseCode, Project } from "@/lib/types";
import { benachrichtigeKernteam } from "@/lib/notify";

// Kann jetzt zusätzlich mehrere Benachrichtigungs-E-Mails ans Kernteam
// verschicken – zusammen mit dem Phasenwechsel etwas mehr Zeit als die
// Standard-Zeitgrenze von Vercel-Funktionen (10 s im Hobby-Plan) nötig.
export const maxDuration = 60;

function phasenName(phase: PhaseCode): string {
  return PHASES.find((p) => p.code === phase)?.name ?? phase;
}

/** Benachrichtigung darf den Phasenwechsel selbst nie blockieren. */
async function benachrichtigePhasenwechsel(
  updated: Project,
  ausloeserName: string,
  ausloeserEmail: string
) {
  try {
    await benachrichtigeKernteam({
      kernteam: updated.kernteam,
      ausloeserEmail,
      subject: `Phasenwechsel: ${updated.name} ist jetzt in „${phasenName(updated.aktuellePhase)}"`,
      html: `
        <p>Hallo,</p>
        <p>${ausloeserName} hat das Projekt <strong>${updated.name}</strong> in die Phase „${phasenName(updated.aktuellePhase)}" gesetzt.</p>
      `,
    });
  } catch {
    // Best-effort.
  }
}

/**
 * Schaltet ein Projekt eine Stufe in den normalen Phasenverlauf weiter
 * (Kapitel 6) – das ist der reguläre "Weiter zu: …"-Knopf, für
 * Kernteam-Mitglieder und Admins.
 *
 * Wird stattdessen ein `phase`-Feld im Body mitgeschickt, springt die App
 * direkt zu genau dieser Phase (vor oder zurück, beliebig) – das ist die
 * Admin-only "Phase zurücksetzen"-Funktion für Korrekturen, z. B. wenn
 * versehentlich zu früh weitergeschaltet wurde.
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

  const body = (await req.json().catch(() => ({}))) as { phase?: PhaseCode };

  if (body.phase) {
    // Direktes Setzen einer beliebigen Phase – bewusst nur für Admins, da
    // das (anders als der normale Ein-Schritt-Weiter-Knopf) auch rückwärts
    // springen und z. B. bereits durchgeführte Checks "überspringen" kann.
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: "Nur Admins dürfen die Phase direkt setzen bzw. zurücksetzen." },
        { status: 403 }
      );
    }
    const gueltig = PHASES.some((p) => p.code === body.phase);
    if (!gueltig) {
      return NextResponse.json({ error: "Unbekannte Phase." }, { status: 400 });
    }
    const updated = await setPhase(params.slug, body.phase);
    await benachrichtigePhasenwechsel(updated, session.name, session.email);
    return NextResponse.json({ project: updated });
  }

  if (!istKernteam(session, project)) {
    return NextResponse.json(
      {
        error:
          "Nur Kernteam-Mitglieder oder Admins dürfen die Phase eines Projekts wechseln.",
      },
      { status: 403 }
    );
  }

  const naechste = naechstePhase(project.aktuellePhase);
  if (!naechste) {
    return NextResponse.json(
      { error: "Es gibt keine nächste Phase mehr (letzte Stufe erreicht)." },
      { status: 400 }
    );
  }

  const updated = await setPhase(params.slug, naechste);
  await benachrichtigePhasenwechsel(updated, session.name, session.email);
  return NextResponse.json({ project: updated });
}
