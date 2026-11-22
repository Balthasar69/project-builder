import PasswortZuruecksetzenForm from "@/components/PasswortZuruecksetzenForm";
import Brand from "@/components/Brand";

export default function PasswortZuruecksetzenPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <div className="mb-10">
        <Brand />
      </div>
      <h1 className="mb-8 font-display text-3xl font-semibold text-ink">Neues Passwort wählen</h1>
      <PasswortZuruecksetzenForm token={searchParams.token ?? ""} />
    </main>
  );
}
