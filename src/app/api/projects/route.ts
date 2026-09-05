import { NextRequest, NextResponse } from "next/server";
import { createProject } from "@/lib/data";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = (await req.json()) as { name?: string; beschreibung?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { error: "Projektname ist erforderlich." },
      { status: 400 }
    );
  }

  try {
    const project = await createProject({
      name,
      ownerEmail: session.email,
      ownerName: session.name,
      beschreibung: body.beschreibung,
    });
    return NextResponse.json({ project });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
