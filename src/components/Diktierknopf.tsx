"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mikrofon-Knopf für Spracheingabe (Diktat) in Textfeldern – seit v0.61
 * auf Wunsch bei praktisch allen frei auszufüllenden Textfeldern im
 * Projektcockpit eingebaut (Projektbeschreibung, Hinweise, Ideen, Chat,
 * Aufgaben-Notizen, Fragebogen-Antworten, Projekt-Check-Kommentare,
 * Kompetenzen) – absichtlich NICHT bei Mitglieder-Formularen
 * (Anmeldung/Registrierung, Kernteam/Team hinzufügen oder bearbeiten),
 * dort bleibt es bei reiner Tastatureingabe.
 *
 * Nutzt die Web-Speech-API direkt im Browser (kein eigener Server, keine
 * laufenden Kosten) – läuft zuverlässig in Chrome und Safari; Browser
 * ohne Unterstützung (z. B. Firefox, Stand heute) bekommen gar keinen
 * Knopf angezeigt, statt einer Fehlermeldung.
 *
 * `onText` bekommt jeden fertig erkannten Satzabschnitt übergeben – die
 * aufrufende Komponente hängt ihn selbst an das bisherige Feld an (siehe
 * Verwendungsbeispiele in den anderen Formular-Komponenten).
 */
export default function Diktierknopf({
  onText,
  className = "",
}: {
  onText: (text: string) => void;
  className?: string;
}) {
  const [verfuegbar, setVerfuegbar] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const erkennungRef = useRef<any>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const erkennung = new SpeechRecognition();
    erkennung.lang = "de-DE";
    erkennung.continuous = true;
    erkennung.interimResults = false;

    erkennung.onresult = (event: any) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          text += event.results[i][0].transcript;
        }
      }
      if (text.trim()) onTextRef.current(text.trim());
    };
    erkennung.onerror = () => setLaeuft(false);
    erkennung.onend = () => setLaeuft(false);

    erkennungRef.current = erkennung;
    setVerfuegbar(true);

    return () => {
      erkennung.onresult = null;
      erkennung.onerror = null;
      erkennung.onend = null;
      erkennung.stop();
    };
  }, []);

  if (!verfuegbar) return null;

  function toggle() {
    if (!erkennungRef.current) return;
    if (laeuft) {
      erkennungRef.current.stop();
      setLaeuft(false);
    } else {
      try {
        erkennungRef.current.start();
        setLaeuft(true);
      } catch {
        // schon gestartet – ignorieren
      }
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={laeuft ? "Aufnahme stoppen" : "Diktieren (Mikrofon)"}
      aria-label={laeuft ? "Aufnahme stoppen" : "Diktieren"}
      className={`inline-flex shrink-0 items-center justify-center rounded-full p-1.5 transition ${
        laeuft
          ? "animate-pulse bg-bad text-surface"
          : "text-ink-faint hover:bg-surface-2 hover:text-accent"
      } ${className}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
        <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.08A7 7 0 0 0 19 11z" />
      </svg>
    </button>
  );
}
