import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProject } from "@/lib/data";
import { getSession, hatProjektZugriff, istKernteam } from "@/lib/auth";
import { PHASES, STANDARD_HINWEISE } from "@/lib/types";
import PhaseTracker from "@/components/PhaseTracker";
import PhaseAdvance from "@/components/PhaseAdvance";
import ReifegradMeter from "@/components/ReifegradMeter";
import ProjectCheckForm from "@/components/ProjectCheckForm";
import TeamManager from "@/components/TeamManager";
import KernteamManager from "@/components/KernteamManager";
import TaskBoard from "@/components/TaskBoard";
import IdeenManager from "@/components/IdeenManager";
import Brand from "@/components/Brand";
import LogoutButton from "@/components/LogoutButton";
import ProjectDescription from "@/components/ProjectDescription";
import ProjectProgress from "@/components/ProjectProgress";
import BlockHinweis from "@/components/BlockHinweis";

export const dynamic = "force-dynamic";

export default async function ProjectCockpit({
  params,
}: {
  params: { slug: string };
}) {
  const session = await getSession();
  // Zweite Absicherung neben middleware.ts: falls die Middleware aus
  // irgendeinem Grund nicht greift, leitet die Seite selbst weiter, statt
  // leer zu bleiben.
  if (!session) redirect("/login");

  const project = await getProject(params.slug);
  if (!project) notFound();

  if (!hatProjektZugriff(session, project)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="h-4 w-px bg-line" />
            <span className="font-mono text-xs uppercase tracking-widest text-accent">
              Projektcockpit
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-ink-muted">{session.name}</span>
            <LogoutButton />
          </div>
        </div>
        <h1 className="mb-3 font-display text-3xl font-semibold text-ink">
          Kein Zugriff
        </h1>
        <p className="mb-8 max-w-[55ch] text-ink-muted">
          Dieses Projekt ist nur für eingetragene Mitglieder sichtbar. Bitte
          jemanden aus dem Projekt, deine E-Mail-Adresse ({session.email}) im
          Bereich „Team" hinzuzufügen.
        </p>
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-wide text-accent hover:text-accent-ink"
        >
          ← Zurück zur Übersicht
        </Link>
      </main>
    );
  }

  const aktuellePhase = PHASES.find((p) => p.code === project.aktuellePhase);
  const darfHinweiseBearbeiten = istKernteam(session, project);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Brand size="gross" />
          <span className="h-6 w-px bg-line" />
          <span className="font-mono text-sm uppercase tracking-widest text-accent">
            Projektcockpit
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-mono text-sm uppercase tracking-wide text-ink-faint hover:text-ink"
          >
            ← Alle Projekte
          </Link>
          <span className="h-4 w-px bg-line" />
          <span className="text-sm text-ink-muted">{session.name}</span>
          <LogoutButton />
        </div>
      </div>

      {/* Kurzeinleitung: was das Projektcockpit ist und wie es genutzt wird.
          Bewusst statischer Text (kein BlockHinweis) — gilt gleich für alle
          Projekte, nicht projektspezifisch editierbar. */}
      <div className="mb-8 border-b border-line pb-6">
        <p className="mb-2 text-sm text-ink-muted">
          Der Project Builder zeigt auf einen Blick Phase, Team und offene
          Aufgaben eines Projekts. Der aktuelle Status ist Grundlage für die
          Jourfixe des Teams.
        </p>
        <p className="text-sm text-ink-muted">
          Der Project Builder bündelt Phase, Team, Bewertung und Aufgaben
          eines Projekts an einem Ort. Die Aufgaben kommen automatisch aus
          Bitrix24, wo das Tagesgeschäft im Detail läuft – so entsteht eine
          durchgehende Planung von Aufgaben bis Reporting.
        </p>
      </div>

      <h1 className="mb-1 font-display text-4xl font-semibold text-ink">
        {project.name}
      </h1>
      <p className="mb-3 text-ink-muted">{project.rolleImSystem}</p>
      <ProjectDescription
        slug={project.slug}
        beschreibung={project.beschreibung ?? ""}
        darfBearbeiten={istKernteam(session, project)}
      />

      {/* Schnellzugriff: springt direkt zu den vier Kernbereichen weiter
          unten auf derselben Seite (reine Sprungmarken, kein eigener
          Baustein) – soll neuen Nutzern auf einen Blick zeigen, worum es im
          Projektcockpit überhaupt geht. */}
      <nav className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <a
          href="#phasenverlauf"
          className="flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3 text-center transition hover:border-accent hover:bg-accent-soft"
        >
          <span className="text-xs text-ink-muted">Wo stehen wir</span>
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-ink">
            Phasenverlauf
          </span>
        </a>
        <a
          href="#bewertung"
          className="flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3 text-center transition hover:border-accent hover:bg-accent-soft"
        >
          <span className="text-xs text-ink-muted">Wie sehen wir uns</span>
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-ink">
            Bewertung
          </span>
        </a>
        <a
          href="#aufgaben"
          className="flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3 text-center transition hover:border-accent hover:bg-accent-soft"
        >
          <span className="text-xs text-ink-muted">Was ist zu tun</span>
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-ink">
            Aufgaben
          </span>
        </a>
        <a
          href="#ideen"
          className="flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3 text-center transition hover:border-accent hover:bg-accent-soft"
        >
          <span className="text-xs text-ink-muted">
            Was ich denke und zu tun ist
          </span>
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-ink">
            Ideen
          </span>
        </a>
      </nav>

      {/* Kernteam & Team stehen bewusst nebeneinander, auf einer Höhe, und
          direkt über der grafischen Projektfortschritts-Darstellung. */}
      <div className="mb-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <section>
          <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="font-display text-xl font-semibold">Kernteam</h2>
          </div>
          <BlockHinweis
            slug={project.slug}
            blockKey="kernteam"
            individuellerText={project.hinweise?.kernteam ?? ""}
            standardText={STANDARD_HINWEISE.kernteam}
            darfBearbeiten={darfHinweiseBearbeiten}
          />
          <KernteamManager
            slug={project.slug}
            kernteam={project.kernteam}
            istAdmin={session.isAdmin}
          />
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="font-display text-xl font-semibold">Team</h2>
            <span className="font-mono text-xs text-ink-faint">
              Zugriff auf die App
            </span>
          </div>
          <BlockHinweis
            slug={project.slug}
            blockKey="team"
            individuellerText={project.hinweise?.team ?? ""}
            standardText={STANDARD_HINWEISE.team}
            darfBearbeiten={darfHinweiseBearbeiten}
          />
          <TeamManager
            slug={project.slug}
            mitglieder={project.mitglieder}
            istAdmin={session.isAdmin}
          />
        </section>
      </div>

      <ProjectProgress
        aktuell={project.aktuellePhase}
        bereichStatus={project.bereichStatus}
      />

      <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <div className="bg-surface px-4 py-3">
          <div className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
            Phase
          </div>
          <div className="text-sm font-medium">
            {aktuellePhase?.order}. {aktuellePhase?.name}
          </div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
            Kernteam
          </div>
          <div className="text-sm font-medium">
            {project.kernteam.map((m) => m.name.split(" ").pop()).join(" · ")}
          </div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
            Bitrix24-Deal
          </div>
          <div className="tabular text-sm font-medium">
            {project.bitrix24.dealId ? `#${project.bitrix24.dealId}` : "–"}
          </div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-faint">
            Zuordnung
          </div>
          <div className="text-sm font-medium">{project.bitrix24.zuordnung}</div>
        </div>
      </div>

      <section className="mb-12">
        <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="font-display text-xl font-semibold">
            Reifegrad je Bereich
          </h2>
          <span className="font-mono text-xs text-ink-faint">Kapitel 9</span>
        </div>
        <BlockHinweis
          slug={project.slug}
          blockKey="reifegrad"
          individuellerText={project.hinweise?.reifegrad ?? ""}
          standardText={STANDARD_HINWEISE.reifegrad}
          darfBearbeiten={darfHinweiseBearbeiten}
        />
        <ReifegradMeter status={project.bereichStatus} />
      </section>

      <section id="phasenverlauf" className="mb-12 scroll-mt-6">
        <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="font-display text-xl font-semibold">
            Phasenverlauf
          </h2>
          <span className="font-mono text-xs text-ink-faint">Kapitel 6</span>
        </div>
        <BlockHinweis
          slug={project.slug}
          blockKey="phasenverlauf"
          individuellerText={project.hinweise?.phasenverlauf ?? ""}
          standardText={STANDARD_HINWEISE.phasenverlauf}
          darfBearbeiten={darfHinweiseBearbeiten}
        />
        <PhaseTracker
          aktuell={project.aktuellePhase}
          checkVerlauf={project.checkVerlauf}
          kernteam={project.kernteam}
        />
        <PhaseAdvance
          slug={project.slug}
          aktuell={project.aktuellePhase}
          darfSteuern={istKernteam(session, project)}
          istAdmin={session.isAdmin}
        />
      </section>

      <section id="bewertung" className="mb-12 scroll-mt-6">
        <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="font-display text-xl font-semibold">
            Projekt-Check &amp; GO/NO-GO
          </h2>
          <span className="font-mono text-xs text-ink-faint">Kapitel 11</span>
        </div>
        <BlockHinweis
          slug={project.slug}
          blockKey="check"
          individuellerText={project.hinweise?.check ?? ""}
          standardText={STANDARD_HINWEISE.check}
          darfBearbeiten={darfHinweiseBearbeiten}
        />
        <ProjectCheckForm
          key={project.aktuellePhase}
          slug={project.slug}
          phase={project.aktuellePhase}
          checkVerlauf={project.checkVerlauf}
          darfBewerten={istKernteam(session, project)}
          kernteam={project.kernteam}
          bewerterEmail={session.email}
          bewerterName={session.name}
        />
      </section>

      <section id="aufgaben" className="scroll-mt-6">
        <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="font-display text-xl font-semibold">Aufgaben</h2>
          <span className="font-mono text-xs text-ink-faint">Kapitel 25</span>
        </div>
        {/* Ursprünglich erst ab der Kerngruppen-Phase sichtbar (Kapitel 6) –
            auf Wunsch jetzt in jeder Phase nutzbar, damit Aufgaben schon
            früher koordiniert werden können. Steht bewusst unter dem
            Projekt-Check (Bewertungsmodul), nicht mehr davor. */}
        <BlockHinweis
          slug={project.slug}
          blockKey="aufgaben"
          individuellerText={project.hinweise?.aufgaben ?? ""}
          standardText={STANDARD_HINWEISE.aufgaben}
          darfBearbeiten={darfHinweiseBearbeiten}
        />
        <TaskBoard slug={project.slug} groupId={project.bitrix24.groupId} />
      </section>

      <section id="ideen" className="mt-12 scroll-mt-6">
        <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="font-display text-xl font-semibold">Ideen</h2>
        </div>
        <BlockHinweis
          slug={project.slug}
          blockKey="ideen"
          individuellerText={project.hinweise?.ideen ?? ""}
          standardText={STANDARD_HINWEISE.ideen}
          darfBearbeiten={darfHinweiseBearbeiten}
        />
        <IdeenManager
          slug={project.slug}
          ideen={project.ideen ?? []}
          istKernteam={istKernteam(session, project)}
        />
      </section>
    </main>
  );
}
