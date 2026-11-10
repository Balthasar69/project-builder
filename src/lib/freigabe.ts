import { Project } from "./types";
import { STANDARD_ADMIN_EMAILS } from "./auth";
import { sendMail } from "./email";

/**
 * Freigabe-Anfrage: Nur Balthasar (Admin) gibt Phasenwechsel und das Anlegen
 * der Steuerboard-Kopie frei. Kernteam-Mitglieder koennen stattdessen eine
 * Freigabe ANFRAGEN – das schickt eine Mail an Balthasar (nichts wird geaendert).
 * Gibt true zurueck, wenn mindestens eine Mail rausging.
 */
export async function sendeFreigabeAnfrage(params: {
  project: Project;
  was: string; // z. B. 'Wechsel in die Phase "Konzept"'
  vonName: string;
  vonEmail: string;
}): Promise<boolean> {
  const link = `https://project-builder-psi.vercel.app/projects/${params.project.slug}`;
  let ok = false;
  for (const to of STANDARD_ADMIN_EMAILS) {
    try {
      await sendMail({
        to,
        subject: `Freigabe angefragt: ${params.project.name} – ${params.was}`,
        html: `
          <p>Hallo Balthasar,</p>
          <p>${params.vonName} (${params.vonEmail}) bittet um Freigabe fuer
          <strong>${params.project.name}</strong>: <strong>${params.was}</strong>.</p>
          <p>Zum Freigeben bitte im Project Builder oeffnen:
          <a href="${link}">${link}</a></p>
        `,
      });
      ok = true;
    } catch {
      // Best effort: die andere Adresse versuchen.
    }
  }
  return ok;
}
