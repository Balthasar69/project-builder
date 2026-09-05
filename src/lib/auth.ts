import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE, SessionPayload, verifySessionToken } from "./session";
import { Project } from "./types";

// bcrypt läuft bewusst nur hier (Node-Runtime: API-Routen, Server
// Components) – nicht in middleware.ts, das auf der Edge Runtime läuft und
// kein Node-`crypto` zur Verfügung hat. Passwort-Hashing ist ohnehin nur
// beim Registrieren/Anmelden nötig, nicht bei jedem Seitenaufruf.

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Liest die aktuelle, bereits verifizierte Session aus dem Cookie (Server Components/API-Routen). */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/**
 * Zugriff auf ein Projekt: Admins immer, eingetragene Mitglieder, und
 * zusätzlich Kernteam-Mitglieder auch dann, wenn sie (noch) nicht in
 * `mitglieder` stehen – z. B. weil sie über das ältere Terminal-Skript
 * `set-kernteam-email.mjs` ins Kernteam kamen (das `mitglieder` nicht
 * anfasst), oder weil jemand versehentlich nur aus „Team" entfernt wurde,
 * ohne auch aus dem Kernteam entfernt zu werden. Kernteam-Rechte sollen nie
 * dazu führen, dass die Person das Projekt gar nicht mehr sieht.
 */
export function hatProjektZugriff(session: SessionPayload, project: Project): boolean {
  return (
    session.isAdmin ||
    project.mitglieder.includes(session.email) ||
    istKernteam(session, project)
  );
}

/**
 * Erweiterte Rechte innerhalb eines Projekts: Admins und Kernteam-Mitglieder
 * (per hinterlegter E-Mail-Adresse) dürfen Dinge steuern, die über reines
 * Mitlesen/Mitarbeiten hinausgehen – aktuell den Phasenwechsel. Gedacht als
 * Grundlage für feinere Rollen: künftige Mitwirkende, die nur über
 * `mitglieder` Zugriff haben (nicht `kernteam`), bekommen so automatisch
 * weniger Rechte, ohne dass dafür ein eigenes Rollensystem nötig ist.
 */
export function istKernteam(session: SessionPayload, project: Project): boolean {
  return (
    session.isAdmin ||
    project.kernteam.some((m) => m.email?.toLowerCase() === session.email)
  );
}
