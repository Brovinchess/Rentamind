import type { Metadata } from "next";
import { Manrope, Space_Mono } from "next/font/google";
import Link from "next/link";
import { Brain } from "lucide-react";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });

export const metadata: Metadata = {
  title: "Rent a Mind",
  description:
    "Rent trained Minds from their stewards. Built on HelloMinds by Animoca Brands — demo concept.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${spaceMono.variable}`}>
        <header className="site-header">
          <div className="container inner">
            <Link href="/" className="wordmark">
              <Brain size={21} strokeWidth={2.4} className="wordmark-icon" aria-hidden />
              Rent a Mind <span className="beta">DEMO</span>
            </Link>
            <nav className="nav">
              <Link href="/">Marketplace</Link>
              <Link href="/dashboard">Steward Dashboard</Link>
              <Link href="/points">Synapses</Link>
            </nav>
            <Link href="/launch" className="header-cta">
              Launch a Mind
            </Link>
          </div>
        </header>
        {children}
        <footer className="footer">
          <div className="container">
            Rent a Mind — concept demo by Rovin, built on{" "}
            <a href="https://hellominds.ai" style={{ textDecoration: "underline" }}>
              HelloMinds
            </a>{" "}
            by Animoca Brands. Not an official HelloMinds product. Persona Minds are simulations —
            parody, not affiliation. Nothing here is financial or medical advice.
          </div>
        </footer>
      </body>
    </html>
  );
}
