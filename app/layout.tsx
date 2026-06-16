import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppHeadbar } from "@/components/app-headbar";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Iscrizioni Pace",
  description:
    "Piattaforma per iscrizioni, gruppi e accoglienza degli eventi internazionali della Comunità di Sant'Egidio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppHeadbar />
        {children}
      </body>
    </html>
  );
}
