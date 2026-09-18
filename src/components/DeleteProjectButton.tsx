"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Löschen-Button für eine Zeile in der Projektübersicht (nur für Balthasar
 * sichtbar, siehe src/app/page.tsx). Bewusst mit eigener PIN-Abfrage als
 * zweite Sicherung gegen Fehlklicks – getrennt vom Login-Passwort, siehe
 * DELETE_PIN in api/projects/[slug]/route.ts.
 */
export default function DeleteProjectButton({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [pin, setPin] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  async function loeschen() {
    setLaedt(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/projects/${slug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFehler(data.error || "Löschen fehlgeschlagen.");
        setLaedt(false);
        return;
      }
      router.refresh();
    } catch {
      setFehler("Löschen fehlgeschlagen.");
      setLaedt(false);
    }
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOffen(true);
        }}
        title={`"${name}" löschen`}
        className="ml-4 shrink-0 rounded-md border border-line px-3 py-2 text-xs text-ink-faint transition hover:border-red-400 hover:text-red-600"
      >
        🗑️
      </button>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="ml-4 flex shrink-0 items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2"
    >
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="PIN"
        className="w-16 rounded border border-line px-2 py-1 text-xs"
      />
      <button
        type="button"
        disabled={laedt || !pin}
        onClick={loeschen}
        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {laedt ? "…" : "Löschen"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOffen(false);
          setPin("");
          setFehler(null);
        }}
        className="text-xs text-ink-faint underline"
      >
        Abbrechen
      </button>
      {fehler && <span className="text-xs text-red-600">{fehler}</span>}
    </div>
  );
}
