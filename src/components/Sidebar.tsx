"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Ausklappbare Seitenleiste für das Projektcockpit (Redesign 10/2026,
 * global für alle Projekte). Ergänzt die bestehende Hub-Navigation
 * (ProjektHubNav, drei Spalten oben auf der Seite) um einen jederzeit
 * erreichbaren Sprung-Index zu allen Bereichen der (langen) Cockpit-Seite –
 * besonders hilfreich weiter unten auf der Seite, wo die Hub-Navigation
 * selbst nicht mehr sichtbar ist. Rein clientseitig (Ankerlinks + eigener
 * Auf/Zu-Zustand), keine Serverlogik.
 */
const GRUPPEN: { label: string; punkte: { label: string; href: string }[] }[] = [
  {
    label: "Orga",
    punkte: [
      { label: "Kernteam", href: "#kernteam" },
      { label: "Team", href: "#team" },
      { label: "Kompetenzen", href: "#kompetenzen" },
    ],
  },
  {
    label: "Dashboard",
    punkte: [
      { label: "Fortschritt", href: "#fortschritt" },
      { label: "Phasenverlauf", href: "#phasenverlauf" },
      { label: "Projekt-Check & Bewertung", href: "#bewertung" },
      { label: "Reifegrad", href: "#reifegrad" },
    ],
  },
  {
    label: "Dynamik",
    punkte: [
      { label: "Aufgaben", href: "#aufgaben" },
      { label: "Ideen", href: "#ideen" },
      { label: "Gründercoach", href: "#gruendercoach" },
      { label: "Chat", href: "#chat" },
    ],
  },
];

export default function Sidebar({
  projektName,
  steuerboardUrl,
  dokumenteLink,
}: {
  projektName: string;
  steuerboardUrl?: string;
  dokumenteLink?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Burger-Button: steht jetzt inline in der Kopfzeile, auf Höhe des
          insightworx-Logos (gleiche Zeile, gleiche Einrückung wie der
          übrige Seiteninhalt) statt fest in der Viewport-Ecke. Die
          Seitenleiste selbst (aside) und das Abdunkeln (overlay) bleiben
          fixed, damit sie weiterhin über der ganzen Seite liegen, egal wie
          weit herunter gescrollt wurde. */}
      <button
        type="button"
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-surface shadow-sm transition hover:border-accent"
      >
        <span
          className={`block h-0.5 w-4 rounded bg-ink transition ${open ? "translate-y-[6.5px] rotate-45" : ""}`}
        />
        <span className={`block h-0.5 w-4 rounded bg-ink transition ${open ? "opacity-0" : ""}`} />
        <span
          className={`block h-0.5 w-4 rounded bg-ink transition ${open ? "-translate-y-[6.5px] -rotate-45" : ""}`}
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#0d2234]/35"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[270px] flex-col bg-navbg px-[18px] py-6 text-[#dce8f6] shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Menü schließen"
          className="mb-4 flex h-10 w-10 items-center justify-center self-start rounded-[9px] bg-white text-lg font-bold text-navbg"
        >
          ✕
        </button>
        <div className="mb-2 flex items-center gap-2.5 px-2">
          <img src="/eak-logo.png" alt="" aria-hidden="true" className="h-10 w-10 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-bold uppercase tracking-[1.4px] text-[#8fb4de]">
              Entscheiderakademie
            </span>
            <span className="text-[16px] font-bold text-white">{projektName}</span>
          </div>
        </div>
        <nav className="mt-2 flex flex-col gap-0.5 overflow-y-auto">
          {GRUPPEN.map((gruppe) => (
            <div key={gruppe.label}>
              <div className="mx-2 mb-1 mt-3.5 text-[10.5px] font-bold uppercase tracking-wide text-[#6f8fb4]">
                {gruppe.label}
              </div>
              {gruppe.punkte.map((punkt) => (
                <a
                  key={punkt.href}
                  href={punkt.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-[#c3d6ec] no-underline hover:bg-white/[0.07]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#527ba8]" />
                  {punkt.label}
                </a>
              ))}
            </div>
          ))}
          <div className="mx-2 mb-1 mt-3.5 text-[10.5px] font-bold uppercase tracking-wide text-[#6f8fb4]">
            Schnellzugriff
          </div>
          <a
            href="#zusammenfassung"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg bg-[rgba(190,0,0,0.25)] px-3 py-2 text-[13.5px] text-[#c3d6ec] no-underline"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-bad" />
            Aktueller Businessplan
          </a>
          {steuerboardUrl && (
            <a
              href={steuerboardUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-[#c3d6ec] no-underline hover:bg-white/[0.07]"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#527ba8]" />
              Steuerboard öffnen
            </a>
          )}
          {dokumenteLink && (
            <a
              href={dokumenteLink}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-[#c3d6ec] no-underline hover:bg-white/[0.07]"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#527ba8]" />
              Dokumente öffnen
            </a>
          )}
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-[#c3d6ec] no-underline hover:bg-white/[0.07]"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#527ba8]" />
            ← Alle Projekte
          </Link>
        </nav>
      </aside>
    </>
  );
}
