import "./globals.css";
import type { Metadata } from "next";
import AuthGate from "@/components/auth/AuthGate";

export const metadata: Metadata = {
  title: "MasterFleetBR",
  description: "Sistema de gestão MasterFleetBR",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}