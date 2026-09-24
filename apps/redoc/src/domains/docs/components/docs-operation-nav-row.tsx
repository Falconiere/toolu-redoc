/** One selectable operation row in the docs nav sidebar. */
import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";
import type { OperationNavItem } from "@/domains/docs/components/docs-operation-nav";

/** Props for a single nav operation control. */
export type DocsOperationNavRowProps = {
  /** Row DTO (method, path, summary, deprecated). */
  item: OperationNavItem;
  /** Whether this identity is the current selection. */
  selected: boolean;
  /** Called with the row identity when activated. */
  onSelectIdentity: (identity: string) => void;
};

/** Primary label: trimmed summary when nonempty, otherwise path. */
export function operationNavPrimaryText(item: OperationNavItem): string {
  const summary = item.summary?.trim();
  if (summary !== undefined && summary.length > 0) {
    return summary;
  }
  return item.path;
}

/** Focusable operation row — button with house focus ring and local overflow. */
export function DocsOperationNavRow({
  item,
  selected,
  onSelectIdentity,
}: DocsOperationNavRowProps) {
  const primary = operationNavPrimaryText(item);
  const methodLabel = item.method.toUpperCase();

  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      className={`type-body-sm flex w-full min-w-0 items-baseline gap-2 overflow-auto rounded-xs border border-transparent px-2 py-1.5 text-left text-text transition duration-(--duration-hover) ease-signal hover:border-border active:translate-y-px ${CONTROL_FOCUS}`}
      onClick={() => {
        onSelectIdentity(item.identity);
      }}
    >
      <span className="type-data shrink-0 text-text-faint">{methodLabel}</span>
      <span className="min-w-0">{primary}</span>
      {item.deprecated ? (
        <span className="type-meta shrink-0 text-text-faint">(deprecated)</span>
      ) : null}
    </button>
  );
}
