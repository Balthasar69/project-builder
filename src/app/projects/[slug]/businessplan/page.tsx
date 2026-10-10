import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProject } from "@/lib/data";
import { getSession, hatProjektZugriff } from "@/lib/auth";
import { PHASES } from "@/lib/types";
import {
  istFinanzKapitel,
  istTeamKapitel,
  zerlegeBusinessplan,
} from "@/lib/businessplanDokument";
import BusinessplanDruckButton from "@/components/BusinessplanDruckButton";

export const dynamic = "force-dynamic";

function datumLang(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Vorzeigefassung des Businessplans: Deckblatt mit Projekt-Logo,
 * Inhaltsverzeichnis, nummerierte Kapitel in klassischer Gliederung
 * (Executive Summary bis Finanzplanung), Projektteam-Tabelle und Anhang.
 * Der Inhalt kommt aus dem zuletzt erstellten Businessplan (siehe
 * ProjektZusammenfassung.tsx); diese Seite formatiert ihn nur. Per Druck-
 * dialog ("Als PDF sichern") wird daraus ein A4-PDF.
 */
export default async function BusinessplanVorzeigefassung({
  params,
}: {
  params: { slug: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const project = await getProject(params.slug);
  if (!project) notFound();
  if (!hatProjektZugriff(session, project)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-ink-muted">Kein Zugriff auf dieses Projekt.</p>
      </main>
    );
  }

  const zus = project.zusammenfassung;
  const phase = PHASES.find((p) => p.code === project.aktuellePhase);

  if (!zus) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-3 font-display text-2xl font-semibold">{project.name}</h1>
        <p className="mb-6 text-ink-muted">
          Es gibt noch keinen Businessplan. Bitte zuerst im Projektcockpit
          unter „Businessplan“ auf „Businessplan erstellen“ klicken.
        </p>
        <Link
          href={`/projects/${project.slug}#zusammenfassung`}
          className="text-sm text-accent hover:text-accent-ink"
        >
          ← Zurück zum Projektcockpit
        </Link>
      </main>
    );
  }

  const kapitel = zerlegeBusinessplan(zus.text);
  const logo = project.projektLogo?.trim();
  const eigenesLogo = Boolean(logo);
  const stand = datumLang(zus.erstelltAm);

  const anzahl = {
    bewertungen: project.checkVerlauf?.length ?? 0,
    chat: project.chat?.length ?? 0,
    ideen: project.ideen?.length ?? 0,
    kompetenzen: project.kompetenzbeitraege?.length ?? 0,
    coach: project.coachChat?.length ?? 0,
  };
  const fragebogenBeantwortet = Boolean(project.projektstartFragebogen?.beantwortetAm);
  const hatSteuerboard = Boolean(project.steuerboard?.url);

  return (
    <div className="bp-seite bg-surface-2 px-4 py-6 print:bg-white print:p-0">
      {/* Nur am Bildschirm sichtbar, nicht im PDF */}
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <Link
          href={`/projects/${project.slug}#zusammenfassung`}
          className="text-sm text-accent hover:text-accent-ink"
        >
          ← Zurück zum Projektcockpit
        </Link>
        <BusinessplanDruckButton />
      </div>
      <p className="no-print mx-auto mb-5 max-w-[210mm] text-xs text-ink-muted">
        Tipp: Im Druckfenster unten links bzw. als Ziel „Als PDF sichern“ bzw.
        „Als PDF speichern“ wählen. {!eigenesLogo && (
          <span className="text-warn">
            Es ist noch kein Projekt-Logo hinterlegt – im Projektcockpit neben
            dem Projektnamen hochladen, dann erscheint es hier auf dem Deckblatt.
          </span>
        )}
      </p>

      <article className="bp-dokument mx-auto max-w-[210mm] bg-white text-ink shadow-sm print:shadow-none">
        {/* ---------- Deckblatt ---------- */}
        <section className="bp-deckblatt flex min-h-[270mm] flex-col justify-between px-[18mm] py-[20mm]">
          <div className="flex justify-end">
            {eigenesLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={`Logo ${project.name}`}
                className="max-h-[38mm] max-w-[70mm] object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/logo.png?v=57"
                alt="insightworx"
                className="max-h-[22mm] max-w-[70mm] object-contain opacity-80"
              />
            )}
          </div>

          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-accent-ink">
              Businessplan
            </p>
            <h1 className="mb-5 font-display text-5xl font-semibold leading-tight text-ink">
              {project.name}
            </h1>
            {project.beschreibung?.trim() && (
              <p className="max-w-[140mm] text-base leading-relaxed text-ink-muted">
                {project.beschreibung.trim()}
              </p>
            )}
          </div>

          <div className="border-t border-line pt-5 text-sm text-ink-muted">
            <p>
              <span className="text-ink-faint">Stand:</span> {stand}
            </p>
            <p>
              <span className="text-ink-faint">Aktuelle Projektphase:</span>{" "}
              {phase?.name ?? project.aktuellePhase}
            </p>
            <p>
              <span className="text-ink-faint">Erstellt von:</span>{" "}
              {zus.erstelltVonName}
            </p>
            <p className="mt-3 text-xs text-ink-faint">
              Vertraulich – nur für den vorgesehenen Empfängerkreis.
            </p>
          </div>
        </section>

        {/* ---------- Inhaltsverzeichnis ---------- */}
        <section className="bp-seitenumbruch px-[18mm] py-[16mm]">
          <h2 className="mb-6 font-display text-2xl font-semibold text-ink">
            Inhaltsverzeichnis
          </h2>
          <ol className="space-y-2 text-sm">
            {kapitel.map((k) => (
              <li key={k.nr} className="flex gap-3">
                <span className="w-6 shrink-0 font-mono text-ink-faint">{k.nr}</span>
                <a href={`#kap-${k.nr}`} className="text-ink hover:text-accent-ink">
                  {k.titel}
                </a>
              </li>
            ))}
            <li className="flex gap-3">
              <span className="w-6 shrink-0 font-mono text-ink-faint">A</span>
              <a href="#anhang" className="text-ink hover:text-accent-ink">
                Anhang: Datengrundlage
              </a>
            </li>
          </ol>
        </section>

        {/* ---------- Kapitel ---------- */}
        <div className="bp-seitenumbruch px-[18mm] py-[16mm]">
          {kapitel.map((k) => (
            <section key={k.nr} id={`kap-${k.nr}`} className="bp-kapitel mb-9">
              <h2 className="bp-ueberschrift mb-3 border-b border-line pb-2 font-display text-xl font-semibold text-ink">
                <span className="mr-3 text-accent-ink">{k.nr}</span>
                {k.titel}
              </h2>
              <div className="space-y-3">
                {k.bloecke.map((b, i) =>
                  b.typ === "absatz" ? (
                    <p key={i} className="text-[13px] leading-relaxed text-ink">
                      {b.text}
                    </p>
                  ) : (
                    <ul key={i} className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink">
                      {b.punkte.map((p, j) => (
                        <li key={j}>{p}</li>
                      ))}
                    </ul>
                  )
                )}
              </div>

              {istTeamKapitel(k.titel) && project.kernteam.length > 0 && (
                <table className="bp-tabelle mt-4 w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th className="py-1.5 pr-4 font-medium">Name</th>
                      <th className="py-1.5 font-medium">Rolle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.kernteam.map((m, i) => (
                      <tr key={i} className="border-b border-line/60">
                        <td className="py-1.5 pr-4 font-medium text-ink">{m.name}</td>
                        <td className="py-1.5 text-ink-muted">{m.rolle || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {istFinanzKapitel(k.titel) && (
                <table className="bp-tabelle mt-4 w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th className="py-1.5 pr-4 font-medium">Bestandteil</th>
                      <th className="py-1.5 font-medium">Stand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      "Kapitalbedarf und Finanzierung",
                      "Umsatzplanung",
                      "Kostenplanung",
                      "Rentabilitätsvorschau",
                      "Liquiditätsplanung",
                    ].map((z) => (
                      <tr key={z} className="border-b border-line/60">
                        <td className="py-1.5 pr-4 text-ink">{z}</td>
                        <td className="py-1.5 text-ink-muted">noch zu ergänzen</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
        </div>

        {/* ---------- Anhang ---------- */}
        <section id="anhang" className="bp-seitenumbruch px-[18mm] py-[16mm]">
          <h2 className="mb-3 border-b border-line pb-2 font-display text-xl font-semibold text-ink">
            <span className="mr-3 text-accent-ink">A</span>
            Anhang: Datengrundlage
          </h2>
          <p className="mb-3 text-[13px] leading-relaxed text-ink">
            Dieser Businessplan wurde am {stand} aus dem dokumentierten
            Projektverlauf im Project Builder zusammengestellt. Er stützt sich
            auf folgende Quellen:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink">
            <li>{anzahl.bewertungen} Projekt-Bewertungen (Checks)</li>
            <li>{anzahl.chat} Nachrichten im Projekt-Chat</li>
            <li>{anzahl.ideen} gesammelte Ideen</li>
            <li>{anzahl.kompetenzen} Kompetenz-Einträge des Teams</li>
            <li>das Kernteam mit seinen Rollen und die Einzelantworten der Bewertungen</li>
            <li>
              {fragebogenBeantwortet
                ? "der Projektstart-Fragebogen (Zielsituation, Umsatzziel, Liquidität, Meilensteine)"
                : "der Projektstart-Fragebogen (noch nicht beantwortet)"}
            </li>
            <li>{anzahl.coach} Nachrichten im Gespräch mit dem Gründercoach</li>
            {hatSteuerboard && (
              <li>
                das zugehörige Steuerboard: Boards, Aufgabenkarten mit
                Beschreibungen und Kommentaren, Coach-Gespräch und
                4DX-Wochenreviews
              </li>
            )}
            <li>die Aufgaben samt Notizen aus der Aufgabenverwaltung (Bitrix24)</li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            Aussagen, zu denen im Projekt keine Angaben vorliegen, sind als
            solche gekennzeichnet und wurden nicht ergänzt. Zahlen der
            Finanzplanung sind vom Team nachzutragen.
          </p>
        </section>
      </article>
    </div>
  );
}
