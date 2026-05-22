import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "42 FightRank",
  description: "Classement des etudiants 42 par campus et annee de piscine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
