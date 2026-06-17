import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppHeadbar } from "@/components/app-headbar";
import { getRequestLocale } from "@/lib/i18n/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "UNHARMED AND DISARMING PEACE - Iscrizioni",
  description:
    "Iscrizioni per UNHARMED AND DISARMING PEACE - PACE DISARMATA E DISARMANTE, International Meeting for Peace, Assisi 25-26-27 ottobre 2026.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppHeadbar />
        {children}
      </body>
    </html>
  );
}
