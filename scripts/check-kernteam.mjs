// Diagnose-Werkzeug: zeigt ganz genau, was aktuell in der Datenbank steht –
// für ein Projekt das Kernteam (mit E-Mail) und die Mitglieder-Liste, und
// dazu alle registrierten Zugänge (users-Tabelle) mit E-Mail und Admin-Status.
// Damit lässt sich prüfen, ob eine E-Mail-Adresse wirklich exakt
// übereinstimmt (z. B. auch bei unsichtbaren Leerzeichen oder Tippfehlern).
//
// Aufruf (im project-builder-Ordner, nach `vercel env pull .env.local`):
//   node scripts/check-kernteam.mjs <slug>
//
// Beispiel:
//   node scripts/check-kernteam.mjs be-happy-again

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const [, , slug] = process.argv;

function zeigeEmail(label, email) {
  const wert = email ?? "(nicht gesetzt)";
  console.log(`  ${label}: "${wert}"  (Länge: ${wert.length})`);
}

async function main() {
  if (!slug) {
    console.error("Aufruf: node scripts/check-kernteam.mjs <slug>");
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

  console.log(`\n=== Projekt "${slug}" ===`);
  console.log(`Aktuelle Phase: ${project.aktuellePhase}`);

  console.log("\nKernteam:");
  for (const m of project.kernteam) {
    console.log(`- ${m.name} (${m.rolle})`);
    zeigeEmail("E-Mail im Kernteam", m.email);
  }

  console.log("\nMitglieder (Zugriff aufs Projekt):");
  if (!project.mitglieder || project.mitglieder.length === 0) {
    console.log("  (keine)");
  } else {
    for (const email of project.mitglieder) {
      zeigeEmail("Mitglied", email);
    }
  }

  console.log("\n=== Registrierte Zugänge (users-Tabelle) ===");
  const users = await sql`SELECT email, name, is_admin FROM users ORDER BY email`;
  if (users.length === 0) {
    console.log("  (keine registrierten Zugänge gefunden)");
  } else {
    for (const u of users) {
      console.log(`- ${u.name}`);
      zeigeEmail("E-Mail im Zugang", u.email);
      console.log(`  Admin: ${u.is_admin ? "JA" : "nein"}`);
    }
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
