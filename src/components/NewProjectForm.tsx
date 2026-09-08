"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Project } from "@/lib/types";
import Diktierknopf from "./Diktierknopf";

export default function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, beschreibung }),
      });
      const data = (await res.json()) as { project?: Project; error?: string };
      if (!res.ok || !data.project) {
        throw new Error(data.error ?? "Anlegen fehlgeschlagen");
      }
      router.push(`/projects/${data.project.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Projektname</span>
        <div className="relative">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Be Happy Again"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <Diktierknopf
            onText={(erkannt) =>
              setName((bisher) => (bisher ? `${bisher} ${erkannt}` : erkannt))
            }
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
          />
        </div>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">
          Projektbeschreibung <span className="text-ink-faint">(optional)</span>
        </span>
        <div className="relative">
          <textarea
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            rows={3}
            placeholder="Worum geht es? Für alle Teammitglieder sichtbar."
            className="w-full rounded-md border border-line bg-surface px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <Diktierknopf
            onText={(erkannt) =>
              setBeschreibung((bisher) => (bisher ? `${bisher} ${erkannt}` : erkannt))
            }
            className="absolute right-1.5 top-1.5"
          />
        </div>
      </label>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Legt an…" : "Projekt anlegen"}
      </button>
    </form>
  );
}
