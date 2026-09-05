// Eigene, schlanke Session-Token-Signierung statt einer zusätzlichen
// Bibliothek (z. B. jsonwebtoken) – so bleibt der Code Edge-Runtime-fähig:
// `middleware.ts` läuft auf der Vercel Edge Runtime, die kein Node-`crypto`
// kennt, aber die Web Crypto API (`crypto.subtle`) global bereitstellt.
// Dieselbe Funktion läuft unverändert in normalen Server-/API-Routen.

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

export interface SessionPayload {
  email: string;
  name: string;
  isAdmin: boolean;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET fehlt. Siehe README, Abschnitt "Online stellen (Vercel)".'
    );
  }
  return secret;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

/** Erzeugt ein signiertes, aber NICHT verschlüsseltes Token (keine Geheimnisse im Payload!). */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const key = await getKey(getSecret());
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );
  return `${body}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  try {
    const key = await getKey(getSecret());
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(body)
    );
    if (!valid) return null;
    const json = new TextDecoder().decode(fromBase64Url(body));
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}
