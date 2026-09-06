"use client";

import { useEffect, useState } from "react";

/**
 * Persönlicher KI-Hinweis "Für dich als Nächstes" ganz oben im
 * Projektcockpit-Hub, noch vor den drei Bereichen Orga/Dashboard/Dynamik
 * (siehe API-Route naechste-schritte/route.ts). Lädt beim Anzeigen der
 * Projektseite einmal automatisch nach; schlägt die KI fehl (z. B. weil kein
 * Schlüssel hinterlegt ist), verschwindet der Hinweis einfach wieder, statt
 * eine Fehlermeldung zu zeigen – die restliche Seite funktioniert unabhängig
 * davon.
 */
export default function NaechsteSchritte({ slug }: { slug: string }) {
  const [status, setStatus] = useState<"laedt" | "da" | "weg">("laedt");
  const [satz, setSatz] = useState("");
  const [punkte, setPunkte] = useState<string[]>([]);

  useEffect(() => {
    let aktiv = true;
    fetch(`/api/projects/${slug}/naechste-schritte`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<{ satz?: string; punkte?: string[] }>;
      })
      .then((data) => {
        if (!aktiv) return;
        if (data.satz && data.punkte && data.punkte.length > 0) {
          setSatz(data.satz);
          setPunkte(data.punkte);
          setStatus("da");
        } else {
          setStatus("weg");
        }
      })
      .catch(() => {
        if (aktiv) setStatus("weg");
      });
    return () => {
      aktiv = false;
    };
  }, [slug]);

  if (status === "weg") return null;

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
          Für dich als Nächstes
        </span>
      </div>

      {status === "laedt" ? (
        <p className="text-sm text-ink-faint">Wird ermittelt…</p>
      ) : (
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
