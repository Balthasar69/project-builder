import { NextRequest, NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/data";
import { sendMail } from "@/lib/email";

// "Passwort vergessen": schickt einen Einmal-Link (1 Stunde gültig) an die
// E-Mail-Adresse eines bestehenden Kontos. Die Antwort ist immer dieselbe,
// egal ob es das Konto gibt – so lässt sich nicht herausfinden, wer ein Konto hat.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Bitte E-Mail-Adresse eingeben." }, { status: 400 });
  }
  try {
    const token = await createPasswordResetToken(email);
    if (token) {
      const origin = new URL(req.url).origin;
      const link = `${origin}/passwort-zuruecksetzen?token=${token}`;
      await sendMail({
        to: email,
        subject: "Neues Passwort für den Project Builder",
        html: `
          <p>Hallo,</p>
          <p>für dein Konto im Project Builder wurde ein neues Passwort angefordert. Über diesen Link kannst du selbst ein neues Passwort wählen (gültig 1 Stunde, nur einmal verwendbar):</p>
          <p><a href="${link}">${link}</a></p>
          <p>Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren – dein bisheriges Passwort bleibt dann gültig.</p>
        `,
      });
    }
  } catch (err) {
    // Fehler nur ins Server-Protokoll (z. B. RESEND_API_KEY fehlt), nicht an die Person.
    console.error("Passwort vergessen:", err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ ok: true });
}
