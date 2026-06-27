import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KPI Tracker | AB Business Support Services",
  description: "Team performance tracking dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
