/** Merge `op` into SpecLoadSearch while preserving `url`. */
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";

/** Navigate options for writing operation search (push vs replace). */
export type WriteOpOptions = {
  /** false = push (user select); true = replace (inbound deep-link / reset). */
  replace: boolean;
};

/**
 * Set or clear `op` while preserving `url`.
 * Pass `undefined` for `op` to remove it from the search object.
 */
export function mergeOperationSearch(
  previous: SpecLoadSearch,
  op: string | undefined,
): SpecLoadSearch {
  const next: SpecLoadSearch = {};
  if (previous.url !== undefined) {
    next.url = previous.url;
  }
  if (op !== undefined && op.length > 0) {
    next.op = op;
  }
  return next;
}
