// Einmalig ausführen (lokal, nach `vercel env pull .env.local`):
//   npm run db:init
// Legt die Tabelle an und spielt Be Happy Again als Startprojekt ein.

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error(
      "DATABASE_URL/POSTGRES_URL fehlt. Erst `vercel env pull .env.local` " +
        "ausführen (nachdem im Vercel-Dashboard eine Postgres-Datenbank " +
        "verbunden wurde)."
    );
    process.exit(1);
  }
  const sql = neon(url);

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      slug TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `;
  console.log('Tabelle "projects" ist vorhanden.');

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  console.log('Tabelle "users" ist vorhanden.');

  await sql`
    CREATE TABLE IF NOT EXISTS task_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL,
      task_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      text TEXT,
      audio_data_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS task_notes_task_idx ON task_notes (slug, task_id);
  `;
  // ALTER ... ADD COLUMN IF NOT EXISTS, damit ein erneutes Ausführen auf
  // einer bereits bestehenden Tabelle (v0.5) nichts kaputt macht und die
  // neue Spalte einfach ergänzt.
  await sql`
    ALTER TABLE task_notes ADD COLUMN IF NOT EXISTS transcript TEXT;
  `;
  console.log('Tabelle "task_notes" ist vorhanden.');

  const seedPath = fileURLToPath(new URL("../src/data/seed.json", import.meta.url));
  const seed = JSON.parse(readFileSync(seedPath, "utf-8"));

  for (const [slug, project] of Object.entries(seed)) {
    await sql`
      INSERT INTO projects (slug, data)
      VALUES (${slug}, ${JSON.stringify(project)}::jsonb)
      ON CONFLICT (slug) DO NOTHING;
    `;
    console.log(`Projekt "${slug}" eingespielt (falls noch nicht vorhanden).`);
  }

  // Ältere Projekt-Zeilen (vor v0.3) kennen "mitglieder" noch nicht – idempotent
  // nachtragen, ohne bereits vorhandene Werte anzufassen.
  await sql`
    UPDATE projects
    SET data = jsonb_set(data, '{mitglieder}', '[]'::jsonb)
    WHERE NOT (data ? 'mitglieder');
  `;
  console.log('Fehlendes "mitglieder"-Feld bei bestehenden Projekten ergänzt (falls nötig).');

  console.log("Fertig.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
