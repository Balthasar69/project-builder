import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getProject, getUserByEmail, setUserPassword } from "@/lib/data";
import { getSession, hashPassword } from "@/lib/auth";
import { EmailError, sendMail } from "@/lib/email";

// Ohne leicht verwechselbare Zeichen (0/O, 1/l/I), damit das Passwort beim
// Weitergeben per Telefon/Chat keine Missverständnisse erzeugt.
const ZEICHEN = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function neuesEinmalPasswort(laenge = 12): string {
  let pw = "";
  for (let i = 0; i < laenge; i++) pw += ZEICHEN[randomInt(ZEICHEN.length)];
  return pw;
}

/**
 * "Erneut einladen" (nur Admins): Gibt einem bereits eingetragenen
 * Team- oder Kernteam-Mitglied wieder Zugang zu seinem BESTEHENDEN Konto. Es gibt in der
 * App (noch) kein "Passwort vergessen" – deshalb setzt der Admin hier ein
 * neues Einmal-Passwort, das er der Person selbst weitergibt. Die
 * Projekt-Mitgliedschaft hängt an der E-Mail-Adresse und bleibt unverändert.
 * Hat die Person noch gar kein Konto, wird keins angelegt – dann gilt der
 * normale Weg (Registrierung mit genau dieser E-Mail).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json(
      { error: "Nur Admins dürfen Mitglieder erneut einladen." },
      { status: 403 }
    );
  }

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "E-Mail-Adresse erforderlich." },
      { status: 400 }
    );
  }
  // Zugang hängt an der E-Mail: Team-Mitglied ODER Kernteam-Mitglied.
  const istMitglied =
    project.mitglieder.includes(email) ||
    project.kernteam.some((k) => k.email?.trim().toLowerCase() === email);
  if (!istMitglied) {
    return NextResponse.json(
      { error: "Diese Person ist kein Mitglied dieses Projekts." },
      { status: 404 }
    );
  }

  try {
    const origin = new URL(req.url).origin;
    const user = await getUserByEmail(email);

    if (!user) {
      return NextResponse.json({
        kontoVorhanden: false,
        registerLink: `${origin}/register`,
      });
    }

    const passwort = neuesEinmalPasswort();
    await setUserPassword(email, await hashPassword(passwort));

    // Das Passwort selbst geht bewusst NICHT per E-Mail raus – nur der
    // Hinweis samt Login-Link. Das Passwort gibt der Admin persönlich weiter.
    let mailHinweis: string | undefined;
    try {
      await sendMail({
        to: email,
        subject: `Neuer Zugang zum Project Builder (${project.name})`,
        html: `
          <p>Hallo,</p>
          <p>${session.name} hat dir wieder Zugang zu deinem Konto im Project Builder gegeben (Projekt <strong>${project.name}</strong>).</p>
          <p>Das neue Passwort bekommst du von ${session.name} persönlich. Danach kannst du dich hier anmelden:</p>
          <p><a href="${origin}/login">${origin}/login</a></p>
        `,
      });
    } catch (mailErr) {
      mailHinweis =
        mailErr instanceof EmailError
          ? mailErr.message
          : "Hinweis-E-Mail konnte nicht verschickt werden.";
    }

    return NextResponse.json({
      kontoVorhanden: true,
      passwort,
      loginLink: `${origin}/login`,
      mailHinweis,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
