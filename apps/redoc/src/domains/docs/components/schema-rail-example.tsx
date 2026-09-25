/** Format and render the Samples rail example panel. */
import { formatExampleValue } from "@/domains/docs/components/format-example-value";
import type { SchemaRailExample } from "@/domains/docs/api/schema-rail-model";

/** Props for the schema rail example panel. */
export type SchemaRailExampleProps = {
  example: SchemaRailExample;
};

/** Empty / value / external example as inert mono text. */
export function SchemaRailExamplePanel({ example }: SchemaRailExampleProps) {
  if (example.kind === "empty") {
    return (
      <p className="type-meta text-text-faint" aria-label="Example value">
        No example.
      </p>
    );
  }
  if (example.kind === "external") {
    const label = example.name !== null ? `${example.name}: ` : "";
    return (
      <p className="type-code break-all text-text" aria-label="Example value">
        {label}externalValue: {example.url}
      </p>
    );
  }
  const source = example.source === "media" ? "media example" : "schema example";
  const name = example.name !== null ? ` (${example.name})` : "";
  return (
    <div className="flex flex-col gap-1">
      <p className="type-meta text-text-muted">
        {source}
        {name}
      </p>
      <pre
        className="type-code overflow-x-auto whitespace-pre-wrap text-text"
        aria-label="Example value"
      >
        {formatExampleValue(example.value)}
      </pre>
    </div>
  );
}
