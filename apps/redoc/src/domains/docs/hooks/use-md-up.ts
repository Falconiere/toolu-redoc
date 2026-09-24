/** matchMedia subscription for the house md breakpoint (860px). */
import { useEffect, useState } from "react";

/** matchMedia query for the house md breakpoint (860px). */
export const MD_UP_QUERY = "(min-width: 860px)";

/**
 * Subscribe to `(min-width: 860px)` and return whether the viewport is md-up.
 * Defaults to `true` during SSR / when `window` is unavailable.
 */
export function useMdUp(): boolean {
  const [isMdUp, setIsMdUp] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(MD_UP_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(MD_UP_QUERY);
    setIsMdUp(media.matches);
    const onChange = (event: MediaQueryListEvent) => {
      setIsMdUp(event.matches);
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, []);

  return isMdUp;
}
