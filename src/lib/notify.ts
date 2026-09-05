// Benachrichtigt das Kernteam eines Projekts per E-Mail über neue
// Änderungen/Eintragungen (Bewertung, Phasenwechsel, Aufgaben-Notiz,
// Aufgabe erledigt). Bewusst als eigene, sehr fehlertolerante Funktion:
// Benachrichtigungen sind ein "Nice-to-have" – schlagen sie fehl (kein
// RESEND_API_KEY, Resend nicht erreichbar …), soll das NIE die eigentliche
// Aktion (Bewertung speichern, Phase wechseln, …) verhindern. Aufrufer
// rufen diese Funktion deshalb immer in einem eigenen try/catch auf bzw.
// werten die zurückgegebenen `fehler` nur als Hinweis aus.

import { KernteamMitglied } from "./types";
import { sendMail } from "./email";

/**
 * Schickt eine Benachrichtigung an alle Kernteam-Mitglieder eines Projekts
 * (die eine E-Mail-Adresse hinterlegt haben) – außer an die Person, die die
 * Änderung selbst ausgelöst hat, die muss sich ja nicht selbst benachrichtigen.
 */
export async function benachrichtigeKernteam(params: {
  kernteam: KernteamMitglied[];
  ausloeserEmail: string;
  subject: string;
  html: string;
}): Promise<{ fehler: string[] }> {
  const ausloeser = params.ausloeserEmail.toLowerCase();
  const ziel = params.kernteam.filter(
    (m): m is KernteamMitglied & { email: string } =>
      !!m.email && m.email.toLowerCase() !== ausloeser
  );

  const fehler: string[] = [];
  for (const m of ziel) {
    try {
      await sendMail({ to: m.email, subject: params.subject, html: params.html });
    } catch (err) {
      fehler.push(
        `${m.email}: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`
      );
    }
  }
  return { fehler };
}
