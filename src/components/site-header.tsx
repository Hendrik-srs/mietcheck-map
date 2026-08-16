import Link from "next/link";
import { Map } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

interface SiteHeaderProps {
  /**
   * Tighter container width for content-driven pages (`/check`, `/quellen`).
   * The map uses the wider 6xl container.
   */
  width?: "3xl" | "6xl";
  /** Hide the v0.1 development badge — used on content pages where it adds noise. */
  showBadge?: boolean;
}

const NAV_LINKS = [
  { href: "/karte", label: "Karte", short: "Karte" },
  { href: "/check", label: "Fairness-Check", short: "Check" },
  { href: "/quellen", label: "Quellen", short: "Quellen" },
];

export function SiteHeader({ width = "6xl", showBadge = false }: SiteHeaderProps) {
  const container =
    width === "3xl" ? "max-w-3xl" : "max-w-6xl";

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
      <div
        className={`mx-auto ${container} px-4 sm:px-6 h-14 flex items-center justify-between gap-3`}
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold whitespace-nowrap"
        >
          <Map className="size-5 text-primary shrink-0" />
          MietCheck<span className="hidden sm:inline"> Map</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          {NAV_LINKS.map(({ href, label, short }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </Link>
          ))}
          {showBadge && (
            <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
              in Entwicklung · v0.1
            </Badge>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
