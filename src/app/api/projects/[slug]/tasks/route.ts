import { NextRequest, NextResponse } from "next/server";
import { ensureBitrixGroupId, getProject, repariereVerwaisteBitrixAufgaben } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { createTask, listTasks } from "@/lib/bitrix24";
import { Project } from "@/lib/types";
import { SessionPayload } from "@/lib/session";

async function pruefeZugriff(
  slug: string
): Promise<
  | { error: NextResponse }
  | { session: SessionPayload; project: Project }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 }) };
  }
  const project = await getProject(slug);
  if (!project) {
    return { error: NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 }) };
  }
  if (!hatProjektZugriff(session, project)) {
    return {
      error: NextResponse.json(
        { error: "Kein Zugriff auf dieses Projekt." },
        { status: 403 }
      ),
    };
  }
  return { session, project };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const check = await pruefeZugriff(params.slug);
  if ("error" in check) return check.error;
  const { project } = check;

  try {
    // Verbindet die Bitrix24-Arbeitsgruppe bei Bedarf automatisch (Projekte
    // vor dieser Korrektur konnten noch ohne Gruppe entstanden sein) – kein
    // manueller "Verbinden"-Klick mehr nötig. Anschließend werden dadurch
    // eventuell vorher "verlorene", schon übernommene Aufgaben (siehe
    // `repariereVerwaisteBitrixAufgaben`) automatisch nachträglich sichtbar.
    const { project: verbundenesProjekt, groupId } = await ensureBitrixGroupId(project);
    const { repariert } = await repariereVerwaisteBitrixAufgaben(verbundenesProjekt);

    const tasks = await listTasks({
      groupId,
      dealId: verbundenesProjekt.bitrix24.dealId || undefined,
    });
    return NextResponse.json({ tasks, repariert });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 502 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const check = await pruefeZugriff(params.slug);
  if ("error" in check) return check.error;
  const { project } = check;

  const body = (await req.json()) as { title?: string };
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
  }

  const responsibleId = project.kernteam.find((m) => m.bitrix24UserId)?.bitrix24UserId;

  try {
    const { project: verbundenesProjekt, groupId } = await ensureBitrixGroupId(project);
    const task = await createTask({
      title,
      groupId,
      dealId: verbundenesProjekt.bitrix24.dealId || undefined,
      responsibleId,
    });
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 502 }
    );
  }
}
