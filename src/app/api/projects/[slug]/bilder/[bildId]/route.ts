import { NextRequest, NextResponse } from "next/server";
import { getProject, holeBild } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";

/**
 * Liefert ein angehängtes Bild (Aufgaben-Notiz oder Team-Chat) aus. Nur für
 * angemeldete Personen mit Zugriff auf dieses Projekt; Bilder sind unveränderlich
 * und werden deshalb lange im Browser zwischengespeichert.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; bildId: string } }
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
    return NextResponse.json({ error: "Kein Zugriff auf dieses Projekt." }, { status: 403 });
  }

  const bild = await holeBild(params.slug, params.bildId);
  if (!bild) {
    return NextResponse.json({ error: "Bild nicht gefunden" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(Buffer.from(bild.base64, "base64")), {
    headers: {
      "Content-Type": bild.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
