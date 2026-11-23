// When: 2026-11-23 | By: claude-sonnet-4-6 | What: root layout with metadata
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BirdNET Soundboard",
  description: "Latest bird detections from BirdNET-Go with playback",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 antialiased">{children}</body>
    </html>
  );
}
