/** Copy share link for the loaded docs viewer (url+op disclosure). */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";
import { buildShareHref } from "@/domains/openapi/api/build-share-href";
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";
import { useTimedFlag } from "@/utilities/use-timed-flag";

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

/** Shared share-link model (one hook instance per toolbar). */
type ShareOperationModel = {
  href: string;
  copied: boolean;
  copy: () => void;
  showUrlQueryDisclosure: boolean;
  showPasteDisclosure: boolean;
};

const ShareOperationContext = createContext<ShareOperationModel | null>(null);

/** Resolve share href + which disclosures to show. */
function useShareOperationModel(props: ShareOperationLinkProps): ShareOperationModel {
  const { search, sourceKind, sourceHref, origin, basePath = import.meta.env.BASE_URL } = props;
  const { active: copied, pulse } = useTimedFlag();
  const resolvedOrigin = origin ?? window.location.origin;
  const href = buildShareHref(resolvedOrigin, search, basePath);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(href).then(
      () => {
        pulse();
        return undefined;
      },
      () => undefined,
    );
  }, [href, pulse]);
  return useMemo(
    () => ({
      href,
      copied,
      copy,
      showUrlQueryDisclosure: sourceKind === "url" && Boolean(sourceHref?.includes("?")),
      showPasteDisclosure: sourceKind === "paste",
    }),
    [href, copied, copy, sourceKind, sourceHref],
  );
}

/** Owns one share model for both the copy button and meta strip. */
export function ShareOperationProvider({
  children,
  ...props
}: ShareOperationLinkProps & { children: ReactNode }) {
  const model = useShareOperationModel(props);
  return <ShareOperationContext.Provider value={model}>{children}</ShareOperationContext.Provider>;
}

function useShareOperationContext(): ShareOperationModel {
  const ctx = useContext(ShareOperationContext);
  if (ctx === null) {
    throw new Error("ShareOperationLink/Meta require ShareOperationProvider");
  }
  return ctx;
}

/** Header action: copy button only (meta lives in {@link ShareOperationMeta}). */
export function ShareOperationLink() {
  const { href, copied, copy } = useShareOperationContext();
  return (
    <button type="button" className={GHOST_BUTTON} title={href} onClick={copy}>
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

/** Second-row share href + paste/url disclosures (aligned meta strip). */
export function ShareOperationMeta() {
  const { href, showUrlQueryDisclosure, showPasteDisclosure } = useShareOperationContext();
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
