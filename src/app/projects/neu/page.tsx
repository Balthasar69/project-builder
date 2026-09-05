import NewProjectForm from "@/components/NewProjectForm";
import Brand from "@/components/Brand";

export default function NewProjectPage() {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <div className="mb-10">
        <Brand />
      </div>
      <h1 className="mb-3 font-display text-3xl font-semibold text-ink">
        Neues Projekt
      </h1>
      <p className="mb-8 text-sm text-ink-muted">
        Du wirst automatisch Projektleitung und einziges Mitglied. Weitere
        Personen kannst du danach im Projekt per E-Mail-Adresse hinzufügen.
      </p>
      <NewProjectForm />
    </main>
  );
}
