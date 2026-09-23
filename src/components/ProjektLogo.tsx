"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Eigenes Projekt-Logo (v0.76), steht rechts neben dem Projektnamen im
 * Cockpit. Kernteam-Mitglieder und Admins (`darfBearbeiten`) können ein
 * Bild hochladen – es wird direkt im Browser als Base64-Data-URL
 * kodiert und über die API-Route im Projekt gespeichert (keine separate
 * Datei-Ablage, darum die enge Größenbegrenzung).
 */
const MAX_DATEIGROESSE = 500 * 1024; // ≈ 500 KB, siehe API-Route

export default function ProjektLogo({
  slug,
  name,
  projektLogo,
  darfBearbeiten,
}: {
  slug: string;
  name: string;
  projektLogo: string;
  darfBearbeiten: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hochladen, setHochladen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function dateiAuswaehlen() {
    setError(null);
    inputRef.current?.click();
  }

  async function dateiGewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    e.target.value = ""; // erlaubt erneutes Auswählen derselben Datei
    if (!datei) return;

    if (datei.size > MAX_DATEIGROESSE) {
      setError("Die Datei ist zu groß (max. ca. 500 KB). Bitte ein kleineres Bild verwenden.");
      return;
    }

    setHochladen(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
        reader.readAsDataURL(datei);
      });

      const res = await fetch(`/api/projects/${slug}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hochladen fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setHochladen(false);
    }
  }

  async function entfernen() {
    setHochladen(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Entfernen fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setHochladen(false);
    }
  }

  const dateiInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
      className="hidden"
      onChange={dateiGewaehlt}
    />
  );

  if (projektLogo) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <img
          src={projektLogo}
          alt={`${name} Logo`}
          className="h-28 w-auto max-w-[320px] object-contain sm:h-32"
        />
        {darfBearbeiten && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={dateiAuswaehlen}
              disabled={hochladen}
              className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-accent disabled:opacity-40"
            >
              {hochladen ? "Lädt…" : "Ändern"}
            </button>
            <button
              type="button"
              onClick={entfernen}
              disabled={hochladen}
              className="whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-bad disabled:opacity-40"
            >
              Entfernen
            </button>
          </div>
        )}
        {error && <span className="max-w-[220px] text-right text-xs text-bad">{error}</span>}
        {dateiInput}
      </div>
    );
  }

  if (!darfBearbeiten) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={dateiAuswaehlen}
        disabled={hochladen}
        className="inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-md border-2 border-dashed border-accent/50 px-3 py-2 text-xs font-medium text-accent transition hover:border-accent hover:bg-accent-soft/40 disabled:opacity-40"
      >
        {hochladen ? "Lädt…" : "+ Logo hochladen"}
      </button>
      {error && <span className="max-w-[220px] text-right text-xs text-bad">{error}</span>}
      {dateiInput}
    </div>
  );
}
