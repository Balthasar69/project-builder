import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Builder",
  description: "Ideen-, Beteiligungs- und Entwicklungsraum für neue Projekte.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Redesign (10/2026): Poppins statt IBM Plex Sans, passend zur
            Entscheiderakademie-Typografie – gilt global für alle Projekte. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
