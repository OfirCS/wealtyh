import type { Metadata, Viewport } from "next";
import { Courier_Prime, Figtree, Newsreader } from "next/font/google";
import HostBadge from "@/client/HostBadge";
import RegisterWorker from "@/client/RegisterWorker";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Only the paper receipts on the landing page use this
const courierPrime = Courier_Prime({
  variable: "--font-receipt",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Pathfinder — The family budget that builds itself",
  description: "Set up once and Pathfinder reads your Gmail, bank and Apple Wallet, builds your family budget, and shows you what's about to charge you again. Made for Canadian families.",
  metadataBase: new URL("https://pathfinder-family.netlify.app"),
  applicationName: "Pathfinder",
  appleWebApp: { capable: true, title: "Pathfinder", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
  openGraph: {
    title: "Pathfinder — The family budget that builds itself",
    description: "Sign in once. One click a day keeps it current.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F4F0",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${newsreader.variable} ${figtree.variable} ${courierPrime.variable} antialiased`}>
        {children}
        <RegisterWorker />
        <HostBadge />
      </body>
    </html>
  );
}
