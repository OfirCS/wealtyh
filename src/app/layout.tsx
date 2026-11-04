import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pathfinder — A plan for what's next",
  description: "Free Canadian life-decision planner. Tell it what's changing, answer a few questions, and approve a plan built from your real numbers.",
  metadataBase: new URL("https://pathfinder.fyi"),
  openGraph: {
    title: "Pathfinder — A plan for what's next",
    description: "Baby? Home? Career break? Get a plan in a minute.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${newsreader.variable} ${instrument.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
