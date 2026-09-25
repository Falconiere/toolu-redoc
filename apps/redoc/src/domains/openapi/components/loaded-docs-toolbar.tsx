/** Viewer toolbar above DocsShell: title, version, share, reset. */
import type { ReactNode } from "react";

import {
  ShareOperationLink,
  type ShareOperationLinkProps,
} from "@/domains/openapi/components/share-operation-link";

/** Focus ring utilities matching SpecLoad form controls. */
const CONTROL_FOCUS =
  "focus:border-accent focus:outline-none focus:ring-(--spacing-focus-ring) focus:ring-focus-ring";

/** Props for {@link LoadedDocsToolbar}. */
export type LoadedDocsToolbarProps = {
  title: string;
  version: string;
  share: ShareOperationLinkProps;
  onReset: () => void;
  /** Optional extra meta (source kind/href). */
  sourceSummary?: ReactNode;
};

/** Slim chrome for the post-load docs viewer on `/`. */
export function LoadedDocsToolbar({
  title,
  version,
  share,
  onReset,
  sourceSummary,
}: LoadedDocsToolbarProps) {
  return (
    <header className="border-b border-border px-4 py-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="type-subhead text-text">{title}</h1>
          <p className="type-data text-text-muted">{version}</p>
          {sourceSummary}
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:items-end">
          <ShareOperationLink {...share} />
          <button
            type="button"
            className={`${CONTROL_FOCUS} type-label border border-border px-3 py-2 text-text`}
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
