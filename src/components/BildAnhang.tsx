"use client";

import { useRef } from "react";

/**
 * Bausteine für Bilder/Screenshots in Notizen und Chat:
 * - BildKnopf: Büroklammer zum Auswählen (mehrere Bilder möglich)
 * - BildVorschau: kleine Vorschau der noch nicht gesendeten Bilder mit ✕
 * - BilderAnzeige: Bilder einer gesendeten Nachricht (Klick = groß in neuem Tab)
 */
export function BildKnopf({
  onDateien,
  disabled,
  className = "",
}: {
  onDateien: (dateien: File[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const dateien = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (dateien.length) onDateien(dateien);
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        aria-label="Bild anhängen"
        title="Bild oder Screenshot anhängen (oder einfach mit Cmd+V einfügen)"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-base text-ink-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      >
        📎
      </button>
    </>
  );
}

export function BildVorschau({
  bilder,
  onEntfernen,
}: {
  bilder: string[];
  onEntfernen: (index: number) => void;
}) {
  if (bilder.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {bilder.map((src, i) => (
        <div key={i} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Vorschau" className="h-16 w-16 rounded-md border border-line object-cover" />
          <button
            type="button"
            onClick={() => onEntfernen(i)}
            aria-label="Bild entfernen"
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bad text-xs leading-none text-surface"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function BilderAnzeige({ slug, ids }: { slug: string; ids?: string[] }) {
  if (!ids || ids.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {ids.map((id) => {
        const url = `/api/projects/${slug}/bilder/${id}`;
        return (
          <a key={id} href={url} target="_blank" rel="noopener noreferrer" title="Bild groß ansehen">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Angehängtes Bild"
              loading="lazy"
              className="max-h-44 max-w-full rounded-md border border-line bg-surface object-contain"
            />
          </a>
        );
      })}
    </div>
  );
}
