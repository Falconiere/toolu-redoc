/** Copy share link for the loaded docs viewer (url+op disclosure). */
import { useState } from "react";

import { buildShareHref } from "@/domains/openapi/api/build-share-href";
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";

/** Focus ring utilities matching SpecLoad form controls. */
const CONTROL_FOCUS =
  "focus:border-accent focus:outline-none focus:ring-(--spacing-focus-ring) focus:ring-focus-ring";

/** Props for {@link ShareOperationLink}. */
export type ShareOperationLinkProps = {
  /** Current validated search (`url` / `op`). */
  search: SpecLoadSearch;
  /** Loaded source kind from SpecLoadSuccess. */
  sourceKind: "paste" | "url";
  /** Final source href when kind is url. */
  sourceHref?: string;
  /** Origin for the share href (defaults to window.location.origin). */
  origin?: string;
};

/** Disclosure when the source URL embeds its own query string. */
export const SHARE_URL_QUERY_DISCLOSURE =
  "The full source URL (including its query string) is embedded as the url search value. Pasted documents are not stored in the link — paste again in a fresh session.";

/** Disclosure when sharing a paste-sourced session. */
export const SHARE_PASTE_DISCLOSURE =
  "This link does not include the document. Paste the same OpenAPI document again in a fresh session to restore the operation.";

/** Copy button + Signal disclosure for share limitations (T22). */
export function ShareOperationLink({
  search,
  sourceKind,
  sourceHref,
  origin,
}: ShareOperationLinkProps) {
  const [copied, setCopied] = useState(false);
  const resolvedOrigin = origin ?? window.location.origin;
  const href = buildShareHref(resolvedOrigin, search);
  const showUrlQueryDisclosure = sourceKind === "url" && Boolean(sourceHref?.includes("?"));

  return (
    <div className="min-w-0 space-y-2">
      <button
        type="button"
        className={`${CONTROL_FOCUS} type-label border border-border px-3 py-2 text-text`}
        onClick={() => {
          void navigator.clipboard.writeText(href).then(() => {
            setCopied(true);
            return undefined;
          });
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
      <p className="type-meta break-all text-text-faint" data-testid="share-href">
        {href}
      </p>
      {showUrlQueryDisclosure ? (
        <p className="type-meta text-text-muted" data-testid="share-url-query-disclosure">
          {SHARE_URL_QUERY_DISCLOSURE}
        </p>
      ) : null}
      {sourceKind === "paste" ? (
        <p className="type-meta text-text-muted" data-testid="share-paste-disclosure">
          {SHARE_PASTE_DISCLOSURE}
        </p>
      ) : null}
    </div>
  );
}
