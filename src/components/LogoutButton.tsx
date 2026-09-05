"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="font-mono text-xs uppercase tracking-wide text-ink-faint transition hover:text-ink"
    >
      Abmelden
    </button>
  );
}
