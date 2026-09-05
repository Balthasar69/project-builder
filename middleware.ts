import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Echte Registrierung/Logins statt gemeinsamem Basic-Auth-Passwort (v0.3,
// offene Entscheidung Nr. 7 im Plan): jede Person hat ein eigenes Konto,
// jedes Projekt zeigt nur die eigenen Mitglieder. Läuft auf der Edge
// Runtime – deshalb signiert `src/lib/session.ts` das Session-Cookie mit
// der Web Crypto API statt Node-`crypto`.
const PUBLIC_PATHS = new Set(["/login", "/register"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
