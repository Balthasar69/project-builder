"use client";

import { useEffect, useState } from "react";

// Erster Vorname aus dem vollen angezeigten Namen (z. B. "Balthasar" aus
// "Balthasar Fleischmann") – für die persönliche Begrüßung vor dem Label,
// siehe unten. Fällt auf einen leeren String zurück, falls kein Name
// vorliegt (dann bleibt die Begrüßung einfach weg, kein Absturz).
function ersterVorname(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/**
 * Persönlicher KI-Hinweis "Für dich als Nächstes" ganz oben im
 * Projektcockpit-Hub, noch vor den drei Bereichen Orga/Dashboard/Dynamik
 * (siehe API-Route naechste-schritte/route.ts). Lädt beim Anzeigen der
 * Projektseite einmal automatisch nach. Schlägt die KI-Anfrage fehl, zeigt
 * die Box bewusst den technischen Grund (statt lautlos zu verschwinden) –
 * so bleibt ein Fehlschlagen erkennbar und meldbar, statt unbemerkt zu
 * bleiben; die restliche Seite funktioniert unabhängig davon weiter. Wird
 * mit dem vollen Namen der angemeldeten Person begrüßt (`name`), aus dem
 * hier nur der Vorname für die persönliche Anrede vor dem Label verwendet
 * wird.
 */
export default function NaechsteSchritte({ slug, name }: { slug: string; name: string }) {
  const vorname = ersterVorname(name);
  const [status, setStatus] = useState<"laedt" | "da" | "fehler">("laedt");
  const [satz, setSatz] = useState("");
  const [punkte, setPunkte] = useState<string[]>([]);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    let aktiv = true;
    fetch(`/api/projects/${slug}/naechste-schritte`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          satz?: string;
          punkte?: string[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        if (!aktiv) return;
        if (data.satz && data.punkte && data.punkte.length > 0) {
          setSatz(data.satz);
          setPunkte(data.punkte);
          setStatus("da");
        } else {
          setFehler("Keine verwertbare Antwort erhalten.");
          setStatus("fehler");
        }
      })
      .catch((err) => {
        if (!aktiv) return;
        setFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
        setStatus("fehler");
      });
    return () => {
      aktiv = false;
    };
  }, [slug]);

  return (
    <div className="mb-8 rounded-lg border border-accent bg-accent-soft/50 px-4 py-3.5 sm:px-5">
      <div className="mb-2 flex items-center gap-1.5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent-ink"
        >
          <path d="M12 2a5 5 0 00-5 5c0 2 1 3 2 4s1.5 1.5 1.5 2.5h3c0-1 .5-1.5 1.5-2.5s2-2 2-4a5 5 0 00-5-5z" />
          <path d="M10 22h4" />
        </svg>
        <span className="font-mono text-[0.65rem] uppercase tracking-wide text-accent-ink">
          {vorname ? `Hallo ${vorname} – für dich als Nächstes` : "Für dich als Nächstes"}
        </span>
      </div>

      {status === "laedt" && (
        <p className="text-sm text-ink-faint">Wird ermittelt…</p>
      )}
      {status === "fehler" && (
        <p className="text-sm text-ink-faint">
          Konnte gerade nicht ermittelt werden ({fehler}).
        </p>
      )}
      {status === "da" && (
        <>
          <p className="mb-2 text-sm font-semibold text-ink">{satz}</p>
          <ul className="flex flex-col gap-1">
            {punkte.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-ink-muted"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
