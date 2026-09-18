import { NextRequest, NextResponse } from "next/server";
import { getAllProjects, deleteProject } from "@/lib/data";
import { ermittleProjektStatus } from "@/lib/dashboardStatus";

export const dynamic = "force-dynamic";

function pruefeSecret(req: NextRequest): boolean {
  const secret = process.env.STEUERZENTRALE_SECRET;
  return !!secret && req.headers.get("x-steuerzentrale-secret") === secret;
}

/**
 * Server-zu-Server-Schnittstelle fuer die "Steuerzentrale" (projektuebergreifendes
 * Dashboard auf der Steuerboard-Factory, siehe dortige public/dashboard.html):
 * liefert denselben Status wie /dashboard (siehe dashboardStatus.ts), aber
 * roh als JSON statt als Seite, plus Zustaendigkeit (Kernteam) und die
 * verlinkte Steuerboard-Kopie (falls vorhanden). Nur mit korrektem
 * "x-steuerzentrale-secret"-Header erreichbar, kein Session-Login noetig,
 * da hier keine Person, sondern die Factory selbst anfragt.
 */
export async function GET(req: NextRequest) {
  if (!pruefeSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const projekte = await getAllProjects();
  const status = await Promise.all(projekte.map((p) => ermittleProjektStatus(p)));

  const ergebnis = projekte.map((p, i) => ({
    slug: p.slug,
    name: p.name,
    url: `https://project-builder-psi.vercel.app/projects/${p.slug}`,
    phase: status[i].phase,
    reifegrad: status[i].reifegrad,
    status: status[i].status,
    gruende: status[i].gruende,
    bewertung: status[i].bewertung,
    offeneAufgaben: status[i].offeneAufgaben,
    letzteAktivitaetAm: status[i].letzteAktivitaetAm,
    naechsteAufgabe: status[i].phase.ziel,
    zustaendig: p.kernteam.length ? p.kernteam.map((k) => k.name).join(", ") : null,
    steuerboard: p.steuerboard
      ? {
          url: p.steuerboard.url,
          vercelProjectId: p.steuerboard.vercelProjectId || null,
          neonProjectId: p.steuerboard.neonProjectId || null,
        }
      : null,
  }));

  return NextResponse.json({ ok: true, projekte: ergebnis });
}

/**
 * Loescht ein Projekt von der Steuerzentrale aus (Gegenstueck zum Lösch-Knopf
 * direkt im Project Builder, siehe DeleteProjectButton.tsx) - prueft
 * zusaetzlich zum Server-Secret denselben DELETE_PIN wie dort, damit ein
 * Loeschen von der Steuerzentrale aus genauso abgesichert ist wie im
 * Project Builder selbst.
 */
export async function DELETE(req: NextRequest) {
  if (!pruefeSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { slug?: string; pin?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const pinErwartet = process.env.DELETE_PIN;
  if (!pinErwartet || body.pin !== pinErwartet) {
    return NextResponse.json({ error: "wrong_pin" }, { status: 403 });
  }
  if (!body.slug) {
    return NextResponse.json({ error: "slug fehlt" }, { status: 400 });
  }

  await deleteProject(body.slug);
  return NextResponse.json({ ok: true });
}
