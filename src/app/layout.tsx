import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import {
  Chakra_Petch,
  Inter,
  JetBrains_Mono,
  Orbitron,
  Rajdhani,
} from "next/font/google";
import "./globals.css";

// Display / headline — condensed, official-signage register (DESIGN.md §3)
const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Title / label — blockier stencil, echoes the physical card lettering
const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

// Body — legibility workhorse (variable font)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Data — recorded figures only: ledgers, stats, logs (variable font)
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

// Registry terminal only — the rest of the interface keeps the core type split.
const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: "variable",
});

export const metadata: Metadata = {
  title: {
    default: "Galvanism",
    template: "%s · Galvanism",
  },
  description:
    "Frontier Custodian Brigade command interface. Regiment Foxtrot operations, personnel, and facilities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${rajdhani.variable} ${chakraPetch.variable} ${inter.variable} ${jetBrainsMono.variable} ${orbitron.variable} h-full`}
      >
        <body className="min-h-full">{children}</body>
      </html>
    </ClerkProvider>
  );
}
