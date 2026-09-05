import RegisterForm from "@/components/RegisterForm";
import Brand from "@/components/Brand";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <div className="mb-10">
        <Brand />
      </div>
      <h1 className="mb-3 font-display text-3xl font-semibold text-ink">
        Konto anlegen
      </h1>
      <p className="mb-8 text-sm text-ink-muted">
        Eigenes Konto statt gemeinsamem Passwort — Projekte werden nur an
        eingetragene Mitglieder freigegeben.
      </p>
      <RegisterForm />
    </main>
  );
}
