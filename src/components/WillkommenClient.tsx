"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Los geht's"-Knopf auf dem Willkommens-Bildschirm (v0.62). Meldet im
 * Hintergrund, dass die Einführung gesehen wurde (damit sie beim nächsten
 * Anmelden nicht erneut automatisch erscheint), und führt danach immer zur
 * Startseite weiter – auch wenn die Meldung ausnahmsweise fehlschlägt
 * (nicht kritisch: die Person sieht die Einführung dann beim nächsten Mal
 * einfach noch einmal, statt hier hängen zu bleiben).
 */
export default function WillkommenClient() {
  const router = useRouter();
  const [laedt, setLaedt] = useState(false);

  async function losGehts() {
    setLaedt(true);
    try {
      await fetch("/api/auth/einfuehrung-gesehen", { method: "POST" });
    } catch {
      // bewusst ignoriert, siehe Doc-Kommentar oben
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={losGehts}
      disabled={laedt}
      className="w-fit rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {laedt ? "Einen Moment…" : "Los geht's →"}
    </button>
  );
}
