"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function PasswortVergessenForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [gesendet, setGesendet] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/passwort-vergessen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Senden fehlgeschlagen");
      setGesendet(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  if (gesendet) {
    return (
      <div className="flex flex-col gap-4 text-sm text-ink">
        <p>
          Wenn es für diese E-Mail-Adresse ein Konto gibt, ist jetzt eine E-Mail mit einem Link
          unterwegs. Der Link gilt 1 Stunde. Schau bitte auch im Spam-Ordner nach.
        </p>
        <p className="text-ink-muted">
          Kommt nach ein paar Minuten nichts an, melde dich bei Balthasar – er kann dir ein
          Einmal-Passwort geben.
        </p>
        <Link href="/login" className="font-medium text-accent hover:text-accent-ink">
          Zurück zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">E-Mail</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Sendet…" : "Link zum Zurücksetzen senden"}
      </button>
      <Link href="/login" className="text-sm font-medium text-accent hover:text-accent-ink">
        Zurück zur Anmeldung
      </Link>
    </form>
  );
}
