"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleDriveIcon } from "./DokumenteLink";

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
  slug,
  projektName,
  steuerboardUrl,
  dokumenteLink,
  darfBearbeiten = false,
  aktuellePhase,
}: {
  slug: string;
  projektName: string;
  steuerboardUrl?: string;
  dokumenteLink?: string;
  darfBearbeiten?: boolean;
  /** Phasen-Code des Projekts, z. B. "freigabe" – nur dafür nötig, den
   *  "Jetzt freigeben"-Menüpunkt (GO in die Steuerungsphase) genau in der
   *  richtigen Phase ein-/auszublenden. */
  aktuellePhase?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // "Jetzt freigeben": GO/NO-GO-Übergang von der Phase "Projektfreigabe"
  // in die operative Steuerungsphase (Bitrix24/Steuerboard). Bisher Teil
  // des allgemeinen "Weiter zu: …"-Knopfs in PhaseAdvance.tsx, weiter unten
  // im aufklappbaren Phasenverlauf. Dieser eine, besonders wichtige
  // Übergang steht jetzt zusätzlich prominent hier im Menü – der
  // allgemeine Phasenverlauf-Knopf bleibt für alle anderen Phasenschritte
  // weiterhin unten auf der Seite.
  const [freigabeSaving, setFreigabeSaving] = useState(false);
  const [freigabeError, setFreigabeError] = useState<string | null>(null);

  async function freigeben() {
    setFreigabeSaving(true);
    setFreigabeError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/phase`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Freigabe fehlgeschlagen");
      router.refresh();
    } catch (err) {
      setFreigabeError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setFreigabeSaving(false);
    }
  }
  // "Zur Steuerung": solange es noch keine Steuerboard-Kopie gibt, klappt
  // ein Klick im Menü stattdessen einen kurzen Hinweistext auf (bisher auf
  // der Seite selbst in SteuerungUebergang.tsx, jetzt hierher verschoben).
  const [steuerungHinweisOffen, setSteuerungHinweisOffen] = useState(false);
  // "Dokumenten-Ablage": Kernteam/Admins können hier direkt im Menü einen
  // Google-Drive-Link eintragen (bisher auf der Seite selbst in
  // DokumenteLink.tsx, jetzt hierher verschoben).
  const [dokBearbeiten, setDokBearbeiten] = useState(false);
  const [dokUrl, setDokUrl] = useState(dokumenteLink ?? "");
  const [dokSaving, setDokSaving] = useState(false);
  const [dokError, setDokError] = useState<string | null>(null);

  async function dokumenteSpeichern() {
    setDokSaving(true);
    setDokError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/dokumente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dokumenteLink: dokUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
      setDokBearbeiten(false);
      router.refresh();
    } catch (err) {
      setDokError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setDokSaving(false);
    }
  }

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
          {/* "Jetzt freigeben": nur sichtbar, solange das Projekt genau in
              der Phase "Projektfreigabe" steht und nur für Kernteam/Admins
              (darfBearbeiten). Ein Klick löst den GO-Übergang in die
              Steuerungsphase aus – dieselbe Aktion wie der "Weiter zu: …"-
              Knopf im Phasenverlauf weiter unten, nur hier prominent im
              Menü, direkt griffbereit. */}
          {aktuellePhase === "freigabe" && darfBearbeiten && (
            <div>
              <button
                type="button"
                onClick={freigeben}
                disabled={freigabeSaving}
                className="flex w-full items-center gap-2.5 rounded-lg bg-accent/20 px-3 py-2 text-left text-[13.5px] font-medium text-white hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {freigabeSaving ? "Gibt frei…" : "Jetzt freigeben → Steuerung"}
              </button>
              {freigabeError && (
                <p className="mx-2 mt-1 text-xs text-bad">{freigabeError}</p>
              )}
            </div>
          )}

          {/* Zur Steuerung (Projektmanagement): mit Link, sobald eine
              Steuerboard-Kopie existiert – sonst Hinweistext zum Auf-/
              Zuklappen, genau wie vorher auf der Seite selbst. */}
          {steuerboardUrl ? (
            <a
              href={steuerboardUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-[#c3d6ec] no-underline hover:bg-white/[0.07]"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#527ba8]" />
              Zur Steuerung (Projektmanagement)
            </a>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setSteuerungHinweisOffen((o) => !o)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-[#c3d6ec] hover:bg-white/[0.07]"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#527ba8]" />
                Zur Steuerung (Projektmanagement)
              </button>
              {steuerungHinweisOffen && (
                <p className="mx-2 mb-1 mt-1 rounded-md bg-white/[0.06] px-3 py-2 text-xs leading-snug text-[#9fb6d1]">
                  Bald ist es so weit: Die Phase Project Building ist dann
                  vollendet, und es geht ins Projektmanagement. Komm dann
                  wieder hier zurück.
                </p>
              )}
            </div>
          )}

          {/* Dokumenten-Ablage: mit Link, sobald eine Google-Drive-URL
              hinterlegt ist – Kernteam/Admins können sie hier im Menü
              direkt eintragen oder ändern, genau wie vorher auf der Seite
              selbst (DokumenteLink.tsx). */}
          {dokBearbeiten ? (
            <div className="mx-2 mb-1 mt-1 rounded-md bg-white/[0.06] px-3 py-2.5">
              <input
                type="url"
                value={dokUrl}
                onChange={(e) => setDokUrl(e.target.value)}
                placeholder="Link zum Google-Drive-Ordner"
                className="w-full rounded-md border border-[#2e5276] bg-[#0d2234] px-2.5 py-1.5 text-xs text-white placeholder:text-[#6f8fb4] focus:border-accent focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={dokumenteSpeichern}
                  disabled={dokSaving}
                  className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {dokSaving ? "Speichert…" : "Speichern"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDokBearbeiten(false);
                    setDokUrl(dokumenteLink ?? "");
                    setDokError(null);
                  }}
                  className="text-xs text-[#9fb6d1] hover:text-white"
                >
                  Abbrechen
                </button>
              </div>
              {dokError && <p className="mt-1.5 text-xs text-bad">{dokError}</p>}
            </div>
          ) : dokumenteLink ? (
            <div className="flex items-center gap-1">
              <a
                href={dokumenteLink}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-[#c3d6ec] no-underline hover:bg-white/[0.07]"
              >
                <GoogleDriveIcon className="h-3.5 w-3.5 shrink-0" />
                Dokumenten-Ablage öffnen
              </a>
              {darfBearbeiten && (
                <button
                  type="button"
                  onClick={() => setDokBearbeiten(true)}
                  className="mr-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-wide text-[#6f8fb4] hover:text-white"
                >
                  Ändern
                </button>
              )}
            </div>
          ) : (
            darfBearbeiten && (
              <button
                type="button"
                onClick={() => setDokBearbeiten(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-[#c3d6ec] hover:bg-white/[0.07]"
              >
                <GoogleDriveIcon className="h-3.5 w-3.5 shrink-0" />
                Link zur Dokumenten-Ablage (Google Drive) hinzufügen
              </button>
            )
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
