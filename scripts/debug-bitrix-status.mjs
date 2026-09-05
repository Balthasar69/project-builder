// Diagnose-Werkzeug: vergleicht für die Aufgaben einer Bitrix24-Arbeitsgruppe
// den Status aus der ÄLTEREN, aktuell von der App verwendeten Schnittstelle
// ("task.item.list") mit dem Status aus der NEUEREN Schnittstelle
// ("tasks.task.list") – damit lässt sich prüfen, ob beide dasselbe sagen,
// oder ob die ältere Schnittstelle bei manchen Aufgaben einen anderen
// (veralteten) Status liefert als das, was man im Bitrix24-Kanban-Board
// tatsächlich sieht.
//
// Ändert nichts an Bitrix24 – reine Anzeige/Diagnose.
//
// Aufruf (im project-builder-Ordner, nach `vercel env pull .env.local`):
//   node scripts/debug-bitrix-status.mjs <GROUP_ID>
//
// Die GROUP_ID der Arbeitsgruppe steht in der Bitrix24-URL, wenn man die
// Arbeitsgruppe/das Projekt in Bitrix24 öffnet, z. B.
// .../workgroups/group/12/ → GROUP_ID ist 12.

import { config } from "dotenv";
config({ path: ".env.local" });

const [, , groupIdArg] = process.argv;

async function main() {
  if (!groupIdArg) {
    console.error("Aufruf: node scripts/debug-bitrix-status.mjs <GROUP_ID>");
    process.exit(1);
  }
  const groupId = Number(groupIdArg);

  const webhook = process.env.BITRIX24_WEBHOOK_URL;
  if (!webhook) {
    console.error("BITRIX24_WEBHOOK_URL fehlt. Erst `vercel env pull .env.local` ausführen.");
    process.exit(1);
  }
  const base = webhook.endsWith("/") ? webhook : webhook + "/";

  async function call(method, params) {
    const res = await fetch(`${base}${method}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.error) {
      return { fehler: `${data.error}: ${data.error_description ?? ""}` };
    }
    return { ergebnis: data.result };
  }

  console.log(`\n=== Ältere Schnittstelle: task.item.list (GROUP_ID ${groupId}) ===`);
  const alt = await call("task.item.list", {
    order: { ID: "desc" },
    filter: { GROUP_ID: groupId },
    params: {},
  });
  const alteAufgaben = new Map();
  if (alt.fehler) {
    console.log("Fehler:", alt.fehler);
  } else {
    for (const t of alt.ergebnis ?? []) {
      alteAufgaben.set(String(t.ID), { titel: t.TITLE, status: String(t.STATUS) });
      console.log(`  [${t.ID}] Status ${t.STATUS} – ${t.TITLE}`);
    }
  }

  console.log(`\n=== Neuere Schnittstelle: tasks.task.list (GROUP_ID ${groupId}) ===`);
  const neu = await call("tasks.task.list", {
    filter: { GROUP_ID: groupId },
    select: ["ID", "TITLE", "STATUS", "STAGE_ID"],
  });
  const neueAufgaben = new Map();
  if (neu.fehler) {
    console.log("Fehler (diese Methode ist evtl. für den Webhook gesperrt):", neu.fehler);
  } else {
    const liste = neu.ergebnis?.tasks ?? neu.ergebnis ?? [];
    for (const t of liste) {
      neueAufgaben.set(String(t.id ?? t.ID), {
        titel: t.title ?? t.TITLE,
        status: String(t.status ?? t.STATUS),
        stageId: t.stageId ?? t.STAGE_ID,
      });
      console.log(
        `  [${t.id ?? t.ID}] Status ${t.status ?? t.STATUS}  Stage ${
          t.stageId ?? t.STAGE_ID ?? "-"
        } – ${t.title ?? t.TITLE}`
      );
    }
  }

  console.log(`\n=== Stage-Namen (Kanban-Spalten) der Arbeitsgruppe ${groupId} ===`);
  for (const versuch of [
    { methode: "task.stages.get", params: { entityid: groupId } },
    { methode: "task.stages.get", params: { entityid: String(groupId) } },
    { methode: "task.stages.get", params: { ENTITY_ID: groupId, entityid: groupId } },
  ]) {
    const ergebnis = await call(versuch.methode, versuch.params);
    console.log(`\n-- Versuch: ${versuch.methode}(${JSON.stringify(versuch.params)}) --`);
    if (ergebnis.fehler) {
      console.log("Fehler:", ergebnis.fehler);
    } else {
      console.log(JSON.stringify(ergebnis.ergebnis, null, 2));
    }
  }

  if (!alt.fehler && !neu.fehler) {
    console.log("\n=== Vergleich (nur Aufgaben mit Unterschied) ===");
    let unterschiede = 0;
    for (const [id, a] of alteAufgaben) {
      const n = neueAufgaben.get(id);
      if (n && n.status !== a.status) {
        unterschiede++;
        console.log(
          `  [${id}] "${a.titel}": alt=${a.status}  neu=${n.status}  stage=${n.stageId ?? "-"}`
        );
      }
    }
    if (unterschiede === 0) {
      console.log("  Keine Unterschiede gefunden – beide Schnittstellen liefern denselben Status.");
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
