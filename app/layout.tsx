import type { Metadata } from "next";
import { Manrope, Space_Mono } from "next/font/google";
import Link from "next/link";
import { Brain } from "lucide-react";
import MindAvatar from "@/components/MindAvatar";
import { getSessionEmail } from "@/lib/auth";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });

export const metadata: Metadata = {
  title: "Rent a Mind",
  description:
    "Train Minds into personas, rent them out, farm rewards. Built on HelloMinds by Animoca Brands — demo concept.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const email = await getSessionEmail();
  const signedIn = !!email;

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
              <Link href="/marketplace">Marketplace</Link>
              {signedIn ? <Link href="/my-minds">My Minds</Link> : null}
              {signedIn ? <Link href="/studio">Training Studio</Link> : null}
              <Link href="/rewards">Rewards</Link>
            </nav>
            {signedIn ? (
              <Link href="/launch" className="header-cta">
                Launch a Mind
              </Link>
            ) : (
              <Link href="/login" className="header-cta">
                Get started
              </Link>
            )}
            {email ? (
              <Link href="/profile" className="header-profile" title="Profile" aria-label="Profile">
                <MindAvatar seed={email} size={34} radius={17} />
              </Link>
            ) : (
              <Link href="/login" className="nav" style={{ color: "#c3cdea", fontWeight: 700, fontSize: "0.9rem" }}>
                Sign in
              </Link>
            )}
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
