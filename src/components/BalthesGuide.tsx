"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Diktierknopf from "./Diktierknopf";

/**
 * "Balthes": optionaler Onboarding-Avatar im Projektcockpit. Erscheint bei
 * der Begrüßung oben rechts, bietet sich aktiv an ("Lass uns zusammen
 * starten") und führt bei Bestätigung durch eine kurze Selbstauskunft zu
 * beruflicher/persönlicher Erfahrung und zum Projekt-Umfeld (Unterstützer,
 * Partner, Kunden, Feedback, Kapital). Die Zusammenfassung wird bewusst NICHT
 * in einem eigenen neuen Datenfeld gespeichert, sondern über die bestehende
 * Kompetenzen-Route (POST /api/projects/[slug]/kompetenzen) als eigener
 * Kompetenzen-Eintrag abgelegt – das ist dieselbe Selbstauskunft, die auch im
 * Abschnitt "Kompetenzen" erscheint, nur von Balthes im Gespräch abgefragt.
 * Danach führt Balthes als kurzer Rundgang zu Chat, Ideen, Aufgaben und dem
 * Gründercoach (KI-Bot) – jeweils mit kurzer Erklärung, per "Weiter" geht's
 * zum nächsten Bereich. Reine Orientierung, keine Bewertung.
 */

type ChipVal = "ja" | "nein" | "wenig" | "mittel" | "viel";
type Answer = { val?: ChipVal; label?: string; text?: string };
type Answers = Record<string, Answer>;

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { val: ChipVal; label: string }[];
  value?: ChipVal;
  onChange: (val: ChipVal, label: string) => void;
}) {
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={o.val}
          onClick={() => onChange(o.val, o.label)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            value === o.val
              ? "border-accent bg-accent text-surface"
              : "border-line bg-surface text-ink hover:border-accent"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="relative">
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />
      <Diktierknopf
        onText={(erkannt) => onChange(value ? `${value} ${erkannt}` : erkannt)}
        className="absolute right-1.5 top-1.5"
      />
    </div>
  );
}

const GUIDE_STEPS = [
  {
    id: "chat",
    label: "Chat",
    text: "Im Chat tauschst du dich direkt mit deinem Team aus.",
  },
  {
    id: "ideen",
    label: "Ideen",
    text: "Unter Ideen sammelt ihr Gedanken und Vorschläge rund ums Projekt.",
  },
  {
    id: "aufgaben",
    label: "Aufgaben",
    text: "Unter Aufgaben haltet ihr fest, was als Nächstes ausgearbeitet werden muss.",
  },
  {
    id: "gruendercoach",
    label: "Gründercoach",
    text: "Und falls unterwegs Fragen aufkommen: Der Gründercoach (KI-Bot) ist jederzeit für dich da.",
  },
] as const;

// Literale Klassennamen für die Hervorhebung während des Rundgangs – Tailwind
// erkennt zur Build-Zeit nur Klassennamen, die irgendwo im Quelltext als
// vollständige Zeichenkette auftauchen (siehe ProjektHubNav.tsx), deshalb
// hier bewusst ausgeschrieben statt zusammengesetzt.
const HIGHLIGHT_CLASSES = ["ring-2", "ring-accent", "ring-offset-2"];

