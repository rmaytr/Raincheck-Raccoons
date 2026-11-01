import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raincheck Raccoons — Little paws. Big plans.",
  description: "A free multiplayer rooftop heist for 2–10 friends. Pick a roof, plan your mischief, and bring home the snacks. No login. Just a room code.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://raincheck-raccoons.smoky-harp-3438.chatgpt.site")),
  openGraph: {
    title: "Raincheck Raccoons",
    description: "Outsmart the rain. And your friends. A free multiplayer party game.",
    images: [{ url: "/cover.png", width: 1600, height: 900 }],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
