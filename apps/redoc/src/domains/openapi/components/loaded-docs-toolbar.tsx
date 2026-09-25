/** Viewer toolbar above DocsShell: title, version, share, reset, band toggle. */
import type { ReactNode } from "react";

import {
  ShareOperationLink,
  ShareOperationMeta,
  ShareOperationProvider,
  type ShareOperationLinkProps,
} from "@/domains/openapi/components/share-operation-link";
import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";
import { BandThemeToggle } from "@/ui/band-theme-toggle";

/** Primary inverted control — reset / primary actions. */
const PRIMARY_BUTTON =
  `type-button flex h-9 shrink-0 items-center gap-2 rounded-xs bg-primary px-3.5 text-on-primary ` +
  `transition duration-(--duration-hover) ease-signal hover:bg-primary-hover ` +
  `active:translate-y-px ${CONTROL_FOCUS}`;

/** Props for {@link LoadedDocsToolbar}. */
export type LoadedDocsToolbarProps = {
  title: string;
  version: string;
  share: ShareOperationLinkProps;
  onReset: () => void;
  /** Optional extra meta (source kind/href). */
  sourceSummary?: ReactNode;
};

/**
 * API Reference mock chrome: one aligned action row, then a meta strip for
 * source + share href (same baseline, no wrap scramble).
 */
export function LoadedDocsToolbar({
  title,
  version,
  share,
  onReset,
  sourceSummary,
}: LoadedDocsToolbarProps) {
  return (
    <ShareOperationProvider {...share}>
      <div className="shrink-0 border-b border-border bg-background">
        <header className="flex h-(--spacing-docs-header) items-center gap-3 px-6">
          <h1 className="type-subhead min-w-0 truncate text-text">{title}</h1>
          <span className="type-marker hidden shrink-0 text-text-muted sm:inline">
            / API reference
          </span>
          <div className="min-w-0 flex-1" />
          <span className="type-data shrink-0 rounded-xs border border-border px-2 py-1 text-text-muted">
            v{version}
          </span>
          <BandThemeToggle />
          <ShareOperationLink />
          <button type="button" className={PRIMARY_BUTTON} onClick={onReset}>
            Reset
            <span className="opacity-50" aria-hidden="true">
              →
            </span>
          </button>
        </header>
        <div className="flex items-start gap-4 px-6 py-2">
          <div className="min-w-0 flex-1">{sourceSummary}</div>
          <div className="min-w-0 flex-1 text-right sm:max-w-md">
            <ShareOperationMeta />
          </div>
        </div>
      </div>
    </ShareOperationProvider>
  );
}
