"use client";

import { useSyncExternalStore } from "react";

/**
 * Reads the current theme from the DOM.
 *
 * The `.dark` class on <html> is the single source of truth: it is set by
 * the inline script in the root layout before first paint, and flipped by
 * the theme toggle. That makes it external state, so it is subscribed to
 * rather than mirrored into React state — mirroring needs a setState inside
 * an effect, which yields a cascading render and, for MapLibre, a basemap
 * swap in the middle of style loading.
 *
 * `getServerSnapshot` returns false so server-rendered markup assumes the
 * light theme; React reconciles after hydration without a mismatch.
 */

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Flips the theme and remembers the choice. */
export function toggleTheme(): void {
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("theme", next ? "dark" : "light");
  } catch {
    // Private mode or storage disabled: the choice just won't persist.
  }
}
