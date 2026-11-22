import { NextRequest, NextResponse } from "next/server";
import { consumePasswordResetToken, setUserPassword } from "@/lib/data";
import { hashPassword } from "@/lib/auth";

// Löst den Einmal-Link aus der E-Mail ein und setzt das selbst gewählte neue
// Passwort. Es wird nur der Passwort-Hash geändert – Konto, Name, Admin-Status
// und Projekt-Mitgliedschaften bleiben unberührt.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  const token = body.token?.trim();
  const password = body.password;
  if (!token || !password) {
    return NextResponse.json({ error: "Link oder Passwort fehlt." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Das Passwort muss mindestens 8 Zeichen haben." },
      { status: 400 }
    );
  }
  try {
    const email = await consumePasswordResetToken(token);
    if (!email) {
      return NextResponse.json(
        {
          error:
            "Dieser Link ist abgelaufen oder wurde schon benutzt. Bitte auf der Anmeldeseite erneut „Passwort vergessen?“ anklicken.",
        },
        { status: 400 }
      );
    }
    await setUserPassword(email, await hashPassword(password));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
