/** Ghost control that flips the Signal band (dark ↔ light). */
import { useBandTheme } from "@/providers/band-theme-provider";
import { CONTROL_FOCUS } from "@/utilities/control-focus";

/** Shared ghost chrome button. */
const GHOST_BUTTON =
  `type-button flex h-9 items-center rounded-xs border border-border bg-transparent px-3 text-text-muted ` +
  `transition duration-(--duration-hover) ease-signal hover:border-border-strong hover:text-text ` +
  `active:translate-y-px ${CONTROL_FOCUS}`;

/** Toolbar control: label shows the band you will switch TO. */
export function BandThemeToggle() {
  const { theme, toggle } = useBandTheme();
  const nextLabel = theme === "dark" ? "Light" : "Dark";
  return (
    <button
      type="button"
      className={GHOST_BUTTON}
      aria-pressed={theme === "light"}
      aria-label={`Switch to ${nextLabel.toLowerCase()} band`}
      onClick={toggle}
    >
      {nextLabel}
    </button>
  );
}
