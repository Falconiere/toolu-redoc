/** Persist and apply the Signal band (dark default / light via `.band-light` on `<html>`). */

/** localStorage key for the preferred band. */
export const BAND_THEME_STORAGE_KEY = "toolu-redoc.band";

/** Dark is `:root`; light is `.band-light` on the document element. */
export type BandTheme = "dark" | "light";

/** Read a stored band preference; invalid or missing → dark. */
export function readStoredBandTheme(): BandTheme {
  try {
    return globalThis.localStorage.getItem(BAND_THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Persist the band preference (best-effort; private mode may throw). */
export function writeStoredBandTheme(theme: BandTheme): void {
  try {
    globalThis.localStorage.setItem(BAND_THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore quota / private-mode / missing-storage failures.
  }
}

/** Toggle `.band-light` on `<html>` so every band inherits the tone map. */
export function applyBandTheme(theme: BandTheme): void {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("band-light");
  } else {
    root.classList.remove("band-light");
  }
}

/** Flip dark ↔ light and return the next value. */
export function nextBandTheme(theme: BandTheme): BandTheme {
  return theme === "dark" ? "light" : "dark";
}
