// Einmal-Werkzeug: hinterlegt die E-Mail-Adresse einer Person im Kernteam
// eines Projekts. Nötig, damit die App erkennt, wer zum Kernteam gehört
// (z. B. für den Knopf „Nächste Phase" – nur Kernteam/Admins dürfen das).
//
// Aufruf (im project-builder-Ordner, nach `vercel env pull .env.local`):
//   node scripts/set-kernteam-email.mjs <slug> "<Name im Kernteam>" <email>
//
// Beispiel:
//   node scripts/set-kernteam-email.mjs be-happy-again "Balthasar Fleischmann" juergen@roebersdorf.de

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const [, , slug, name, email] = process.argv;

async function main() {
  if (!slug || !name || !email) {
    console.error(
      'Aufruf: node scripts/set-kernteam-email.mjs <slug> "<Name>" <email>'
    );
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

  const vorher = mitglied.email ?? "(nicht gesetzt)";
  mitglied.email = email.trim().toLowerCase();
  project.aktualisiertAm = new Date().toISOString();

  await sql`
    UPDATE projects
    SET data = ${JSON.stringify(project)}::jsonb
    WHERE slug = ${slug}
  `;

  console.log(
    `"${slug}": E-Mail von "${name}" geändert von ${vorher} auf ${mitglied.email}.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
