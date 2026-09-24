/** Filter an operation nav model by substring query without clearing selection. */
import type {
  OperationNavItem,
  OperationNavModel,
  OperationNavSection,
} from "./build-operation-nav-model";

/** Filtered nav model plus whether the current selection is still visible. */
export type FilterOperationNavResult = {
  model: OperationNavModel;
  /** False when selectedIdentity is non-null and no visible row has it. */
  selectionVisible: boolean;
};

/**
 * Filter nav sections by a trimmed case-insensitive substring query.
 * Does not mutate the input or clear selection; reports selectionVisible.
 */
export function filterOperationNavModel(
  model: OperationNavModel,
  query: string,
  selectedIdentity: string | null,
): FilterOperationNavResult {
  const q = query.trim();
  const sections =
    q === "" ? copySections(model.sections) : filterSections(model.sections, q.toLowerCase());

  const filtered: OperationNavModel = {
    sections,
    // Unfiltered unique-identity total — used for empty-document checks, not visible rows.
    operationCount: model.operationCount,
  };

  return {
    model: filtered,
    selectionVisible: isSelectionVisible(filtered, selectedIdentity),
  };
}

/** Structural copy of sections keeping all items. */
function copySections(sections: ReadonlyArray<OperationNavSection>): OperationNavSection[] {
  return sections.map((section) => ({
    key: section.key,
    label: section.label,
    items: [...section.items],
  }));
}

/** Keep matching items; drop sections that retain zero items. */
function filterSections(
  sections: ReadonlyArray<OperationNavSection>,
  qLower: string,
): OperationNavSection[] {
  const out: OperationNavSection[] = [];
  for (const section of sections) {
    const items = section.items.filter((item) => itemMatches(item, section.label, qLower));
    if (items.length === 0) {
      continue;
    }
    out.push({ key: section.key, label: section.label, items });
  }
  return out;
}

/**
 * True when qLower is a substring of path, method, any item tag, section label,
 * summary, or operationId. Section key is never searched.
 */
function itemMatches(item: OperationNavItem, sectionLabel: string, qLower: string): boolean {
  if (containsInsensitive(item.path, qLower)) {
    return true;
  }
  if (containsInsensitive(item.method, qLower)) {
    return true;
  }
  if (containsInsensitive(sectionLabel, qLower)) {
    return true;
  }
  for (const tag of item.tags) {
    if (containsInsensitive(tag, qLower)) {
      return true;
    }
  }
  if (item.summary !== undefined && containsInsensitive(item.summary, qLower)) {
    return true;
  }
  if (item.operationId !== undefined && containsInsensitive(item.operationId, qLower)) {
    return true;
  }
  return false;
}

/** Case-insensitive substring check. */
function containsInsensitive(haystack: string, qLower: string): boolean {
  return haystack.toLowerCase().includes(qLower);
}

/** selectionVisible: null selection, or identity present in returned sections. */
function isSelectionVisible(model: OperationNavModel, selectedIdentity: string | null): boolean {
  if (selectedIdentity === null) {
    return true;
  }
  for (const section of model.sections) {
    for (const item of section.items) {
      if (item.identity === selectedIdentity) {
        return true;
      }
    }
  }
  return false;
}
