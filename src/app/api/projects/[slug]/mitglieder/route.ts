import { NextRequest, NextResponse } from "next/server";
import { addMitglied, getProject, getUserByEmail, removeMitglied } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { EmailError, sendMail } from "@/lib/email";

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
      { error: "Kein Zugriff auf dieses Projekt." },
      { status: 403 }
    );
  }

  const body = (await req.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Gültige E-Mail-Adresse erforderlich." },
      { status: 400 }
    );
  }

  try {
    const updated = await addMitglied(params.slug, email);

    // E-Mail-Versand darf das Hinzufügen nie blockieren: Wenn Resend (noch)
    // nicht eingerichtet ist oder der Versand fehlschlägt, bleibt die Person
    // trotzdem als Mitglied eingetragen. Der Fehlertext geht als Hinweis mit
    // in die Antwort, ohne dass die App insgesamt einen Fehler zeigt.
    let mailHinweis: string | undefined;
    try {
      const hatKonto = await getUserByEmail(email);
      const origin = new URL(req.url).origin;
      const link = hatKonto ? `${origin}/login` : `${origin}/register`;
      await sendMail({
        to: email,
        subject: `Du hast Zugriff auf "${project.name}" im Project Builder`,
        html: `
          <p>Hallo,</p>
          <p>${session.name} hat dich zum Projekt <strong>${project.name}</strong> im Project Builder hinzugefügt.</p>
          <p>${
            hatKonto
              ? "Du hast bereits ein Konto – melde dich einfach an:"
              : "Du brauchst dafür ein eigenes Konto mit genau dieser E-Mail-Adresse. Registriere dich hier:"
          }</p>
          <p><a href="${link}">${link}</a></p>
        `,
      });
    } catch (mailErr) {
      mailHinweis =
        mailErr instanceof EmailError
          ? mailErr.message
          : "Einladungs-E-Mail konnte nicht verschickt werden.";
    }

    return NextResponse.json({ project: updated, mailHinweis });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

/**
 * Entfernt ein Teammitglied wieder aus einem Projekt – bewusst nur für
 * Admins (nicht schon für Kernteam-Mitglieder), da das Entfernen einer
 * Person deren Zugriff komplett entzieht.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  if (!session.isAdmin) {
    return NextResponse.json(
      { error: "Nur Admins dürfen Teammitglieder entfernen." },
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

  try {
    const updated = await removeMitglied(params.slug, email);

    // E-Mail-Versand darf das Entfernen nie blockieren – die Person bleibt
    // auch ohne erfolgreiche Mail entfernt, der Fehlertext geht nur als
    // Hinweis mit in die Antwort.
    let mailHinweis: string | undefined;
    try {
      await sendMail({
        to: email,
        subject: `Dein Zugriff auf "${project.name}" im Project Builder wurde entfernt`,
        html: `
          <p>Hallo,</p>
          <p>${session.name} hat dich aus dem Projekt <strong>${project.name}</strong> im Project Builder entfernt. Du hast darauf keinen Zugriff mehr.</p>
          <p>Falls das ein Irrtum war, wende dich bitte direkt an ${session.name}.</p>
        `,
      });
    } catch (mailErr) {
      mailHinweis =
        mailErr instanceof EmailError
          ? mailErr.message
          : "Benachrichtigungs-E-Mail konnte nicht verschickt werden.";
    }

    return NextResponse.json({ project: updated, mailHinweis });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
