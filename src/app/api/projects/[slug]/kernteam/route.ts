import { NextRequest, NextResponse } from "next/server";
import {
  addKernteamMitglied,
  getProject,
  getUserByEmail,
  removeKernteamMitglied,
} from "@/lib/data";
import { getSession } from "@/lib/auth";
import { EmailError, sendMail } from "@/lib/email";

/**
 * Fügt eine Person zum Kernteam hinzu – bewusst nur für Admins (nicht schon
 * für Kernteam-Mitglieder selbst), da Kernteam-Rechte (Phasenwechsel,
 * Bewertung) weitreichend sind.
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
      { error: "Nur Admins dürfen das Kernteam ändern." },
      { status: 403 }
    );
  }

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    rolle?: string;
    email?: string;
  };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!name || !email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Name und gültige E-Mail-Adresse sind erforderlich." },
      { status: 400 }
    );
  }

  try {
    const updated = await addKernteamMitglied(params.slug, {
      name,
      rolle: body.rolle ?? "",
      email,
    });

    // Wie beim normalen Hinzufügen unter "Team": E-Mail-Versand darf das
    // Eintragen ins Kernteam nie blockieren.
    let mailHinweis: string | undefined;
    try {
      const hatKonto = await getUserByEmail(email);
      const origin = new URL(req.url).origin;
      const link = hatKonto ? `${origin}/login` : `${origin}/register`;
      await sendMail({
        to: email,
        subject: `Du bist jetzt im Kernteam von "${project.name}" im Project Builder`,
        html: `
          <p>Hallo ${name},</p>
          <p>${session.name} hat dich als <strong>${
          body.rolle || "Kernteam-Mitglied"
        }</strong> zum Kernteam von <strong>${project.name}</strong> im Project Builder hinzugefügt.</p>
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

/** Entfernt eine Person wieder aus dem Kernteam – ebenfalls nur für Admins. */
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
      { error: "Nur Admins dürfen das Kernteam ändern." },
      { status: 403 }
    );
  }

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json(
      { error: "E-Mail-Adresse erforderlich." },
      { status: 400 }
    );
  }

  try {
    const updated = await removeKernteamMitglied(params.slug, email);

    // E-Mail-Versand darf das Entfernen nie blockieren.
    let mailHinweis: string | undefined;
    try {
      await sendMail({
        to: email,
        subject: `Du bist nicht mehr im Kernteam von "${project.name}" im Project Builder`,
        html: `
          <p>Hallo,</p>
          <p>${session.name} hat dich aus dem Kernteam von <strong>${project.name}</strong> im Project Builder entfernt. Du kannst das Projekt weiterhin sehen und mitbearbeiten, aber nicht mehr die Phase wechseln oder die Bewertung abgeben.</p>
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
