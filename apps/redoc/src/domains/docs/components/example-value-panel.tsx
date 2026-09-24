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
    return <p className="type-meta text-text-faint">No example.</p>;
  }
  if (exampleKey === null && media.singularExample.present) {
    return (
      <pre className="type-data overflow-x-auto whitespace-pre-wrap text-text">
        {formatExampleValue(media.singularExample.value)}
      </pre>
    );
  }
  const named = media.namedExamples.find((entry) => entry.key === exampleKey);
  if (named === undefined) {
    return <p className="type-meta text-text-faint">No example.</p>;
  }
  if (named.externalValue !== null && !Object.hasOwn(named, "value")) {
    return <p className="type-data break-all text-text">externalValue: {named.externalValue}</p>;
  }
  return (
    <pre className="type-data overflow-x-auto whitespace-pre-wrap text-text">
      {formatExampleValue(named.value)}
    </pre>
  );
}
