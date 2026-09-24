/** Tag-grouped operation nav with filter field — DTO props only (no openapi). */
import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";
import { DocsOperationNavRow } from "@/domains/docs/components/docs-operation-nav-row";

/** One selectable row under a tag section (docs-local duplicate of openapi DTO). */
export type OperationNavItem = {
  identity: string;
  method: string;
  path: string;
  summary?: string;
  operationId?: string;
  deprecated: boolean;
  /** Distinct tag names from the operation (empty ⇒ tagless). */
  tags: string[];
};

/** One tag heading + its rows. */
export type OperationNavSection = {
  /** Tag name, or sentinel `__toolu.untagged__` for the tagless bucket. */
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

/** Props for the filtered operation nav sidebar. */
export type DocsOperationNavProps = {
  /** Already-filtered nav model from the route. */
  model: OperationNavModel;
  /** Current filter query string (controlled). */
  filterQuery: string;
  /** Updates the filter query; Clear filter passes `""`. */
  onFilterQueryChange: (query: string) => void;
  /** Currently selected operation identity, or null. */
  selectedIdentity: string | null;
  /** Called when a row is activated. */
  onSelectIdentity: (identity: string) => void;
  /** False when selection exists but no visible row shows it. */
  selectionVisible: boolean;
};

/** True when the document has no operations (ignore filter query). */
function isEmptyDocument(model: OperationNavModel): boolean {
  return model.operationCount === 0;
}

/** Filtered-out selection notice plus Clear filter control. */
function SelectionHiddenNotice({ onClearFilter }: { onClearFilter: () => void }) {
  return (
    <div className="space-y-2 border border-border p-2">
      <p className="type-meta text-text-faint">Selected operation is hidden by the filter.</p>
      <button
        type="button"
        className={`type-button rounded-xs border border-border bg-background px-2 py-1 text-text transition duration-(--duration-hover) ease-signal hover:border-accent active:translate-y-px ${CONTROL_FOCUS}`}
        onClick={onClearFilter}
      >
        Clear filter
      </button>
    </div>
  );
}

/** One tag section with heading and operation rows. */
function DocsOperationNavSection({
  section,
  selectedIdentity,
  onSelectIdentity,
}: {
  section: OperationNavSection;
  selectedIdentity: string | null;
  onSelectIdentity: (identity: string) => void;
}) {
  return (
    <section data-section-key={section.key} className="min-w-0 space-y-1">
      <h3 className="type-label text-text">{section.label}</h3>
      <ul className="min-w-0 space-y-0.5">
        {section.items.map((item) => (
          <li key={`${section.key}:${item.identity}`} className="min-w-0">
            <DocsOperationNavRow
              item={item}
              selected={selectedIdentity === item.identity}
              onSelectIdentity={onSelectIdentity}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Filter input + tag sections + rows. No second focus trap — controls join the
 * shell drawer / document tab order. Empty and filtered-out messages per spec.
 */
export function DocsOperationNav({
  model,
  filterQuery,
  onFilterQueryChange,
  selectedIdentity,
  onSelectIdentity,
  selectionVisible,
}: DocsOperationNavProps) {
  const showHiddenNotice = !selectionVisible && selectedIdentity !== null;
  const showEmptyDocument = isEmptyDocument(model);
  const showNoMatch =
    !showEmptyDocument && filterQuery.trim() !== "" && model.sections.length === 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <input
        type="search"
        aria-label="Filter operations"
        value={filterQuery}
        className={`type-body-sm w-full min-w-0 rounded-xs border border-border bg-background px-2 py-1.5 text-text ${CONTROL_FOCUS}`}
        onChange={(event) => {
          onFilterQueryChange(event.target.value);
        }}
      />
      {showHiddenNotice ? (
        <SelectionHiddenNotice
          onClearFilter={() => {
            onFilterQueryChange("");
          }}
        />
      ) : null}
      {showEmptyDocument ? (
        <p className="type-meta text-text-faint">No operations in this document.</p>
      ) : null}
      {showNoMatch ? <p className="type-meta text-text-faint">No matching operations.</p> : null}
      {model.sections.map((section) => (
        <DocsOperationNavSection
          key={section.key}
          section={section}
          selectedIdentity={selectedIdentity}
          onSelectIdentity={onSelectIdentity}
        />
      ))}
    </div>
  );
}
