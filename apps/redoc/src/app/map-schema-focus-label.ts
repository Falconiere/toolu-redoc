/** Temporary Samples-rail label for SchemaFocus until #7. */
import type { SchemaFocus } from "@/domains/docs/api/operation-detail-model";

/** Summarize SchemaFocus for the temporary Samples stub until #7. */
export function mapSchemaFocusLabel(focus: SchemaFocus): string {
  if (focus.kind === "parameter") {
    return `Schema focus: parameter ${focus.name} (${focus.in})`;
  }
  if (focus.kind === "request") {
    return `Schema focus: request ${focus.mediaType}`;
  }
  const media = focus.mediaType ?? "—";
  const header = focus.headerName !== null ? ` header ${focus.headerName}` : "";
  return `Schema focus: response ${focus.status} ${media}${header}`;
}
