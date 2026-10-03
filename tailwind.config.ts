import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        // Redesign (10/2026): Typografie der Entscheiderakademie-Website
        // übernommen (Poppins) – gilt jetzt global für alle Projekte,
        // ersetzt die vorherige IBM-Plex-Schrift.
        display: ['"Poppins"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Poppins"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // Redesign (10/2026): Farbwerte von entscheiderakademie.de
        // übernommen (vom echten Screenshot abgemessen) – reinweißer
        // Hintergrund statt Creme, Blau/Orange/Grün statt Blau/Rot/Grün.
        // Gilt global für alle Projekte in diesem Project Builder (nicht
        // nur Entscheiderakademie/Unternehmerakademie). Das insightworx-Logo
        // selbst (Brand.tsx) bleibt unverändert – nur die Farbwelt drumherum
        // wechselt.
        paper: "#ffffff",
        surface: "#ffffff",
        "surface-2": "#f5f5f7",
        ink: "#4a4951",
        "ink-muted": "#76747c",
        "ink-faint": "#a4a2a8",
        line: "#e4e3e7",
        // Akzentfarbe: Logo-Blau der Entscheiderakademie.
        accent: {
          DEFAULT: "#4a9de1",
          ink: "#2e6ca8",
          soft: "#e8f3fc",
        },
        // GO/STOPP-Bewertungen (Kapitel 11): unverändert, rein inhaltliche
        // Statusfarben, nicht Teil des Marken-Brandings.
        good: { DEFAULT: "#5b8f2a", soft: "#e8f3dc" },
        warn: { DEFAULT: "#a8791f", soft: "#f4e8cd" },
        bad: { DEFAULT: "#bd0604", soft: "#f7dcdb" },
        pending: { DEFAULT: "#8b8f7e", soft: "#ecebe1" },
        // Die drei Logo-Farben der Entscheiderakademie (Blau/Orange/Grün,
        // vom echten Screenshot abgemessen) – im Projektcockpit-Hub
        // verwendet: Orga=Blau, Dashboard=Orange, Dynamik=Grün. "red" hieß
        // früher so (insightworx-Logo war Blau/Rot/Grün); Schlüsselname der
        // Einfachheit halber beibehalten, Wert jetzt Orange.
        brand: {
          blue: "#4a9de1",
          red: "#ed7c30",
          "red-text": "#b35812",
          green: "#c0de72",
          "green-soft": "#f1f6e2",
        },
        // Entscheiderakademie-Partner-Badge (EakBadge.tsx): eigene, feste
        // Töne, unabhängig vom übrigen Farbschema oben.
        eak: {
          blue: "#4a9de1",
          orange: "#ed7c30",
          "orange-text": "#b35812",
          green: "#c0de72",
        },
        // Sidebar-Navigation (Sidebar.tsx): dunkles Marineblau wie im
        // Entscheiderakademie-Mockup, bewusst fest (nicht theme-abhängig).
        navbg: "#1b4f78",
      },
    },
  },
  plugins: [],
};

export default config;
