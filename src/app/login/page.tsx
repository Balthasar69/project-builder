import LoginForm from "@/components/LoginForm";
import Brand from "@/components/Brand";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <div className="mb-10">
        <Brand />
      </div>
      <h1 className="mb-8 font-display text-3xl font-semibold text-ink">
        Anmelden
      </h1>
      <LoginForm from={searchParams.from} />
    </main>
  );
}
