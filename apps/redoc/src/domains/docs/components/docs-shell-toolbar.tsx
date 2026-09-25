/** Below-md toolbar that opens Navigation and Samples drawers. */
import type { RefObject } from "react";

import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";

/** Shared opener button classes for the mobile docs toolbar. */
const TOOLBAR_BUTTON_CLASS =
  `type-button min-h-(--spacing-touch) rounded-xs border border-border bg-background px-3 text-text ` +
  `transition duration-(--duration-hover) ease-signal hover:border-accent active:translate-y-px ${CONTROL_FOCUS}`;

/** Props for the docs shell mobile toolbar. */
export type DocsShellToolbarProps = {
  /** Whether the Navigation drawer is open. */
  navOpen: boolean;
  /** Whether the Samples drawer is open. */
  samplesOpen: boolean;
  /** When false, hide the Samples opener (empty rail). */
  samplesVisible: boolean;
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
  samplesVisible,
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
        className={TOOLBAR_BUTTON_CLASS}
        onClick={onToggleNav}
      >
        Navigation
      </button>
      {samplesVisible ? (
        <button
          ref={samplesButtonRef}
          type="button"
          aria-expanded={samplesOpen}
          className={TOOLBAR_BUTTON_CLASS}
          onClick={onToggleSamples}
        >
          Samples
        </button>
      ) : null}
    </div>
  );
}
