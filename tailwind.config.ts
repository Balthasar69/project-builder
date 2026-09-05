import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        // CD-Branding (KULTO insightworx – O&K): durchgängig klare,
        // serifenlose Schrift statt der vorherigen Zierschrift "Fraunces"
        // für Überschriften – passend zum schlichten Logo-Schriftbild.
        display: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        paper: "#f6f3ec",
        surface: "#fffdf8",
        "surface-2": "#efe9dc",
        ink: "#23281f",
        "ink-muted": "#656b5b",
        "ink-faint": "#9a9d8d",
        line: "#ddd6c4",
        // CD-Branding: Akzentfarbe aus dem Logo übernommen (Blau, wie im
        // äußeren Ring und im Schriftzug "O&K").
        accent: {
          DEFAULT: "#0e6eb3",
          ink: "#0a4f80",
          soft: "#dceef8",
        },
        // GO/STOPP-Bewertungen (Kapitel 11) passen inhaltlich ohnehin schon
        // zu Grün/Rot – deshalb hier direkt die Logo-Farben verwendet.
        good: { DEFAULT: "#5b8f2a", soft: "#e8f3dc" },
        warn: { DEFAULT: "#a8791f", soft: "#f4e8cd" },
        bad: { DEFAULT: "#bd0604", soft: "#f7dcdb" },
        pending: { DEFAULT: "#8b8f7e", soft: "#ecebe1" },
      },
    },
  },
  plugins: [],
};

export default config;
