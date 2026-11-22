"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function PasswortZuruecksetzenForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [wiederholung, setWiederholung] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fertig, setFertig] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== wiederholung) {
      setError("Die beiden Passwörter sind nicht gleich.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/passwort-zuruecksetzen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
      setFertig(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-bad">
        Der Link ist unvollständig. Bitte den ganzen Link aus der E-Mail öffnen oder auf der
        Anmeldeseite erneut „Passwort vergessen?“ anklicken.
      </p>
    );
  }

  if (fertig) {
    return (
      <div className="flex flex-col gap-4 text-sm text-ink">
        <p>Dein neues Passwort ist gespeichert. Du kannst dich jetzt anmelden.</p>
        <Link
          href="/login"
          className="rounded-md bg-accent px-4 py-2 text-center text-sm font-medium text-surface transition hover:bg-accent-ink"
        >
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Neues Passwort (mind. 8 Zeichen)</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Neues Passwort wiederholen</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={wiederholung}
          onChange={(e) => setWiederholung(e.target.value)}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Speichert…" : "Passwort speichern"}
      </button>
    </form>
  );
}
