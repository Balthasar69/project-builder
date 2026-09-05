"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeamManager({
  slug,
  mitglieder,
  namen,
  istAdmin,
}: {
  slug: string;
  mitglieder: string[];
  namen: Record<string, string>;
  istAdmin: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);

  // Zeigt standardmäßig nur den Namen. Admins können auf den Namen klicken
  // (bleibt an, bis erneut geklickt) oder mit der Maus darüberfahren
  // (blendet sich beim Wegfahren wieder aus), um die hinterlegte
  // E-Mail-Adresse einzublenden.
  const [klickEmail, setKlickEmail] = useState<string | null>(null);
  const [hoverEmail, setHoverEmail] = useState<string | null>(null);

  const [entfernenLaeuft, setEntfernenLaeuft] = useState<string | null>(null);
  const [entfernenFehler, setEntfernenFehler] = useState<string | null>(null);

  async function hinzufuegen(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setHinweis(null);
    setErfolg(null);
    try {
      const res = await fetch(`/api/projects/${slug}/mitglieder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hinzufügen fehlgeschlagen");
      if (data.mailHinweis) {
        setHinweis(
          `${email} wurde hinzugefügt, aber die Einladungs-E-Mail konnte nicht verschickt werden: ${data.mailHinweis}`
        );
      } else {
        setErfolg(`${email} wurde hinzugefügt und per E-Mail eingeladen.`);
      }
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function entfernen(m: string) {
    if (!window.confirm(`${m} wirklich aus dem Projekt entfernen?`)) return;
    setEntfernenLaeuft(m);
    setEntfernenFehler(null);
    try {
      const res = await fetch(`/api/projects/${slug}/mitglieder`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: m }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Entfernen fehlgeschlagen");
      if (data.mailHinweis) {
        setEntfernenFehler(
          `${m} wurde entfernt, aber die Benachrichtigungs-E-Mail konnte nicht verschickt werden: ${data.mailHinweis}`
        );
      }
      router.refresh();
    } catch (err) {
      setEntfernenFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setEntfernenLaeuft(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2">
        {mitglieder.map((m) => {
          const anzeigeName = namen[m] ?? m;
          const hatEigenenNamen = anzeigeName !== m;
          const emailSichtbar =
            !hatEigenenNamen ||
            (istAdmin && (klickEmail === m || hoverEmail === m));
          return (
            <div
              key={m}
              className="flex items-center justify-between rounded-md border border-line bg-surface px-4 py-2.5"
            >
              <div className="flex flex-col">
                {istAdmin && hatEigenenNamen ? (
                  <button
                    type="button"
                    onClick={() =>
                      setKlickEmail(klickEmail === m ? null : m)
                    }
                    onMouseEnter={() => setHoverEmail(m)}
                    onMouseLeave={() =>
                      setHoverEmail((k) => (k === m ? null : k))
                    }
                    className="text-left text-sm font-medium hover:text-accent"
                    title="Anklicken oder mit der Maus darüberfahren, um die E-Mail-Adresse anzuzeigen"
                  >
                    {anzeigeName}
                  </button>
                ) : (
                  <span className="text-sm font-medium">{anzeigeName}</span>
                )}
                {emailSichtbar && hatEigenenNamen && (
                  <span className="font-mono text-xs text-ink-faint">{m}</span>
                )}
              </div>
              {istAdmin && (
                <button
                  type="button"
                  onClick={() => entfernen(m)}
                  disabled={entfernenLaeuft === m}
                  className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-bad transition hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {entfernenLaeuft === m ? "Entfernt…" : "Entfernen"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {entfernenFehler && (
        <p className="mb-3 text-sm text-bad">{entfernenFehler}</p>
      )}
      <form onSubmit={hinzufuegen} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="E-Mail-Adresse einer weiteren Person"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !email.trim()}
          className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Fügt hinzu…" : "Hinzufügen"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      {hinweis && <p className="mt-3 text-sm text-warn">{hinweis}</p>}
      {erfolg && <p className="mt-3 text-sm text-good">{erfolg}</p>}
      <p className="mt-3 text-xs text-ink-faint">
        Die Person bekommt automatisch eine Einladungs-E-Mail und braucht ein
        eigenes Konto mit genau dieser E-Mail-Adresse (Registrierung unter
        /register), um Zugriff auf dieses Projekt zu bekommen. Beim
        Entfernen bekommt sie ebenfalls automatisch eine Benachrichtigung —
        und wird, falls sie im Kernteam stand, dort ebenfalls entfernt (kein
        Zugriff mehr = auch keine Kernteam-Rechte mehr).
      </p>
    </div>
  );
}
