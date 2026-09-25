/** Resolve share-search `op` against document operation identities. */
import { decodeOperationIdentity } from "@/domains/openapi/api/operation-identity";

/** Result of resolving an optional `op` search value against a loaded document. */
export type OperationSelection =
  | { kind: "none" }
  | { kind: "selected"; identity: string }
  | { kind: "unknown"; rawOp: string; reason: "malformed" | "missing" };

/** Collect identity strings from a Set or `{ identity }` array. */
function toIdentitySet(
  identities: ReadonlySet<string> | ReadonlyArray<{ identity: string }>,
): Set<string> {
  if (isIdentityArray(identities)) {
    return new Set(identities.map((item) => item.identity));
  }
  return new Set(identities);
}

/** True when identities is an array of `{ identity }` rows. */
function isIdentityArray(
  identities: ReadonlySet<string> | ReadonlyArray<{ identity: string }>,
): identities is ReadonlyArray<{ identity: string }> {
  return Array.isArray(identities);
}

/**
 * Resolve `op` to none, a selected document identity, or unknown
 * (malformed decode / missing from document). Never throws.
 */
export function resolveOperationSelection(
  op: string | undefined,
  identities: ReadonlySet<string> | ReadonlyArray<{ identity: string }>,
): OperationSelection {
  if (op === undefined || op.length === 0) {
    return { kind: "none" };
  }

  let decoded: ReturnType<typeof decodeOperationIdentity>;
  try {
    decoded = decodeOperationIdentity(op);
  } catch {
    return { kind: "unknown", rawOp: op, reason: "malformed" };
  }

  const identitySet = toIdentitySet(identities);
  for (const identity of identitySet) {
    try {
      const candidate = decodeOperationIdentity(identity);
      if (candidate.method === decoded.method && candidate.path === decoded.path) {
        return { kind: "selected", identity };
      }
    } catch {
      // Skip corrupt identity strings in the document set.
    }
  }

  return { kind: "unknown", rawOp: op, reason: "missing" };
}
