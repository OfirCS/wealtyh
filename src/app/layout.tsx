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
  title: "Pathfinder — The family budget that builds itself",
  description: "Sign in once and your agent reads your receipts, builds your family budget, and tells you what to do next. Made for Canadian families.",
  metadataBase: new URL("https://pathfinder.fyi"),
  openGraph: {
    title: "Pathfinder — The family budget that builds itself",
    description: "Sign in once. Your agent does the rest.",
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
