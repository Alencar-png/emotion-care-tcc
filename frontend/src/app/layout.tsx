import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emotion Care — Gestão de Saúde Mental no Trabalho",
  description: "Plataforma SaaS B2B de gestão de saúde mental e riscos psicossociais (NR-01) no trabalho.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="font-poppins antialiased">{children}</body>
    </html>
  );
}
