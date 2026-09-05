// Einmal-Werkzeug: korrigiert die Bitrix24-Nutzer-Nummer einer Person im
// Kernteam eines Projekts (falls beim Ersteinrichten ein falscher Wert
// eingetragen wurde – die App weist Aufgaben sonst dem falschen Bitrix24-
// Nutzer zu, was Bitrix24 als Rechte-Fehler meldet).
//
// Aufruf (im project-builder-Ordner, nach `vercel env pull .env.local`):
//   node scripts/set-kernteam-bitrix-id.mjs <slug> "<Name im Kernteam>" <bitrix24-nutzer-nummer>
//
// Beispiel:
//   node scripts/set-kernteam-bitrix-id.mjs be-happy-again "Balthasar Fleischmann" 2

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const [, , slug, name, idStr] = process.argv;

async function main() {
  if (!slug || !name || !idStr) {
    console.error(
      'Aufruf: node scripts/set-kernteam-bitrix-id.mjs <slug> "<Name>" <bitrix24-nutzer-nummer>'
    );
    process.exit(1);
  }
  const neueId = Number(idStr);
  if (!Number.isInteger(neueId) || neueId <= 0) {
    console.error(`Ungültige Nutzer-Nummer: "${idStr}" (muss eine positive Zahl sein).`);
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
  const mitglied = project.kernteam.find((m) => m.name === name);
  if (!mitglied) {
    console.error(
      `Im Kernteam von "${slug}" gibt es niemanden mit dem Namen "${name}". ` +
        `Vorhanden: ${project.kernteam.map((m) => m.name).join(", ")}`
    );
    process.exit(1);
  }

  const vorher = mitglied.bitrix24UserId ?? "(nicht gesetzt)";
  mitglied.bitrix24UserId = neueId;
  project.aktualisiertAm = new Date().toISOString();

  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;

  console.log(
    `"${slug}": Bitrix24-Nutzer-Nummer von "${name}" geändert von ${vorher} auf ${neueId}.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