export default function BalthesGuide({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const router = useRouter();
  const vorname = name.trim().split(/\s+/)[0] || name;

  const [heroVisible, setHeroVisible] = useState(true);
  const [miniVisible, setMiniVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [guideIndex, setGuideIndex] = useState<number | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const highlightedElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([entry]) => setMiniVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function setChip(q: string, val: ChipVal, label: string) {
    setAnswers((prev) => ({ ...prev, [q]: { ...prev[q], val, label } }));
  }
  function setText(q: string, text: string) {
    setAnswers((prev) => ({ ...prev, [q]: { ...prev[q], text } }));
  }

  function buildBlock1(): string {
    const parts: string[] = [];
    const beruf = answers.berufserfahrung;
    if (beruf?.label) {
      parts.push(
        `Berufserfahrung: ${beruf.label}${beruf.text ? " – " + beruf.text : ""}.`
      );
    }
    if (answers.unternehmerisch?.val === "ja") {
      parts.push(
        `Bringt unternehmerische Erfahrung mit${
          answers.unternehmerisch.text ? " (" + answers.unternehmerisch.text + ")" : ""
        }.`
      );
    }
    if (answers.fuehrung?.val === "ja") {
      parts.push("Hat bereits Führungs-/Teamverantwortung getragen.");
    }
    if (answers.fachlich?.text) {
      parts.push(`Fachlicher Schwerpunkt: ${answers.fachlich.text}.`);
    }
    if (answers.vertrieb?.val === "ja") {
      parts.push("Bringt Vertriebs-/Verkaufserfahrung mit.");
    }
    if (answers.kaufmaennisch?.val === "ja") {
      parts.push("Verfügt über kaufmännische Kenntnisse.");
    }
    if (answers.marketing?.val === "ja") {
      parts.push("Bringt Marketing-/Kommunikationserfahrung mit.");
    }
    if (answers.ehrenamt?.text) {
      parts.push(`Ehrenamt/Vereinsarbeit: ${answers.ehrenamt.text}.`);
    }
    if (answers.lebenserfahrung?.text) {
      parts.push(`Weitere Erfahrung: ${answers.lebenserfahrung.text}.`);
    }
    return parts.join(" ");
  }

  function buildBlock2(): string {
    const parts: string[] = [];
    if (answers.unterstuetzer) {
      parts.push(
        `Unterstützer/Investoren: ${
          answers.unterstuetzer.val === "ja" ? "bereits vorhanden." : "noch nicht vorhanden."
        }`
      );
    }
    if (answers.partner) {
      parts.push(
        `Mögliche Partner: ${
          answers.partner.val === "ja" ? "bereits im Gespräch" : "noch keine bekannt"
        }${answers.partner.text ? " (" + answers.partner.text + ")" : ""}.`
      );
    }
    if (answers.kunden) {
      parts.push(
        `Kunden: ${
          answers.kunden.val === "ja" ? "bereits vorhanden" : "noch keine bekannt"
        }${answers.kunden.text ? " (" + answers.kunden.text + ")" : ""}.`
      );
    }
    if (answers.feedback) {
      parts.push(
        `Idee bereits vorgestellt: ${
          answers.feedback.val === "ja" ? "ja, mit Feedback." : "noch nicht."
        }`
      );
    }
    if (answers.kapital) {
      parts.push(
        `Startkapital: ${
          answers.kapital.val === "ja" ? "vorhanden." : "muss noch beschafft werden."
        }`
      );
    }
    return parts.join(" ");
  }

  function clearHighlight() {
    if (highlightedElRef.current) {
      highlightedElRef.current.classList.remove(...HIGHLIGHT_CLASSES);
      highlightedElRef.current = null;
    }
  }

  function goToGuideStep(i: number) {
    clearHighlight();
    const target = GUIDE_STEPS[i];
    const el = document.getElementById(target.id);
    if (el) {
      el.classList.add(...HIGHLIGHT_CLASSES);
      highlightedElRef.current = el;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setGuideIndex(i);
  }

  function endGuide() {
    clearHighlight();
    setGuideIndex(null);
  }

  async function speichernUndWeiter() {
    setSaving(true);
    setSaveError(null);
    const kannBeitragen = buildBlock1();
    const moechteBeitragen = buildBlock2();
    try {
      const res = await fetch(`/api/projects/${slug}/kompetenzen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kannBeitragen, moechteBeitragen }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
      router.refresh();
      setOpen(false);
      window.setTimeout(() => goToGuideStep(0), 250);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  const summaryPreview = [buildBlock1(), buildBlock2()].filter(Boolean).join("\n\n") ||
    "Noch keine Angaben erfasst.";

  return (
    <>
      {/* Hero: Avatar neben der Begrüßung */}
      <div ref={heroRef} className="mb-2 flex items-start justify-end gap-3">
        {heroVisible && (
          <div className="w-52 shrink-0 rounded-lg border border-line bg-surface px-3.5 py-3 text-left shadow-sm">
            <p className="mb-1 text-xs font-semibold text-ink">Balthes</p>
            <p className="mb-2.5 text-xs leading-snug text-ink-muted">
              Lass uns zusammen starten – ich führe dich durch die ersten Schritte.
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface transition hover:bg-accent-ink"
              >
                Ja, gerne unterstützen
              </button>
              <button
                type="button"
                onClick={() => setHeroVisible(false)}
                className="text-xs text-ink-faint hover:text-ink"
              >
                Später
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Balthes: Unterstützung anbieten"
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-accent"
        >
          <span className="absolute inset-[-4px] animate-ping rounded-full border-2 border-accent opacity-40" />
          <img src="/balthes.png" alt="Balthes" className="relative h-full w-full object-cover" />
        </button>
      </div>

      {/* Sticky Mini-Avatar, erscheint sobald die Begrüßung aus dem Blick scrollt */}
      {miniVisible && !open && guideIndex === null && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Balthes um Unterstützung bitten"
          className="fixed bottom-5 right-5 z-40 h-12 w-12 overflow-hidden rounded-full border-2 border-accent shadow-lg"
        >
          <img src="/balthes.png" alt="Balthes" className="h-full w-full object-cover" />
        </button>
      )}

      {/* Dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-surface sm:rounded-2xl">
            <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
              <img
                src="/balthes.png"
                alt="Balthes"
                className="h-9 w-9 rounded-full border border-accent object-cover"
              />
              <div>
                <p className="text-sm font-semibold text-ink">Balthes</p>
                <p className="text-xs text-ink-faint">Dein Guide für den Einstieg</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Schließen"
                className="ml-auto text-xl leading-none text-ink-faint hover:text-ink"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {step === 1 && (
                <>
                  <div className="mb-1 flex gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    <span className="h-1.5 w-1.5 rounded-full bg-line" />
                    <span className="h-1.5 w-1.5 rounded-full bg-line" />
                  </div>
                  <p className="mb-4 rounded-md bg-accent-soft/50 px-3 py-2.5 text-sm text-ink">
                    Erzähl mir kurz von deinem Hintergrund – das dient nur der
                    Orientierung, nicht der Bewertung. Du kannst deine Antworten
                    auch per Sprache eingeben – tipp einfach auf das
                    Mikrofon-Symbol neben dem Textfeld.
                  </p>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">Berufserfahrung</h4>
                    <ChipRow
                      value={answers.berufserfahrung?.val}
                      onChange={(v, l) => setChip("berufserfahrung", v, l)}
                      options={[
                        { val: "wenig", label: "Wenig / keine" },
                        { val: "mittel", label: "Einige Jahre" },
                        { val: "viel", label: "Langjährig" },
                      ]}
                    />
                    <TextField
                      value={answers.berufserfahrung?.text ?? ""}
                      onChange={(v) => setText("berufserfahrung", v)}
                      placeholder="Optional: Branche, Position, Details"
                    />
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">Unternehmerische Erfahrung</h4>
                    <ChipRow
                      value={answers.unternehmerisch?.val}
                      onChange={(v, l) => setChip("unternehmerisch", v, l)}
                      options={[
                        { val: "nein", label: "Noch nicht" },
                        { val: "ja", label: "Bereits gegründet / selbstständig" },
                      ]}
                    />
                    <TextField
                      value={answers.unternehmerisch?.text ?? ""}
                      onChange={(v) => setText("unternehmerisch", v)}
                      placeholder="Optional: Details"
                    />
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">Führungserfahrung</h4>
                    <ChipRow
                      value={answers.fuehrung?.val}
                      onChange={(v, l) => setChip("fuehrung", v, l)}
                      options={[
                        { val: "nein", label: "Keine" },
                        { val: "ja", label: "Team-/Personalverantwortung" },
                      ]}
                    />
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">
                      Fachliche Ausbildung / Spezialisierung
                    </h4>
                    <TextField
                      value={answers.fachlich?.text ?? ""}
                      onChange={(v) => setText("fachlich", v)}
                      placeholder="Welche Ausbildung, welcher Schwerpunkt?"
                    />
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">
                      Vertriebs- &amp; Verkaufserfahrung
                    </h4>
                    <ChipRow
                      value={answers.vertrieb?.val}
                      onChange={(v, l) => setChip("vertrieb", v, l)}
                      options={[
                        { val: "nein", label: "Keine" },
                        { val: "ja", label: "Vorhanden" },
                      ]}
                    />
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">
                      Finanzielle / kaufmännische Kenntnisse
                    </h4>
                    <ChipRow
                      value={answers.kaufmaennisch?.val}
                      onChange={(v, l) => setChip("kaufmaennisch", v, l)}
                      options={[
                        { val: "nein", label: "Wenig" },
                        { val: "ja", label: "Vorhanden" },
                      ]}
                    />
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">
                      Marketing- / Kommunikationserfahrung
                    </h4>
                    <ChipRow
                      value={answers.marketing?.val}
                      onChange={(v, l) => setChip("marketing", v, l)}
                      options={[
                        { val: "nein", label: "Wenig" },
                        { val: "ja", label: "Vorhanden" },
                      ]}
                    />
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">Ehrenamt / Vereinsarbeit</h4>
                    <TextField
                      value={answers.ehrenamt?.text ?? ""}
                      onChange={(v) => setText("ehrenamt", v)}
                      placeholder="Optional: z. B. Vorstand, Projektorganisation"
                    />
                  </div>

                  <div className="mb-2">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">Besondere Lebenserfahrungen</h4>
                    <TextField
                      value={answers.lebenserfahrung?.text ?? ""}
                      onChange={(v) => setText("lebenserfahrung", v)}
                      placeholder="Optional: z. B. Krisenbewältigung, Auslandsaufenthalte, Quereinstieg"
                    />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="mb-1 flex gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    <span className="h-1.5 w-1.5 rounded-full bg-line" />
                  </div>
                  <p className="mb-4 rounded-md bg-accent-soft/50 px-3 py-2.5 text-sm text-ink">
                    Und wie sieht es rund um dieses konkrete Projekt aus?
                  </p>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">
                      Gibt es bereits Unterstützer / Investoren?
                    </h4>
                    <ChipRow
                      value={answers.unterstuetzer?.val}
                      onChange={(v, l) => setChip("unterstuetzer", v, l)}
                      options={[
                        { val: "nein", label: "Noch nicht" },
                        { val: "ja", label: "Ja, bereits vorhanden" },
                      ]}
                    />
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">
                      Sind mögliche Partner bekannt?
                    </h4>
                    <ChipRow
                      value={answers.partner?.val}
                      onChange={(v, l) => setChip("partner", v, l)}
                      options={[
                        { val: "nein", label: "Noch keine" },
                        { val: "ja", label: "Ja, bereits im Gespräch" },
                      ]}
                    />
                    <TextField
                      value={answers.partner?.text ?? ""}
                      onChange={(v) => setText("partner", v)}
                      placeholder="Optional: wer?"
                    />
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">
                      Gibt es bereits (potenzielle) Kunden?
                    </h4>
                    <ChipRow
                      value={answers.kunden?.val}
                      onChange={(v, l) => setChip("kunden", v, l)}
                      options={[
                        { val: "nein", label: "Noch keine" },
                        { val: "ja", label: "Ja, bereits vorhanden" },
                      ]}
                    />
                    <TextField
                      value={answers.kunden?.text ?? ""}
                      onChange={(v) => setText("kunden", v)}
                      placeholder="Optional: Details"
                    />
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">
                      Wurde die Idee schon jemandem vorgestellt?
                    </h4>
                    <ChipRow
                      value={answers.feedback?.val}
                      onChange={(v, l) => setChip("feedback", v, l)}
                      options={[
                        { val: "nein", label: "Noch nicht" },
                        { val: "ja", label: "Ja, mit Feedback" },
                      ]}
                    />
                  </div>

                  <div className="mb-2">
                    <h4 className="mb-1.5 text-sm font-medium text-ink">Ist Startkapital vorhanden?</h4>
                    <ChipRow
                      value={answers.kapital?.val}
                      onChange={(v, l) => setChip("kapital", v, l)}
                      options={[
                        { val: "nein", label: "Muss noch beschafft werden" },
                        { val: "ja", label: "Vorhanden" },
                      ]}
                    />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="mb-1 flex gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  </div>
                  <p className="mb-4 rounded-md bg-accent-soft/50 px-3 py-2.5 text-sm text-ink">
                    Danke dir. Hier eine kurze Orientierung für alle im Projekt –
                    keine Bewertung, nur ein Ausgangspunkt. Sie erscheint als
                    dein Eintrag im Bereich „Kompetenzen".
                  </p>
                  <div className="mb-4 whitespace-pre-line rounded-md border border-line bg-surface-2/50 px-3 py-3 text-sm text-ink">
                    {summaryPreview}
                  </div>
                  {saveError && (
                    <p className="mb-3 text-sm text-bad">{saveError}</p>
                  )}
                </>
              )}
            </div>

            <div className="flex shrink-0 gap-3 border-t border-line px-5 py-4">
              {step === 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-2"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="ml-auto rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-ink"
                  >
                    Weiter
                  </button>
                </>
              )}
              {step === 2 && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-md border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-2"
                  >
                    Zurück
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="ml-auto rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-ink"
                  >
                    Weiter
                  </button>
                </>
              )}
              {step === 3 && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={saving}
                    className="rounded-md border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-2 disabled:opacity-40"
                  >
                    Zurück
                  </button>
                  <button
                    type="button"
                    onClick={speichernUndWeiter}
                    disabled={saving}
                    className="ml-auto rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? "Speichert…" : "Weiter"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rundgang: Balthes erklärt Chat, Ideen, Aufgaben, Gründercoach */}
      {guideIndex !== null && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
          <div className="flex w-full max-w-md items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-lg">
            <img
              src="/balthes.png"
              alt="Balthes"
              className="h-9 w-9 shrink-0 rounded-full border border-accent object-cover"
            />
            <div className="flex-1">
              <p className="mb-2 text-sm leading-snug text-ink">
                {GUIDE_STEPS[guideIndex].text}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (guideIndex === GUIDE_STEPS.length - 1) endGuide();
                  else goToGuideStep(guideIndex + 1);
                }}
                className="rounded-md bg-accent px-3.5 py-1.5 text-xs font-medium text-surface hover:bg-accent-ink"
              >
                {guideIndex === GUIDE_STEPS.length - 1 ? "Fertig" : "Weiter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
