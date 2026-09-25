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

/** Pad a count like the mock (`02`). */
function padCount(n: number): string {
  return String(n).padStart(2, "0");
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
    <section data-section-key={section.key} className="flex min-w-0 flex-col gap-0.5">
      <div className="type-marker flex justify-between px-2.5 pb-1.5 text-text-faint">
        <span>{section.label}</span>
        <span>{padCount(section.items.length)}</span>
      </div>
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <p className="type-marker px-1.5 text-text-faint">
        — Reference · {padCount(model.operationCount)} endpoints
      </p>
      <input
        type="search"
        aria-label="Filter operations"
        placeholder="Filter endpoints"
        value={filterQuery}
        className={`type-body-sm h-10 w-full min-w-0 rounded-sm border border-border bg-disabled-fill px-3 text-text placeholder:text-text-faint ${CONTROL_FOCUS}`}
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
        <p className="type-body-sm px-2.5 text-text-muted">No operations in this document.</p>
      ) : null}
      {showNoMatch ? (
        <p className="type-body-sm px-2.5 text-text-muted">No endpoint matches that filter.</p>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
        {model.sections.map((section) => (
          <DocsOperationNavSection
            key={section.key}
            section={section}
            selectedIdentity={selectedIdentity}
            onSelectIdentity={onSelectIdentity}
          />
        ))}
      </div>
    </div>
  );
}
