/** React context for the Signal band theme (dark / light). */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyBandTheme,
  nextBandTheme,
  readStoredBandTheme,
  writeStoredBandTheme,
  type BandTheme,
} from "@/utilities/band-theme";

/** Band theme context value. */
export type BandThemeContextValue = {
  theme: BandTheme;
  toggle: () => void;
};

const BandThemeContext = createContext<BandThemeContextValue | null>(null);

/** Provider: syncs `<html class="band-light">` + localStorage. */
export function BandThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<BandTheme>(() => readStoredBandTheme());

  useEffect(() => {
    applyBandTheme(theme);
    writeStoredBandTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => nextBandTheme(current));
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return <BandThemeContext.Provider value={value}>{children}</BandThemeContext.Provider>;
}

/**
 * Read band theme controls. Uses the provider when present; otherwise a local
 * fallback so isolated test mounts of SpecLoad / toolbar still render.
 * Fallback starts at dark without reading storage (provider owns persistence).
 */
export function useBandTheme(): BandThemeContextValue {
  const ctx = useContext(BandThemeContext);
  const [fallback, setFallback] = useState<BandTheme>("dark");

  useEffect(() => {
    if (ctx !== null) {
      return;
    }
    applyBandTheme(fallback);
  }, [ctx, fallback]);

  const fallbackToggle = useCallback(() => {
    setFallback((current) => {
      const next = nextBandTheme(current);
      applyBandTheme(next);
      writeStoredBandTheme(next);
      return next;
    });
  }, []);

  return useMemo(() => {
    if (ctx !== null) {
      return ctx;
    }
    return { theme: fallback, toggle: fallbackToggle };
  }, [ctx, fallback, fallbackToggle]);
}
