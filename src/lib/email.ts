// Schlanker E-Mail-Versand über die Resend-API (https://resend.com).
// Bewusst nur ein einfacher fetch-Aufruf statt eines zusätzlichen npm-Pakets
// – gleiches Prinzip wie schon bei der Bitrix24-Anbindung (src/lib/bitrix24.ts).
//
// Einrichtung (siehe README, Abschnitt "E-Mail-Versand"):
//   1. Kostenloses Konto auf resend.com anlegen.
//   2. Einen API-Key erzeugen (Dashboard → API Keys).
//   3. In Vercel als Umgebungsvariable RESEND_API_KEY hinterlegen.
// Ohne eigene, bei Resend bestätigte Absender-Domain wird automatisch die
// Test-Absenderadresse "onboarding@resend.dev" verwendet – die funktioniert
// sofort, ohne weitere Einrichtung, an jede Empfängeradresse.

export class EmailError extends Error {}

const ABSENDER = process.env.RESEND_FROM_EMAIL || "Project Builder <onboarding@resend.dev>";

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailError(
      'RESEND_API_KEY fehlt. Siehe README, Abschnitt "E-Mail-Versand".'
    );
  }

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ABSENDER,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
  } catch {
    throw new EmailError("E-Mail-Dienst (Resend) war nicht erreichbar.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : undefined) ?? `Status ${res.status}`;
    throw new EmailError(`Resend hat die E-Mail abgelehnt: ${detail}`);
  }
}
