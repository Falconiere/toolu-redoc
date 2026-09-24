/** Group a normalized OpenAPI document into tag sections for sidebar nav. */
import type {
  NormalizedOpenApiDocument,
  NormalizedOpenApiOperation,
} from "./normalize-openapi-document";

/** Sentinel section key for operations with an empty tags list.
 * Prefixed so it cannot collide with a literal OpenAPI tag named `__untagged__`.
 */
export const UNTAGGED_SECTION_KEY = "__toolu.untagged__";

/** Display label for the tagless bucket only (not a literal OpenAPI tag name). */
export const UNTAGGED_SECTION_LABEL = "Untagged";

/** One selectable row under a tag section. */
export type OperationNavItem = {
  identity: string;
  method: string;
  path: string;
  summary?: string;
  operationId?: string;
  deprecated: boolean;
  /** Distinct tag names from the operation (empty ⇒ tagless). Used by filter. */
  tags: string[];
};

/** One tag heading + its rows. */
export type OperationNavSection = {
  /** Tag name, or sentinel {@link UNTAGGED_SECTION_KEY} for the tagless bucket. */
  key: string;
  /** Visible heading; `"Untagged"` for the tagless bucket only. */
  label: string;
  items: OperationNavItem[];
};

/** Full sidebar model before or after filter. */
export type OperationNavModel = {
  sections: OperationNavSection[];
  /** Flat unique identities in document order (for tests / empty checks). */
  operationCount: number;
};

/**
 * Build tag-grouped nav sections from a normalized document.
 * Declared unique tags (first-declaration order) → undeclared first-seen →
 * tagless bucket last. Empty operations yield an empty model.
 */
export function buildOperationNavModel(document: NormalizedOpenApiDocument): OperationNavModel {
  if (document.operations.length === 0) {
    return { sections: [], operationCount: 0 };
  }

  const declaredOrder = uniqueDeclaredTagNames(document.tags);
  const declaredSet = new Set(declaredOrder);
  const undeclaredOrder: string[] = [];
  const undeclaredSet = new Set<string>();
  const itemsByTag = new Map<string, OperationNavItem[]>();
  const taglessItems: OperationNavItem[] = [];

  for (const operation of document.operations) {
    const item = toNavItem(operation);
    if (item.tags.length === 0) {
      taglessItems.push(item);
      continue;
    }
    for (const tagName of item.tags) {
      if (!declaredSet.has(tagName) && !undeclaredSet.has(tagName)) {
        undeclaredSet.add(tagName);
        undeclaredOrder.push(tagName);
      }
      const bucket = itemsByTag.get(tagName);
      if (bucket === undefined) {
        itemsByTag.set(tagName, [item]);
      } else {
        bucket.push(item);
      }
    }
  }

  const sections: OperationNavSection[] = [];
  for (const name of declaredOrder) {
    pushSectionIfNonEmpty(sections, name, name, itemsByTag.get(name));
  }
  for (const name of undeclaredOrder) {
    pushSectionIfNonEmpty(sections, name, name, itemsByTag.get(name));
  }
  if (taglessItems.length > 0) {
    sections.push({
      key: UNTAGGED_SECTION_KEY,
      label: UNTAGGED_SECTION_LABEL,
      items: taglessItems,
    });
  }

  return { sections, operationCount: document.operations.length };
}

/** Unique root tag names in first-declaration document order. */
function uniqueDeclaredTagNames(tags: ReadonlyArray<{ name: string }>): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (seen.has(tag.name)) {
      continue;
    }
    seen.add(tag.name);
    order.push(tag.name);
  }
  return order;
}

/** Append a section when it has at least one item. */
function pushSectionIfNonEmpty(
  sections: OperationNavSection[],
  key: string,
  label: string,
  items: OperationNavItem[] | undefined,
): void {
  if (items === undefined || items.length === 0) {
    return;
  }
  sections.push({ key, label, items });
}

/** Map one normalized operation to a nav row with distinct tags. */
function toNavItem(operation: NormalizedOpenApiOperation): OperationNavItem {
  const item: OperationNavItem = {
    identity: operation.identity,
    method: operation.method,
    path: operation.path,
    deprecated: operation.deprecated,
    tags: distinctStrings(operation.tags),
  };
  if (operation.summary !== undefined) {
    item.summary = operation.summary;
  }
  if (operation.operationId !== undefined) {
    item.operationId = operation.operationId;
  }
  return item;
}

/** First-seen unique strings (duplicate tags on one op collapse). */
function distinctStrings(values: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}
