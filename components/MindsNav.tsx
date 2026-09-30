import Link from "next/link";
import { BookOpen, LayoutGrid, Rocket, Sparkles } from "lucide-react";

const TABS = [
  { href: "/my-minds", label: "My Minds", icon: LayoutGrid },
  { href: "/studio", label: "Training Studio", icon: BookOpen },
  { href: "/skills", label: "Bazaar", icon: Sparkles },
  { href: "/launch", label: "Launch a Mind", icon: Rocket },
] as const;

/** Sub-navigation shared by every "my Minds" page, so the header stays short. */
export default function MindsNav({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="subnav">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={t.href === active ? "active" : ""}>
          <t.icon size={14} aria-hidden /> {t.label}
        </Link>
      ))}
    </nav>
  );
}
