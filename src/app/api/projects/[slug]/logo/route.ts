import { NextRequest, NextResponse } from "next/server";
import { getProject, setProjektLogo } from "@/lib/data";
import { getSession, istKernteam } from "@/lib/auth";

/**
 * Setzt/ändert das eigene Projekt-Logo (v0.76) – steht rechts neben dem
 * Projektnamen im Cockpit. Nur für Kernteam-Mitglieder und Admins
 * (siehe `istKernteam`). Es gibt keine separate Datei-Ablage: das Bild
 * wird als Base64-Data-URL direkt im Projekt gespeichert, darum ist die
 * Größe hier bewusst eng begrenzt.
 */
const MAX_DATA_URL_LAENGE = 700_000; // ≈ 500 KB Bilddatei nach Base64-Kodierung

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
      { error: "Nur Kernteam-Mitglieder oder Admins dürfen das Projekt-Logo ändern." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { logo?: string };
  const logo = (body.logo ?? "").trim();

  if (logo) {
    if (!/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(logo)) {
      return NextResponse.json(
        { error: "Bitte eine Bilddatei hochladen (PNG, JPEG, WEBP oder SVG)." },
        { status: 400 }
      );
    }
    if (logo.length > MAX_DATA_URL_LAENGE) {
      return NextResponse.json(
        { error: "Die Bilddatei ist zu groß (max. ca. 500 KB). Bitte ein kleineres Bild verwenden." },
        { status: 400 }
      );
    }
  }

  try {
    const updated = await setProjektLogo(params.slug, logo);
    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
