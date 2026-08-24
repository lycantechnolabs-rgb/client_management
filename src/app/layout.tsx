import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AELA — Cardamom Estate Management in Idukki",
    template: "%s · AELA",
  },
  description:
    "We run cardamom estates for growers across the Idukki hills, and show you every day's work on your phone — every fertilizer round, every harvest, every rupee.",
  keywords: [
    "cardamom estate management",
    "elakkathottam",
    "Idukki cardamom",
    "cardamom farm management Kerala",
    "Vandanmedu",
    "Alleppey Green Extra Bold",
  ],
  openGraph: {
    title: "AELA — Cardamom Estate Management in Idukki",
    description:
      "Cardamom estates managed in the open. Every visit photographed, costed and logged — visible to the owner the same day.",
    type: "website",
    siteName: "AELA",
  },
};

export const viewport: Viewport = {
  themeColor: "#2e4a1c",
  width: "device-width",
  initialScale: 1,
  // Never block zoom — the growers using this portal are not all young.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
