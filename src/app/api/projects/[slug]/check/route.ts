import { NextRequest, NextResponse } from "next/server";
import { getProject, getUserByEmail, saveCheckResult } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { werteCheckAus } from "@/lib/scoring";
import { CheckAnswers, PHASES } from "@/lib/types";
import { benachrichtigeKernteam } from "@/lib/notify";

// Kann jetzt zusätzlich mehrere Benachrichtigungs-E-Mails ans Kernteam
// verschicken – zusammen mit dem Speichern etwas mehr Zeit als die
// Standard-Zeitgrenze von Vercel-Funktionen (10 s im Hobby-Plan) nötig.
export const maxDuration = 60;

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

  if (!hatProjektZugriff(session, project)) {
    return NextResponse.json(
      {
        error:
          "Nur Personen mit Zugriff auf dieses Projekt dürfen die Bewertung abgeben.",
      },
      { status: 403 }
    );
  }

  const body = (await req.json()) as {
    answers: CheckAnswers;
    notiz?: string;
    /**
     * Nur für Admins: im Namen einer anderen Person mit Projektzugriff
     * bewerten (siehe ProjectCheckForm, "Als Admin im Namen eines anderen
     * Mitglieds bewerten") – z. B. wenn diese Person sich selbst (noch)
     * nicht einloggen kann.
     */
    fuerEmail?: string;
  };

  // Für wen die Bewertung gilt: normalerweise die angemeldete Person selbst.
  // Nur Admins dürfen stattdessen `fuerEmail` mitschicken und damit im Namen
  // einer anderen Person mit Projektzugriff bewerten – das wird hier serverseitig
  // erneut geprüft, nicht nur im Client.
  let bewerter = { email: session.email, name: session.name };
  if (body.fuerEmail && body.fuerEmail.toLowerCase() !== session.email.toLowerCase()) {
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: "Nur Admins dürfen im Namen einer anderen Person bewerten." },
        { status: 403 }
      );
    }
    const zielEmail = body.fuerEmail.toLowerCase();
    const zielKernteamEintrag = project.kernteam.find(
      (m) => m.email?.toLowerCase() === zielEmail
    );
    const hatZugriff =
      !!zielKernteamEintrag ||
      project.mitglieder.some((m) => m.toLowerCase() === zielEmail);
    if (!hatZugriff) {
      return NextResponse.json(
        { error: "Diese Person hat keinen Zugriff auf dieses Projekt." },
        { status: 400 }
      );
    }
    const zielKonto = await getUserByEmail(body.fuerEmail);
    const zielName = zielKonto?.name ?? zielKernteamEintrag?.name ?? body.fuerEmail;
    bewerter = { email: body.fuerEmail, name: zielName };
  }

  // Die Phase kommt bewusst vom Server (aktuelle Projektphase), nicht vom
  // Client – so gehört jeder Check zweifelsfrei zu der Phase, in der er
  // wirklich durchgeführt wurde (Kapitel 6/11).
  const result = werteCheckAus(
    body.answers,
    project.aktuellePhase,
    bewerter,
    body.notiz
  );

  try {
    const updated = await saveCheckResult(params.slug, result);

    // Benachrichtigung darf das Speichern nie blockieren.
    try {
      const phasenName =
        PHASES.find((p) => p.code === project.aktuellePhase)?.name ??
        project.aktuellePhase;
      const imNamenVon =
        bewerter.email.toLowerCase() !== session.email.toLowerCase()
          ? ` – eingetragen von Admin ${session.name}`
          : "";
      await benachrichtigeKernteam({
        kernteam: updated.kernteam,
        ausloeserEmail: session.email,
        subject: `Neue Bewertung von ${bewerter.name} · ${project.name}`,
        html: `
          <p>Hallo,</p>
          <p>${bewerter.name} hat im Projekt <strong>${project.name}</strong> eine Bewertung für die Phase „${phasenName}" abgegeben (Score ${result.score}, Empfehlung ${result.empfehlung})${imNamenVon}.</p>
          <p>Alle Bewertungen im Projekt-Check ansehen: einfach im Project Builder das Projekt öffnen.</p>
        `,
      });
    } catch {
      // Best-effort – ein Fehler hier ändert nichts an der Antwort.
    }

    return NextResponse.json({ project: updated, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 404 }
    );
  }
}
