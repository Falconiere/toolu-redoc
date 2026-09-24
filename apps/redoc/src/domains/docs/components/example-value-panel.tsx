/** Format and render media example values as inert mono text. */
import { formatExampleValue } from "@/domains/docs/components/format-example-value";
import type { OperationMediaModel } from "@/domains/docs/api/operation-detail-model";

/** Props for the example value panel. */
export type ExampleValuePanelProps = {
  media: OperationMediaModel | undefined;
  exampleKey: string | null;
};

/** Singular / named / external example as React text only. */
export function ExampleValuePanel({ media, exampleKey }: ExampleValuePanelProps) {
  if (media === undefined) {
    return (
      <p className="type-meta text-text-faint" aria-label="Example value">
        No example.
      </p>
    );
  }
  if (exampleKey === null && media.singularExample.present) {
    return (
      <pre
        className="type-data overflow-x-auto whitespace-pre-wrap text-text"
        aria-label="Example value"
      >
        {formatExampleValue(media.singularExample.value)}
      </pre>
    );
  }
  const named = media.namedExamples.find((entry) => entry.key === exampleKey);
  if (named === undefined) {
    return (
      <p className="type-meta text-text-faint" aria-label="Example value">
        No example.
      </p>
    );
  }
  if (named.externalValue !== null && named.value === undefined) {
    return (
      <p className="type-data break-all text-text" aria-label="Example value">
        externalValue: {named.externalValue}
      </p>
    );
  }
  return (
    <pre
      className="type-data overflow-x-auto whitespace-pre-wrap text-text"
      aria-label="Example value"
    >
      {formatExampleValue(named.value)}
    </pre>
  );
}
