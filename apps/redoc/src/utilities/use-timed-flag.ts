/** Boolean flag that clears itself after a short delay (copy feedback). */
import { useCallback, useEffect, useState } from "react";

/** `true` for `ms` after each `pulse()`, then back to `false`. */
export function useTimedFlag(ms = 2000): {
  active: boolean;
  pulse: () => void;
  clear: () => void;
} {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setActive(false);
    }, ms);
    return () => {
      window.clearTimeout(timer);
    };
  }, [active, ms]);

  const pulse = useCallback(() => {
    setActive(true);
  }, []);

  const clear = useCallback(() => {
    setActive(false);
  }, []);

  return { active, pulse, clear };
}
