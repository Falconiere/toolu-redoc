/** Samples column: schema tree, notices, and example panel for SchemaFocus. */
import { SchemaRailExamplePanel } from "@/domains/docs/components/schema-rail-example";
import { SchemaTreeNode } from "@/domains/docs/components/schema-tree-node";
import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";
import type { SchemaRailProps } from "@/domains/docs/api/schema-rail-model";

/** Render the Samples rail for a mapped SchemaRailModel (or empty placeholder). */
export function SchemaRail({ model }: SchemaRailProps) {
  if (model === null) {
    return <DocsShellPlaceholder message="Schemas and examples appear here." />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-label="Schema rail">
      <h2 className="type-subhead text-text">{model.heading}</h2>
      {model.notices.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-label="Schema notices">
          {model.notices.map((notice) => (
            <li key={`${notice.code}:${notice.message}`} className="type-meta text-warning">
              {notice.message}
            </li>
          ))}
        </ul>
      ) : null}
      <section className="flex flex-col gap-2" aria-label="Example">
        <h3 className="type-meta text-text-muted">Example</h3>
        <SchemaRailExamplePanel example={model.example} />
      </section>
      <section className="flex flex-col gap-2" aria-label="Schema">
        <h3 className="type-meta text-text-muted">Schema</h3>
        {model.root === null ? (
          <p className="type-meta text-text-faint">No schema.</p>
        ) : (
          <SchemaTreeNode node={model.root} />
        )}
      </section>
    </div>
  );
}
