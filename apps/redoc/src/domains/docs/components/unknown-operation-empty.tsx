/** Distinct main-pane empty when share `op` is malformed or missing from the doc. */
import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";

/** Title shown for an unknown operation deep link. */
export const UNKNOWN_OPERATION_TITLE = "Unknown operation.";

/** Body explaining a missing or invalid operation key. */
export const UNKNOWN_OPERATION_BODY =
  "This link's operation key is missing or invalid in the loaded document.";

/** Empty state for unknown/malformed `op` — distinct from “Select an operation.” */
export function UnknownOperationEmpty() {
  return (
    <div className="min-w-0 space-y-2">
      <p className="type-body text-text">{UNKNOWN_OPERATION_TITLE}</p>
      <DocsShellPlaceholder message={UNKNOWN_OPERATION_BODY} />
    </div>
  );
}
