"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KernteamMitglied } from "@/lib/types";

/**
 * Kernteam-Liste mit Hinzufügen/Entfernen – bewusst nur für Admins
 * sichtbar (`istAdmin`), da Kernteam-Rechte (Phasenwechsel, Bewertung)
 * weitreichend sind. Normale Kernteam-Mitglieder sehen nur die Liste.
 */
export default function KernteamManager({
  slug,
  kernteam,
  istAdmin,
}: {
  slug: string;
  kernteam: KernteamMitglied[];
  istAdmin: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rolle, setRolle] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const [entfernenLaeuft, setEntfernenLaeuft] = useState<string | null>(null);
  const [entfernenFehler, setEntfernenFehler] = useState<string | null>(null);

  // Name und Rolle sind immer sichtbar. Nur Admins können zusätzlich die
  // E-Mail-Adresse einblenden – per Klick auf den Namen (bleibt an, bis
  // erneut geklickt) oder indem sie mit der Maus über den Namen fahren
  // (blendet sich beim Wegfahren wieder aus).
  const [klickDetails, setKlickDetails] = useState<string | null>(null);
  const [hoverDetails, setHoverDetails] = useState<string | null>(null);

  async function hinzufuegen(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setHinweis(null);
    try {
      const res = await fetch(`/api/projects/${slug}/kernteam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rolle, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hinzufügen fehlgeschlagen");
      if (data.mailHinweis) {
        setHinweis(
          `${name} wurde ins Kernteam aufgenommen, aber die Einladungs-E-Mail konnte nicht verschickt werden: ${data.mailHinweis}`
        );
      }
      setName("");
      setRolle("");
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function entfernen(m: KernteamMitglied) {
    if (!m.email) return;
    if (!window.confirm(`${m.name} wirklich aus dem Kernteam entfernen?`)) return;
    setEntfernenLaeuft(m.email);
    setEntfernenFehler(null);
    try {
      const res = await fetch(`/api/projects/${slug}/kernteam`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: m.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Entfernen fehlgeschlagen");
      if (data.mailHinweis) {
        setEntfernenFehler(
          `${m.name} wurde entfernt, aber die Benachrichtigungs-E-Mail konnte nicht verschickt werden: ${data.mailHinweis}`
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
        {kernteam.map((m) => {
          const schluessel = m.email ?? m.name;
          const emailSichtbar =
            istAdmin &&
            !!m.email &&
            (klickDetails === schluessel || hoverDetails === schluessel);
          return (
            <div
              key={schluessel}
              className="flex items-center justify-between rounded-md border border-line bg-surface px-4 py-2.5"
            >
              <div className="flex flex-col">
                <div className="flex items-baseline gap-3">
                  {istAdmin && m.email ? (
                    <button
                      type="button"
                      onClick={() =>
                        setKlickDetails(
                          klickDetails === schluessel ? null : schluessel
                        )
                      }
                      onMouseEnter={() => setHoverDetails(schluessel)}
                      onMouseLeave={() =>
                        setHoverDetails((k) => (k === schluessel ? null : k))
                      }
                      className="text-left text-sm font-medium hover:text-accent"
                      title="Anklicken oder mit der Maus darüberfahren, um die E-Mail-Adresse anzuzeigen"
                    >
                      {m.name}
                    </button>
                  ) : (
                    <span className="text-sm font-medium">{m.name}</span>
                  )}
                  <span className="text-sm text-ink-muted">{m.rolle}</span>
                </div>
                {emailSichtbar && (
                  <span className="font-mono text-xs text-ink-faint">
                    {m.email}
                  </span>
                )}
              </div>
              {istAdmin && m.email && (
                <button
                  type="button"
                  onClick={() => entfernen(m)}
                  disabled={entfernenLaeuft === m.email}
                  className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-bad transition hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {entfernenLaeuft === m.email ? "Entfernt…" : "Entfernen"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {entfernenFehler && (
        <p className="mb-3 text-sm text-bad">{entfernenFehler}</p>
      )}

      {istAdmin && (
        <form onSubmit={hinzufuegen} className="flex flex-col gap-2">
          <input
            type="text"
            required
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <input
            type="text"
            placeholder="Rolle (z. B. Projektleitung)"
            value={rolle}
            onChange={(e) => setRolle(e.target.value)}
            className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <input
            type="email"
            required
            placeholder="E-Mail-Adresse"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !name.trim() || !email.trim()}
            className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Fügt hinzu…" : "Hinzufügen"}
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      {hinweis && <p className="mt-3 text-sm text-warn">{hinweis}</p>}
      {istAdmin && (
        <p className="mt-3 text-xs text-ink-faint">
          Die Person wird automatisch auch als Team-Mitglied eingetragen
          (Zugriff auf die App) und bekommt eine Einladungs-E-Mail, falls sie
          noch nicht Mitglied war. Beim Entfernen aus dem Kernteam bekommt
          sie ebenfalls automatisch eine Benachrichtigung — der App-Zugriff
          auf das Projekt selbst bleibt dabei bestehen.
        </p>
      )}
    </div>
  );
}
