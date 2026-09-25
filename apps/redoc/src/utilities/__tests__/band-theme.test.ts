/** Unit tests for band theme helpers (storage + html class). */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BAND_THEME_STORAGE_KEY,
  applyBandTheme,
  nextBandTheme,
  readStoredBandTheme,
  writeStoredBandTheme,
} from "@/utilities/band-theme";

/** In-memory Storage stand-in when Vitest has no localStorage. */
function installMemoryStorage(): void {
  const map = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return map.size;
    },
    clear: () => {
      map.clear();
    },
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
  vi.stubGlobal("localStorage", memory);
}

afterEach(() => {
  document.documentElement.classList.remove("band-light");
  vi.unstubAllGlobals();
});

describe("band-theme", () => {
  it("defaults to dark and applies band-light only for light", () => {
    installMemoryStorage();
    expect(readStoredBandTheme()).toBe("dark");
    applyBandTheme("light");
    expect(document.documentElement.classList.contains("band-light")).toBe(true);
    applyBandTheme("dark");
    expect(document.documentElement.classList.contains("band-light")).toBe(false);
  });

  it("persists light preference and flips with nextBandTheme", () => {
    installMemoryStorage();
    writeStoredBandTheme("light");
    expect(readStoredBandTheme()).toBe("light");
    expect(localStorage.getItem(BAND_THEME_STORAGE_KEY)).toBe("light");
    expect(nextBandTheme("dark")).toBe("light");
    expect(nextBandTheme("light")).toBe("dark");
  });
});
