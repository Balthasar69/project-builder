import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markiereEinfuehrungGesehen } from "@/lib/data";

/**
 * Markiert den einmaligen Willkommens-Bildschirm (v0.62, `/willkommen`) als
 * gesehen, sobald jemand dort auf "Los geht's" klickt. Danach leitet die
 * Startseite nicht mehr automatisch dorthin.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    await markiereEinfuehrungGesehen(session.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
