import { NextRequest, NextResponse } from "next/server";
import { getProject, setBlockHinweis } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";
import { BlockHinweisKey, STANDARD_HINWEISE } from "@/lib/types";

/**
 * Ändert die individuelle Kurzanweisung eines einzelnen Cockpit-Blocks –
 * wie die Projektbeschreibung nur für Kernteam-Mitglieder und Admins.
 */
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

  if (!istKernteam(session, project)) {
    return NextResponse.json(
      {
        error:
          "Nur Kernteam-Mitglieder oder Admins dürfen die Kurzanweisungen ändern.",
      },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    key?: BlockHinweisKey;
    text?: string;
  };

  if (!body.key || !(body.key in STANDARD_HINWEISE)) {
    return NextResponse.json({ error: "Unbekannter Block." }, { status: 400 });
  }

  try {
    const updated = await setBlockHinweis(params.slug, body.key, body.text ?? "");
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
