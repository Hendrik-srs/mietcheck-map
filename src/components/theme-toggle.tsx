"use client";

import { Moon, Sun } from "lucide-react";

import { toggleTheme, useIsDarkTheme } from "@/lib/use-theme";

/**
 * Light/dark switch.
 *
 * The class itself is applied before paint by the inline script in the root
 * layout; this only reflects and flips it.
 */
export function ThemeToggle() {
  const isDark = useIsDarkTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln"}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
