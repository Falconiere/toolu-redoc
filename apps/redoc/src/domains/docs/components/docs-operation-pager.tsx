/** Prev / next operation pager (API Reference mock). */
import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";

/** One pager neighbor, or null when at an edge. */
export type OperationPagerNeighbor = {
  identity: string;
  label: string;
} | null;

/** Props for {@link DocsOperationPager}. */
export type DocsOperationPagerProps = {
  previous: OperationPagerNeighbor;
  next: OperationPagerNeighbor;
  onSelectIdentity: (identity: string) => void;
};

/** Ghost pager control matching the mock. */
const PAGER_BUTTON =
  `min-h-14 rounded-sm border border-border bg-transparent px-4 py-2.5 text-text-muted ` +
  `transition duration-(--duration-hover) ease-signal hover:border-border-strong hover:text-text ` +
  `active:translate-y-px ${CONTROL_FOCUS}`;

/** Bottom prev/next controls for document-order operations. */
export function DocsOperationPager({ previous, next, onSelectIdentity }: DocsOperationPagerProps) {
  if (previous === null && next === null) {
    return null;
  }
  return (
    <nav
      aria-label="Pager"
      className="mt-12 flex justify-between gap-4 border-t border-border pt-6"
    >
      <div>
        {previous !== null ? (
          <button
            type="button"
            className={`${PAGER_BUTTON} flex flex-col gap-1 text-left`}
            onClick={() => {
              onSelectIdentity(previous.identity);
            }}
          >
            <span className="type-marker text-text-faint">← Previous</span>
            <span className="type-body-sm text-text">{previous.label}</span>
          </button>
        ) : null}
      </div>
      <div>
        {next !== null ? (
          <button
            type="button"
            className={`${PAGER_BUTTON} flex flex-col items-end gap-1 text-right`}
            onClick={() => {
              onSelectIdentity(next.identity);
            }}
          >
            <span className="type-marker text-text-faint">Next →</span>
            <span className="type-body-sm text-text">{next.label}</span>
          </button>
        ) : null}
      </div>
    </nav>
  );
}
