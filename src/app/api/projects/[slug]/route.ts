import { NextRequest, NextResponse } from "next/server";
import { deleteProject, getProject } from "@/lib/data";
import { getSession, istBalthasar } from "@/lib/auth";

// Löscht ein Projekt unwiderruflich. Bewusst zweifach abgesichert: nur
// Balthasar selbst (istBalthasar) UND nur mit der zusätzlichen PIN aus
// DELETE_PIN (getrennt von seinem Login-Passwort) – siehe DeleteProjectButton
// auf der Projektübersicht (src/app/page.tsx).
export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session || !istBalthasar(session.email)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const deletePin = process.env.DELETE_PIN;
  if (!deletePin) {
    return NextResponse.json(
      { error: "Löschen ist nicht konfiguriert (DELETE_PIN fehlt)." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!body.pin || body.pin !== deletePin) {
    return NextResponse.json({ error: "Falsche PIN." }, { status: 401 });
  }

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  await deleteProject(params.slug);
  return NextResponse.json({ ok: true });
}
