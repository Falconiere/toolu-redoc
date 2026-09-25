/** Recursive disclosure row for one SchemaNode (React text children only). */
import type { SchemaNode } from "@/domains/docs/api/schema-rail-model";

/** Props for a single schema tree node. */
export type SchemaTreeNodeProps = {
  node: SchemaNode;
  label?: string | undefined;
  required?: boolean | undefined;
};

/** Fact-rail disclosure for schema / boundary / boolean nodes. */
export function SchemaTreeNode({ node, label, required }: SchemaTreeNodeProps) {
  if (node.kind === "boundary") {
    return <SchemaBoundaryNode node={node} label={label} required={required} />;
  }
  if (node.kind === "boolean") {
    return <SchemaBooleanNode node={node} label={label} />;
  }
  return <SchemaObjectNode node={node} label={label} required={required} />;
}

/** Boundary / unresolved `$ref` row. */
function SchemaBoundaryNode({
  node,
  label,
  required,
}: {
  node: Extract<SchemaNode, { kind: "boundary" }>;
  label?: string | undefined;
  required?: boolean | undefined;
}) {
  return (
    <div className="border-l border-border pl-3">
      {label !== undefined ? (
        <p className="type-meta text-text">
          {label}
          {required === true ? " · required" : ""}
        </p>
      ) : null}
      <p className="type-data text-warning">
        {node.$ref} · {node.reason}
      </p>
      <p className="type-meta text-text-muted">{node.message}</p>
    </div>
  );
}

/** Boolean JSON Schema (`true` / `false`) row. */
function SchemaBooleanNode({
  node,
  label,
}: {
  node: Extract<SchemaNode, { kind: "boolean" }>;
  label?: string | undefined;
}) {
  return (
    <div className="border-l border-border pl-3">
      {label !== undefined ? <p className="type-meta text-text">{label}</p> : null}
      <p className="type-data text-text">boolean schema · {String(node.value)}</p>
    </div>
  );
}

/** Object / array / composition schema disclosure. */
function SchemaObjectNode({
  node,
  label,
  required,
}: {
  node: Extract<SchemaNode, { kind: "schema" }>;
  label?: string | undefined;
  required?: boolean | undefined;
}) {
  const title = label ?? node.typeLabel;
  const meta = schemaMetaLine(node, required);
  return (
    <details className="border-l border-border pl-3" open={label === undefined}>
      <summary className="type-meta cursor-pointer text-text">
        <span className="type-data">{title}</span>
        {meta.length > 0 ? <span className="text-text-muted"> · {meta}</span> : null}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <SchemaObjectBody node={node} />
      </div>
    </details>
  );
}

/** Inner fields for a schema disclosure body. */
function SchemaObjectBody({ node }: { node: Extract<SchemaNode, { kind: "schema" }> }) {
  return (
    <>
      {node.viaRef !== null ? <p className="type-meta text-text-muted">via {node.viaRef}</p> : null}
      {node.description !== null ? <p className="type-body text-text">{node.description}</p> : null}
      {node.enumValues !== null ? (
        <p className="type-data text-text">enum: {JSON.stringify(node.enumValues)}</p>
      ) : null}
      {node.defaultPresent ? (
        <p className="type-data text-text">default: {JSON.stringify(node.defaultValue)}</p>
      ) : null}
      {node.constraints.map((row) => (
        <p key={row.name} className="type-meta text-text-muted">
          {row.name}={row.value}
        </p>
      ))}
      {node.additionalProperties === "forbidden" ? (
        <p className="type-meta text-text-muted">additionalProperties: false</p>
      ) : null}
      {node.additionalProperties === "allowed" ? (
        <p className="type-meta text-text-muted">additionalProperties: true</p>
      ) : null}
      {node.discriminator !== null ? (
        <p className="type-meta text-text-muted">
          discriminator {node.discriminator.propertyName}
          {node.discriminator.mapping.length > 0
            ? `: ${node.discriminator.mapping.map((row) => row.name).join(", ")}`
            : ""}
        </p>
      ) : null}
      {node.composition !== null ? (
        <CompositionBranches
          keyword={node.composition.keyword}
          branches={node.composition.branches}
        />
      ) : null}
      {node.items !== null ? <SchemaTreeNode node={node.items} label="items" /> : null}
      {typeof node.additionalProperties === "object" && node.additionalProperties !== null ? (
        <SchemaTreeNode node={node.additionalProperties} label="additionalProperties" />
      ) : null}
      {node.properties.map((row) => (
        <SchemaTreeNode key={row.name} node={row.node} label={row.name} required={row.required} />
      ))}
      {node.unsupportedKeywords.length > 0 ? (
        <details>
          <summary className="type-meta cursor-pointer text-warning">Unsupported semantics</summary>
          <p className="type-data text-text-muted">{node.unsupportedKeywords.join(", ")}</p>
        </details>
      ) : null}
    </>
  );
}

/** Render allOf/oneOf/anyOf branches with stable keys. */
function CompositionBranches({
  keyword,
  branches,
}: {
  keyword: "allOf" | "oneOf" | "anyOf";
  branches: SchemaNode[];
}) {
  const labeled = branches.map((branch, position) => ({
    branch,
    key: `${keyword}:${branchKey(branch)}:${position + 1}`,
    label: `branch ${position + 1}`,
  }));
  return (
    <div className="flex flex-col gap-2">
      <p className="type-meta text-text">{keyword}</p>
      {labeled.map((entry) => (
        <SchemaTreeNode key={entry.key} node={entry.branch} label={entry.label} />
      ))}
    </div>
  );
}

/** Compact meta suffix for a schema summary line. */
function schemaMetaLine(
  node: Extract<SchemaNode, { kind: "schema" }>,
  required: boolean | undefined,
): string {
  return [
    node.typeLabel,
    node.format,
    node.nullable30 ? "nullable" : null,
    node.nullInType ? "null-in-type" : null,
    node.readOnly ? "readOnly" : null,
    node.writeOnly ? "writeOnly" : null,
    required === true ? "required" : null,
  ]
    .filter((entry): entry is string => entry !== null && entry.length > 0)
    .join(" · ");
}

/** Stable fragment for a composition branch key. */
function branchKey(node: SchemaNode): string {
  if (node.kind === "boundary") {
    return `boundary:${node.$ref}:${node.reason}`;
  }
  if (node.kind === "boolean") {
    return `boolean:${String(node.value)}`;
  }
  return `schema:${node.viaRef ?? ""}:${node.typeLabel}`;
}
