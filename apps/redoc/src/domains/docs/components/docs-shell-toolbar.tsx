/** Below-md toolbar that opens Navigation and Samples drawers. */
import type { RefObject } from "react";

import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";

/** Props for the docs shell mobile toolbar. */
export type DocsShellToolbarProps = {
  /** Whether the Navigation drawer is open. */
  navOpen: boolean;
  /** Whether the Samples drawer is open. */
  samplesOpen: boolean;
  /** Toggles the Navigation drawer (closes Samples if opening). */
  onToggleNav: () => void;
  /** Toggles the Samples drawer (closes Navigation if opening). */
  onToggleSamples: () => void;
  /** Ref to the Navigation opener for focus restore. */
  navButtonRef: RefObject<HTMLButtonElement | null>;
  /** Ref to the Samples opener for focus restore. */
  samplesButtonRef: RefObject<HTMLButtonElement | null>;
};

/** Navigation / Samples openers — visible only below the md breakpoint. */
export function DocsShellToolbar({
  navOpen,
  samplesOpen,
  onToggleNav,
  onToggleSamples,
  navButtonRef,
  samplesButtonRef,
}: DocsShellToolbarProps) {
  return (
    <div className="flex gap-2 border-b border-border p-4 md:hidden">
      <button
        ref={navButtonRef}
        type="button"
        aria-expanded={navOpen}
        className={`type-button min-h-touch rounded-xs border border-border bg-background px-3 text-text transition duration-(--duration-hover) ease-signal hover:border-accent active:translate-y-px ${CONTROL_FOCUS}`}
        onClick={onToggleNav}
      >
        Navigation
      </button>
      <button
        ref={samplesButtonRef}
        type="button"
        aria-expanded={samplesOpen}
        className={`type-button min-h-touch rounded-xs border border-border bg-background px-3 text-text transition duration-(--duration-hover) ease-signal hover:border-accent active:translate-y-px ${CONTROL_FOCUS}`}
        onClick={onToggleSamples}
      >
        Samples
      </button>
    </div>
  );
}
