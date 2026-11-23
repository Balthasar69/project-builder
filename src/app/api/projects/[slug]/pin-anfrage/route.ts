import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/data";
import { STANDARD_ADMIN_EMAILS } from "@/lib/auth";
import { sendMail } from "@/lib/email";

// "PIN vergessen?" im Steuerboard: Das Steuerboard kennt keine E-Mail-Adressen
// (nur Name + PIN). Darum schickt es hier (Server-zu-Server, mit demselben
// Secret-Header wie beim Businessplan) eine Anfrage, und Balthasar bekommt eine
// Mail. Er setzt die PIN im Steuerboard zurueck (Menue "Personen"), danach legt
// die Person unter "Registrierung" selbst eine neue PIN fest.
const BUSINESSPLAN_LESE_SECRET = process.env.BUSINESSPLAN_LESE_SECRET;

// Einfacher Schutz vor Mehrfach-Klicks (je Projekt+Name, nur best effort).
const zuletzt = new Map<string, number>();

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const secretHeader = req.headers.get("x-businessplan-secret");
  if (!BUSINESSPLAN_LESE_SECRET || secretHeader !== BUSINESSPLAN_LESE_SECRET) {
    return NextResponse.json({ error: "Nicht erlaubt" }, { status: 401 });
  }
  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) {
    return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  }
  const key = `${params.slug}|${name.toLowerCase()}`;
  if (Date.now() - (zuletzt.get(key) ?? 0) < 60_000) {
    return NextResponse.json({ ok: true, schonAngefragt: true });
  }
  zuletzt.set(key, Date.now());

  const link = project.steuerboard?.url ?? "";
  let ok = false;
  for (const to of STANDARD_ADMIN_EMAILS) {
    try {
      await sendMail({
        to,
        subject: `PIN zurücksetzen angefragt: ${name} (${project.name})`,
        html: `
          <p>Hallo Balthasar,</p>
          <p><strong>${name}</strong> hat die PIN für das Steuerboard von <strong>${project.name}</strong> vergessen.</p>
          <p>So geht es: Steuerboard öffnen${link ? ` (<a href="${link}">${link}</a>)` : ""}, Menü ☰ → „Personen“, deine eigene PIN eingeben und bei ${name} auf „PIN zurücksetzen“ klicken. Danach legt ${name} unter „Registrierung“ mit dem Namen eine neue PIN fest.</p>
        `,
      });
      ok = true;
    } catch {
      // Best effort: die andere Adresse versuchen.
    }
  }
  if (!ok) {
    zuletzt.delete(key);
    return NextResponse.json({ error: "Mail konnte nicht gesendet werden" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
