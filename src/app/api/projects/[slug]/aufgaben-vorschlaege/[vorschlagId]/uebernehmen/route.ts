import { NextRequest, NextResponse } from "next/server";
import { ensureBitrixGroupId, getProject, markiereVorschlagUebernommen } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";
import { createTask } from "@/lib/bitrix24";

/**
 * Übernimmt einen KI-Aufgaben-Vorschlag als echte Bitrix24-Aufgabe – nur
 * fürs Kernteam, analog zu `ideen/[ideeId]/uebernehmen`. War das Projekt
 * noch nicht mit einer Bitrix24-Arbeitsgruppe verbunden, wird das jetzt
 * zuerst automatisch nachgeholt (`ensureBitrixGroupId`) – eine Aufgabe ohne
 * Gruppen-Zuordnung würde sonst zwar in Bitrix24 entstehen, aber nirgends
 * im Aufgaben-Bereich der App angezeigt werden (Korrektur, siehe README).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; vorschlagId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const project = await getProject(params.slug);
  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }
  if (!istKernteam(session, project)) {
    return NextResponse.json(
      { error: "Nur das Kernteam kann Aufgaben-Vorschläge übernehmen." },
      { status: 403 }
    );
  }

  const vorschlag = (project.aufgabenVorschlaege ?? []).find(
    (v) => v.id === params.vorschlagId
  );
  if (!vorschlag) {
    return NextResponse.json({ error: "Vorschlag nicht gefunden" }, { status: 404 });
  }
  if (vorschlag.uebernommenAlsTaskId) {
    return NextResponse.json(
      { error: "Dieser Vorschlag wurde bereits übernommen." },
      { status: 400 }
    );
  }

  // Ein bearbeiteter Titel aus der Durchsicht (siehe Frontend) hat Vorrang
  // vor dem ursprünglich von der KI vorgeschlagenen Titel.
  const body = (await req.json().catch(() => ({}))) as { titel?: string };
  const titel = body.titel?.trim() || vorschlag.titel;

  const responsibleId = project.kernteam.find((m) => m.bitrix24UserId)?.bitrix24UserId;

  try {
    const { project: verbundenesProjekt, groupId } = await ensureBitrixGroupId(project);
    const task = await createTask({
      title: titel,
      groupId,
      dealId: verbundenesProjekt.bitrix24.dealId || undefined,
      responsibleId,
    });
    const updated = await markiereVorschlagUebernommen(params.slug, params.vorschlagId, task.id);
    return NextResponse.json({ project: updated, task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 502 }
    );
  }
}
