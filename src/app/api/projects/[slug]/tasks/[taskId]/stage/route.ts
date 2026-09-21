import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { moveTaskStage } from "@/lib/bitrix24";

/**
 * Verschiebt eine Aufgabe per Drag & Drop im Aufgaben-Board (v0.9x) in eine
 * andere Bitrix24-Kanban-Spalte. Wie beim Erledigen/Anlegen von Aufgaben
 * darf das jedes Projektmitglied, nicht nur das Kernteam (`hatProjektZugriff`).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; taskId: string } }
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

  const body = (await req.json().catch(() => ({}))) as { stageId?: string };
  const stageId = body.stageId?.trim();
  if (!stageId) {
    return NextResponse.json({ error: "stageId ist erforderlich." }, { status: 400 });
  }

  try {
    await moveTaskStage(params.taskId, stageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 502 }
    );
  }
}
