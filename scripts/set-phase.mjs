// Einmal-Werkzeug: setzt die Phase eines Projekts von Hand (die App selbst
// bietet dafür noch keine Oberfläche). Nützlich zum Testen, oder um eine
// Phase zurückzusetzen.
//
// Aufruf (im project-builder-Ordner, nach `vercel env pull .env.local`):
//   node scripts/set-phase.mjs <slug> <phase-code>
//
// Beispiel:
//   node scripts/set-phase.mjs be-happy-again kerngruppe
//
// Gültige Phasen-Codes: idee, check, kompetenzen, konzept, kerngruppe,
// freigabe, produkt, business, pilot, marketing, vertrieb, umsatz,
// optimierung, skalierung, parken

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const [, , slug, phase] = process.argv;

const GUELTIGE_PHASEN = [
  "idee", "check", "kompetenzen", "konzept", "kerngruppe", "freigabe",
  "produkt", "business", "pilot", "marketing", "vertrieb", "umsatz",
  "optimierung", "skalierung", "parken",
];

async function main() {
  if (!slug || !phase) {
    console.error("Aufruf: node scripts/set-phase.mjs <slug> <phase-code>");
    console.error(`Gültige Phasen: ${GUELTIGE_PHASEN.join(", ")}`);
    process.exit(1);
  }
  if (!GUELTIGE_PHASEN.includes(phase)) {
    console.error(`Unbekannte Phase "${phase}". Gültig sind: ${GUELTIGE_PHASEN.join(", ")}`);
    process.exit(1);
  }

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error("DATABASE_URL/POSTGRES_URL fehlt. Erst `vercel env pull .env.local` ausführen.");
    process.exit(1);
  }
  const sql = neon(url);

  const rows = await sql`SELECT data FROM projects WHERE slug = ${slug}`;
  if (rows.length === 0) {
    console.error(`Projekt "${slug}" nicht gefunden.`);
    process.exit(1);
  }

  const project = rows[0].data;
  const vorher = project.aktuellePhase;
  project.aktuellePhase = phase;
  project.aktualisiertAm = new Date().toISOString();

  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;

  console.log(`"${slug}": Phase geändert von "${vorher}" auf "${phase}".`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
