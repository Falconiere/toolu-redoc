/** Plain view-model for the Samples schema rail (#7). */

/** Local notice surfaced above the schema tree. */
export type SchemaRailNotice = {
  code: string;
  message: string;
};

/** Example panel state for the Samples rail. */
export type SchemaRailExample =
  | { kind: "empty" }
  | { kind: "value"; value: unknown; source: "media" | "schema"; name: string | null }
  | { kind: "external"; url: string; name: string | null };

/** One property row under an object schema node. */
export type SchemaPropertyRow = {
  name: string;
  required: boolean;
  node: SchemaNode;
};

/** Authored composition keyword with unflattened branches. */
export type SchemaComposition = {
  keyword: "allOf" | "oneOf" | "anyOf";
  branches: SchemaNode[];
};

/** Recursive schema tree node for the disclosure rail. */
export type SchemaNode =
  | {
      kind: "boundary";
      $ref: string;
      reason: "cycle" | "depth" | "dangling" | "external" | "wrong-kind";
      message: string;
    }
  | {
      kind: "boolean";
      value: boolean;
      description: string | null;
    }
  | {
      kind: "schema";
      viaRef: string | null;
      typeLabel: string;
      format: string | null;
      description: string | null;
      nullable30: boolean;
      nullInType: boolean;
      requiredNames: string[];
      enumValues: unknown[] | null;
      defaultPresent: boolean;
      defaultValue: unknown;
      readOnly: boolean;
      writeOnly: boolean;
      properties: SchemaPropertyRow[];
      additionalProperties: "allowed" | "forbidden" | SchemaNode | null;
      items: SchemaNode | null;
      composition: SchemaComposition | null;
      discriminator: {
        propertyName: string;
        mapping: { name: string; $ref: string }[];
      } | null;
      unsupportedKeywords: string[];
      constraints: { name: string; value: string }[];
    };

/** Full Samples rail model for one SchemaFocus. */
export type SchemaRailModel = {
  heading: string;
  notices: SchemaRailNotice[];
  root: SchemaNode | null;
  example: SchemaRailExample;
};

/** Props for the Samples schema rail. */
export type SchemaRailProps = {
  model: SchemaRailModel | null;
};

/**
 * True when the Samples column has schema, example, or notices worth showing.
 * Empty focus / empty body collapses the desktop rail (blueprint-dense layout).
 */
export function schemaRailHasContent(model: SchemaRailModel | null): boolean {
  if (model === null) {
    return false;
  }
  if (model.notices.length > 0 || model.root !== null) {
    return true;
  }
  return model.example.kind !== "empty";
}
