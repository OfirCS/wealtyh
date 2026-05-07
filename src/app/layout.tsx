import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pathfinder — Plan any life change with AI",
  description: "Free Canadian life-decision planner. Enter your numbers and a life event — get an AI-generated plan with TFSA / RRSP / FHSA awareness, live data, and a shareable link.",
  metadataBase: new URL("https://pathfinder.fyi"),
  openGraph: {
    title: "Pathfinder — Plan any life change with AI",
    description: "Baby? Home? Career break? See the financial impact in 30 seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${newsreader.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
