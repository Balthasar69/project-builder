import PasswortVergessenForm from "@/components/PasswortVergessenForm";
import Brand from "@/components/Brand";

export default function PasswortVergessenPage() {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <div className="mb-10">
        <Brand />
      </div>
      <h1 className="mb-3 font-display text-3xl font-semibold text-ink">Passwort vergessen</h1>
      <p className="mb-8 text-sm text-ink-muted">
        Gib die E-Mail-Adresse deines Kontos ein. Du bekommst einen Link, über den du selbst ein
        neues Passwort wählst. Dein Konto und deine Projekte bleiben unverändert.
      </p>
      <PasswortVergessenForm />
    </main>
  );
}
