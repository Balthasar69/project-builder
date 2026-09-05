import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllProjects } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { berechneReifegrad } from "@/lib/scoring";
import { PHASES } from "@/lib/types";
import LogoutButton from "@/components/LogoutButton";
import Brand from "@/components/Brand";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  // Zweite Absicherung neben middleware.ts: falls die Middleware aus
  // irgendeinem Grund nicht greift, leitet die Seite selbst weiter, statt
  // leer zu bleiben.
  if (!session) redirect("/login");

  const alleProjekte = await getAllProjects();
  const projects = session.isAdmin
    ? alleProjekte
    : alleProjekte.filter((p) => p.mitglieder.includes(session.email));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10 flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink-muted">{session.name}</span>
          <LogoutButton />
        </div>
      </div>

      <div className="mb-10 flex items-start justify-between gap-6">
        <div>
          <h1 className="mb-3 font-display text-4xl font-semibold text-ink">
            Projekte
          </h1>
          <p className="max-w-[60ch] text-ink-muted">
            Ideen-, Beteiligungs- und Entwicklungsraum. Sobald ein Projekt die
            Projektfreigabe erreicht, übernimmt Bitrix24 die operative
            Steuerung.
          </p>
        </div>
        <Link
          href="/projects/neu"
          className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink"
        >
          + Neues Projekt
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-5 py-8 text-center text-sm text-ink-muted">
          Noch keine Projekte, die dir zugeordnet sind. Leg eines an, oder
          bitte darum, als Mitglied hinzugefügt zu werden.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((project) => {
            const phase = PHASES.find((p) => p.code === project.aktuellePhase);
            const reifegrad = berechneReifegrad(project.bereichStatus);
            return (
              <Link
                key={project.slug}
                href={`/projects/${project.slug}`}
                className="flex items-center justify-between rounded-lg border border-line bg-surface px-5 py-4 transition hover:border-accent/50 hover:shadow-sm"
              >
                <div>
                  <div className="font-display text-lg font-semibold">
                    {project.name}
                  </div>
                  <div className="text-sm text-ink-muted">
                    {project.rolleImSystem}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-wide text-ink-faint">
                      Phase
                    </div>
                    <div className="text-sm font-medium">
                      {phase?.order}. {phase?.name}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-xs uppercase tracking-wide text-ink-faint">
                      Reifegrad
                    </div>
                    <div className="tabular text-sm font-medium">
                      {reifegrad}%
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
