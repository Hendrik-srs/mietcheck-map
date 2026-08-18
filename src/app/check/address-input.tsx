"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, Milestone } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { AddressSuggestion } from "@/app/api/adress-vorschlaege/route";

/**
 * Address field with type-ahead.
 *
 * Typing a full address by hand is the most error-prone step of the check:
 * the placeholder that shows the expected format disappears on the first
 * keystroke, and a single typo makes the geocoder return nothing. Picking
 * from a list removes both problems — and the chosen entry already carries
 * its coordinates, so the server can skip the geocoding round-trip.
 *
 * Implements the combobox pattern: arrows move, Enter selects, Escape
 * closes, and the active option is announced via aria-activedescendant.
 */

const DEBOUNCE_MS = 220;
/** Below this, a query matches half the city. */
const TYPE_AHEAD_MIN = 3;

export function AddressInput({
  defaultValue,
  invalid,
}: {
  defaultValue: string;
  invalid?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** Coordinates of the picked suggestion, submitted as hidden fields. */
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);

  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  /** Set right after a pick so the effect doesn't immediately re-query. */
  const skipNextQuery = useRef(false);

  useEffect(() => {
    if (skipNextQuery.current) {
      skipNextQuery.current = false;
      return;
    }
    const query = value.trim();
    // Nothing to fetch yet. Stale suggestions stay in state but are filtered
    // out at render time — clearing them here would mean a setState in the
    // effect body, which cascades an extra render on every keystroke.
    if (query.length < TYPE_AHEAD_MIN) return;

    const controller = new AbortController();
    // The spinner is raised inside the timer, not before it: showing it on
    // every keystroke would flicker through the debounce window, and it also
    // keeps setState out of the effect body.
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/adress-vorschlaege?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as { suggestions: AddressSuggestion[] };
        setSuggestions(body.suggestions ?? []);
        setActiveIndex(-1);
        setOpen(true);
      } catch {
        // Aborted or offline — the field still works as a plain text input.
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  // Close when focus or a click leaves the field entirely.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  const choose = (suggestion: AddressSuggestion) => {
    if (suggestion.kind === "street") {
      // Picking a street is a step, not an answer: fill in the name, add a
      // trailing space and keep the field open so the house number follows
      // naturally and the next query is the complete address.
      setValue(`${suggestion.label} `);
      setPicked(null);
      setActiveIndex(-1);
      inputRef.current?.focus();
      return;
    }

    skipNextQuery.current = true;
    setValue(suggestion.label);
    setPicked(
      suggestion.lat != null && suggestion.lon != null
        ? { lat: suggestion.lat, lon: suggestion.lon }
        : null,
    );
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (event.key === "ArrowDown" && suggestions.length > 0) setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      // Only swallow Enter when a suggestion is highlighted, so the form
      // can still be submitted from the field otherwise.
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const longEnough = value.trim().length >= TYPE_AHEAD_MIN;
  const showList = open && longEnough && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          id="address"
          name="address"
          required
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          placeholder="Sonnenallee 100, 12045 Berlin"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            // Typing invalidates a previous pick — the text no longer
            // necessarily matches those coordinates.
            setPicked(null);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          aria-invalid={invalid || undefined}
          className="pr-9"
        />
        {loading && longEnough && (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>

      {/* Coordinates travel with the form so the server can skip geocoding. */}
      {picked && (
        <>
          <input type="hidden" name="lat" value={picked.lat} />
          <input type="hidden" name="lon" value={picked.lon} />
        </>
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Adressvorschläge"
          className="absolute top-[calc(100%+0.35rem)] right-0 left-0 z-20 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.label}-${index}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // onMouseDown, not onClick: mousedown fires before the input
              // loses focus, so the list is still open when we read it.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(suggestion);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                index === activeIndex ? "bg-accent" : ""
              }`}
            >
              {suggestion.kind === "address" ? (
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Milestone className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{suggestion.label}</span>
                {suggestion.context && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {suggestion.context}
                  </span>
                )}
              </span>
              {suggestion.kind === "street" && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  Hausnr. ergänzen
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
