/** Main-pane chrome proving shared nav selection until full detail lands. */
import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";
import type { OperationNavItem } from "@/domains/docs/components/docs-operation-nav";

/** Props for the operation selection chrome. */
export type DocsOperationSelectionProps = {
  /** Selected nav item, or null when nothing is selected. */
  item: OperationNavItem | null;
};

/** Placeholder or lightweight method/path/summary chrome for the main slot. */
export function DocsOperationSelection({ item }: DocsOperationSelectionProps) {
  if (item === null) {
    return <DocsShellPlaceholder message="Select an operation." />;
  }

  return (
    <div className="min-w-0 space-y-2">
      <p className="type-data text-text-faint">{item.method.toUpperCase()}</p>
      <p className="type-body min-w-0 overflow-auto text-text">{item.path}</p>
      {item.summary !== undefined && item.summary.trim().length > 0 ? (
        <p className="type-body-sm text-text-muted">{item.summary.trim()}</p>
      ) : null}
      {item.operationId !== undefined ? (
        <p className="type-meta text-text-faint">{item.operationId}</p>
      ) : null}
      {item.deprecated ? <p className="type-meta text-text-faint">(deprecated)</p> : null}
    </div>
  );
}
