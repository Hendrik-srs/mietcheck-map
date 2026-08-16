/**
 * Shared choropleth scale for rent medians.
 *
 * The interactive map (MapLibre) consumes RENT_STOPS directly inside a
 * paint expression; the server-rendered landing heatmap has no MapLibre,
 * so it needs the same interpolation in plain TypeScript. Keeping both in
 * one module is what guarantees the two maps can't drift apart visually.
 *
 * Sequential YlOrRd-style ramp: yellow (cheap) -> dark red (expensive).
 * Stops cover the 2025 Berlin range (11.56 - 20.00 €/m² Nettokaltmiete).
 */
export const RENT_STOPS: Array<[number, string]> = [
  [11, "#fff7bc"],
  [13, "#fee391"],
  [15, "#fec44f"],
  [17, "#fb923c"],
  [19, "#dc2626"],
  [21, "#7f1d1d"],
];

/** Fill for districts without any rent observation yet. */
export const RENT_NO_DATA_COLOR = "#cbd5e1";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b))
    .toString(16)
    .slice(1)}`;
}

/**
 * Linearly interpolates RENT_STOPS — the same behaviour as MapLibre's
 * ["interpolate", ["linear"], ...] expression, so both maps agree.
 * Values outside the stop range clamp to the first/last colour.
 */
export function rentToColor(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return RENT_NO_DATA_COLOR;

  const first = RENT_STOPS[0];
  const last = RENT_STOPS[RENT_STOPS.length - 1];
  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];

  for (let i = 0; i < RENT_STOPS.length - 1; i++) {
    const [lowValue, lowColor] = RENT_STOPS[i];
    const [highValue, highColor] = RENT_STOPS[i + 1];
    if (value <= highValue) {
      const t = (value - lowValue) / (highValue - lowValue);
      const a = hexToRgb(lowColor);
      const b = hexToRgb(highColor);
      return rgbToHex([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ]);
    }
  }
  return last[1];
}

/** CSS gradient string for legends, derived from the same stops. */
export function rentGradientCss(): string {
  const min = RENT_STOPS[0][0];
  const max = RENT_STOPS[RENT_STOPS.length - 1][0];
  const parts = RENT_STOPS.map(
    ([value, color]) => `${color} ${Math.round(((value - min) / (max - min)) * 100)}%`,
  );
  return `linear-gradient(to right, ${parts.join(", ")})`;
}
