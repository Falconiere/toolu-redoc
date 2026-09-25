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

/** Focusable operation row — live method colour when selected (Signal job 2). */
export function DocsOperationNavRow({
  item,
  selected,
  onSelectIdentity,
}: DocsOperationNavRowProps) {
  const primary = operationNavPrimaryText(item);
  const methodLabel = item.method.toUpperCase();
  const selectedClass = selected
    ? "border-border bg-surface"
    : "border-transparent hover:bg-disabled-fill";

  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      aria-pressed={selected}
      className={`flex h-10 w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-sm border px-2.5 text-left transition duration-(--duration-hover) ease-signal active:translate-y-px ${selectedClass} ${CONTROL_FOCUS}`}
      onClick={() => {
        onSelectIdentity(item.identity);
      }}
    >
      <span className={`type-data w-12 shrink-0 ${selected ? "text-accent" : "text-text-muted"}`}>
        {methodLabel}
      </span>
      <span
        className={`type-body-sm min-w-0 truncate ${selected ? "text-text" : "text-text-muted"}`}
      >
        {primary}
      </span>
      {item.deprecated ? (
        <span className="type-meta shrink-0 text-text-faint">(deprecated)</span>
      ) : null}
    </button>
  );
}
