/** Modal drawer for nav/samples content below the md breakpoint. */
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";
import { MD_UP_QUERY } from "@/domains/docs/hooks/use-md-up";

/** Focusable controls inside a drawer panel (for the Tab trap). */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Props for a docs shell drawer dialog. */
export type DocsShellDrawerProps = {
  /** Visible dialog title; matches the opener name (Navigation / Samples). */
  title: string;
  /** Whether the dialog is mounted and open. */
  open: boolean;
  /** Which edge the panel docks to. */
  side: "start" | "end";
  /** Closes the drawer (Close, Escape, backdrop). */
  onClose: () => void;
  /** Opener button that should regain focus when this drawer closes below md. */
  openerRef: RefObject<HTMLButtonElement | null>;
  /** Drawer body — React children only; never HTML strings. */
  children: ReactNode;
};

/** Trap Tab inside `panel`; Escape calls `onClose`. */
function onDrawerKeyDown(event: KeyboardEvent, panel: HTMLElement, onClose: () => void): void {
  if (event.key === "Escape") {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== "Tab") {
    return;
  }

  const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
  if (focusables.length === 0) {
    event.preventDefault();
    panel.focus();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const active = document.activeElement;

  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Open as a modal when the platform supports it; otherwise fall back to `open`. */
function openDrawerDialog(panel: HTMLDialogElement): void {
  if (typeof panel.showModal === "function") {
    if (!panel.open) {
      panel.showModal();
    }
    return;
  }
  panel.setAttribute("open", "");
}

/** Close a dialog opened via showModal or the open attribute. */
function closeDrawerDialog(panel: HTMLDialogElement): void {
  if (typeof panel.close === "function" && panel.open) {
    panel.close();
    return;
  }
  panel.removeAttribute("open");
}

/** Dialog drawer with focus trap, Escape/Close/backdrop dismiss, and focus restore. */
export function DocsShellDrawer({
  title,
  open,
  side,
  onClose,
  openerRef,
  children,
}: DocsShellDrawerProps) {
  const panelRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const panel = panelRef.current;
    const opener = openerRef.current;
    if (panel === null) {
      return undefined;
    }

    openDrawerDialog(panel);
    panel.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      onDrawerKeyDown(event, panel, () => {
        onCloseRef.current();
      });
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      closeDrawerDialog(panel);
      // Restore to opener only while still below md; md flip focuses <main> instead.
      if (!window.matchMedia(MD_UP_QUERY).matches) {
        opener?.focus();
      }
    };
  }, [open, openerRef]);

  if (!open) {
    return null;
  }

  const sideClass = side === "start" ? "left-0 border-r" : "right-0 border-l";

  return (
    <>
      <button
        type="button"
        aria-label="Dismiss drawer"
        className="fixed inset-0 z-40 bg-background/80"
        onClick={onClose}
      />
      <dialog
        ref={panelRef}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`fixed inset-y-0 z-50 m-0 flex w-full max-w-md flex-col border-border bg-background p-0 ${sideClass}`}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 id={titleId} className="type-label text-text">
            {title}
          </h2>
          <button
            type="button"
            className={`type-button min-h-(--spacing-touch) rounded-xs border border-border bg-background px-3 text-text transition duration-(--duration-hover) ease-signal hover:border-accent active:translate-y-px ${CONTROL_FOCUS}`}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="min-w-0 flex-1 overflow-auto p-4">{children}</div>
      </dialog>
    </>
  );
}
