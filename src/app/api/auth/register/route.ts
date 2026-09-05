import { NextRequest, NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/data";
import { effektiverAdminStatus, hashPassword } from "@/lib/auth";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    email?: string;
    password?: string;
    name?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const name = body.name?.trim();

  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "Name, E-Mail und Passwort sind erforderlich." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Das Passwort muss mindestens 8 Zeichen haben." },
      { status: 400 }
    );
  }

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "Für diese E-Mail-Adresse existiert bereits ein Konto." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({ email, passwordHash, name });

    const token = await createSessionToken({
      email: user.email,
      name: user.name,
      isAdmin: effektiverAdminStatus(user.email, user.isAdmin),
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
