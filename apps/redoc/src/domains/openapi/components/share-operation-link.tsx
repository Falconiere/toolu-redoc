/** Copy share link for the loaded docs viewer (url+op disclosure). */
import { useState } from "react";

import { buildShareHref } from "@/domains/openapi/api/build-share-href";
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";

/** Focus ring utilities matching SpecLoad form controls. */
const CONTROL_FOCUS =
  "focus:border-accent focus:outline-none focus:ring-(--spacing-focus-ring) focus:ring-focus-ring";

/** Ghost mono control matching the API Reference mock chrome. */
const GHOST_BUTTON =
  `type-button flex h-9 items-center rounded-xs border border-border bg-transparent px-3 text-text-muted ` +
  `transition duration-(--duration-hover) ease-signal hover:border-border-strong hover:text-text ` +
  `active:translate-y-px ${CONTROL_FOCUS}`;

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
  /** Deploy base path for the share href (defaults to import.meta.env.BASE_URL). */
  basePath?: string;
};

/** Disclosure when the source URL embeds its own query string. */
export const SHARE_URL_QUERY_DISCLOSURE =
  "The full source URL (including its query string) is embedded as the url search value. Pasted documents are not stored in the link — paste again in a fresh session.";

/** Disclosure when sharing a paste-sourced session. */
export const SHARE_PASTE_DISCLOSURE =
  "This link does not include the document. Paste the same OpenAPI document again in a fresh session to restore the operation.";

/** Resolve share href + which disclosures to show. */
function useShareOperationModel(props: ShareOperationLinkProps): {
  href: string;
  copied: boolean;
  copy: () => void;
  showUrlQueryDisclosure: boolean;
  showPasteDisclosure: boolean;
} {
  const { search, sourceKind, sourceHref, origin, basePath = import.meta.env.BASE_URL } = props;
  const [copied, setCopied] = useState(false);
  const resolvedOrigin = origin ?? window.location.origin;
  const href = buildShareHref(resolvedOrigin, search, basePath);
  return {
    href,
    copied,
    copy: () => {
      void navigator.clipboard.writeText(href).then(
        () => {
          setCopied(true);
          return undefined;
        },
        () => undefined,
      );
    },
    showUrlQueryDisclosure: sourceKind === "url" && Boolean(sourceHref?.includes("?")),
    showPasteDisclosure: sourceKind === "paste",
  };
}

/** Header action: copy button only (meta lives in {@link ShareOperationMeta}). */
export function ShareOperationLink(props: ShareOperationLinkProps) {
  const { href, copied, copy } = useShareOperationModel(props);
  return (
    <button type="button" className={GHOST_BUTTON} title={href} onClick={copy}>
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

/** Second-row share href + paste/url disclosures (aligned meta strip). */
export function ShareOperationMeta(props: ShareOperationLinkProps) {
  const { href, showUrlQueryDisclosure, showPasteDisclosure } = useShareOperationModel(props);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="type-meta truncate text-text-faint" data-testid="share-href">
        {href}
      </p>
      {showUrlQueryDisclosure ? (
        <p className="type-meta text-text-muted" data-testid="share-url-query-disclosure">
          {SHARE_URL_QUERY_DISCLOSURE}
        </p>
      ) : null}
      {showPasteDisclosure ? (
        <p className="type-meta text-text-muted" data-testid="share-paste-disclosure">
          {SHARE_PASTE_DISCLOSURE}
        </p>
      ) : null}
    </div>
  );
}
