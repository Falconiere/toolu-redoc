/** Samples column: schema tree + example in API Reference mock panels. */
import type { ReactNode } from "react";

import { SchemaRailExamplePanel } from "@/domains/docs/components/schema-rail-example";
import { SchemaTreeNode } from "@/domains/docs/components/schema-tree-node";
import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";
import type { SchemaRailProps } from "@/domains/docs/api/schema-rail-model";

/** Panel chrome shared by Example and Schema cards. */
function RailPanel({
  label,
  statusDot,
  children,
}: {
  label: string;
  statusDot?: "success" | "danger";
  children: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex h-13 items-center gap-2.5 border-b border-border-inner pr-2 pl-4">
        {statusDot !== undefined ? (
          <span
            aria-hidden="true"
            className={`size-(--spacing-status-dot) shrink-0 rounded-full ${
              statusDot === "success" ? "bg-success" : "bg-danger"
            }`}
          />
        ) : null}
        <span className="type-marker text-text-faint">{label}</span>
      </div>
      <div className="min-w-0 overflow-x-auto bg-disabled-fill p-3.5">{children}</div>
    </div>
  );
}

/** Render the Samples rail for a mapped SchemaRailModel (or empty placeholder). */
export function SchemaRail({ model }: SchemaRailProps) {
  if (model === null) {
    return <DocsShellPlaceholder message="Schemas and examples appear here." />;
  }
  const isErrorHeading = /\b[45]\d\d\b/.test(model.heading) || /default/i.test(model.heading);
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-label="Schema rail">
      <p className="type-marker px-1 text-text-faint">{model.heading}</p>
      {model.notices.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-label="Schema notices">
          {model.notices.map((notice) => (
            <li key={`${notice.code}:${notice.message}`} className="type-meta text-warning">
              {notice.message}
            </li>
          ))}
        </ul>
      ) : null}
      <RailPanel label="Example">
        <section aria-label="Example">
          <SchemaRailExamplePanel example={model.example} />
        </section>
      </RailPanel>
      <RailPanel label="Schema" statusDot={isErrorHeading ? "danger" : "success"}>
        <section aria-label="Schema">
          {model.root === null ? (
            <p className="type-meta text-text-faint">No schema.</p>
          ) : (
            <SchemaTreeNode node={model.root} />
          )}
        </section>
      </RailPanel>
    </div>
  );
}
