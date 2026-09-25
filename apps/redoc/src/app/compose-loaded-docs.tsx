/** App composition helper: loaded OpenAPI success + search → DocsShell slots. */
import { useMemo, useState, type ReactNode } from "react";

import { mapOperationDetail } from "@/app/map-operation-detail";
import { mapSchemaFocusLabel } from "@/app/map-schema-focus-label";
import { DocsOperationNav } from "@/domains/docs/components/docs-operation-nav";
import { DocsShell } from "@/domains/docs/components/docs-shell";
import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";
import { UnknownOperationEmpty } from "@/domains/docs/components/unknown-operation-empty";
import { OperationDetail } from "@/domains/docs/components/operation-detail";
import type { OperationDetailModel, SchemaFocus } from "@/domains/docs/api/operation-detail-model";
import {
  buildOperationNavModel,
  type OperationNavModel,
} from "@/domains/openapi/api/build-operation-nav-model";
import { filterOperationNavModel } from "@/domains/openapi/api/filter-operation-nav-model";
import type { SpecLoadSuccess } from "@/domains/openapi/api/load-openapi-document";
import {
  resolveOperationSelection,
  type OperationSelection,
} from "@/domains/openapi/api/resolve-operation-selection";
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";
import type { WriteOpOptions } from "@/domains/openapi/api/write-operation-search";
import type { ShareOperationLinkProps } from "@/domains/openapi/components/share-operation-link";
import { LoadedDocsToolbar } from "@/domains/openapi/components/loaded-docs-toolbar";

/** Props for {@link ComposeLoadedDocs}. */
export type ComposeLoadedDocsProps = {
  success: SpecLoadSuccess;
  search: SpecLoadSearch;
  /** Write `op` (push on user select; replace on reset). */
  onOperationChange: (op: string | undefined, options: WriteOpOptions) => void;
  /** Clear load state and return to SpecLoad form. */
  onReset: () => void;
  /** Origin override for share href in tests. */
  shareOrigin?: string;
};

/** Build share props for the toolbar from search + source. */
function buildShareProps(
  search: SpecLoadSearch,
  source: SpecLoadSuccess["source"],
  shareOrigin: string | undefined,
): ShareOperationLinkProps {
  const originProps = shareOrigin === undefined ? {} : { origin: shareOrigin };
  if (source.href === undefined) {
    return { search, sourceKind: source.kind, ...originProps };
  }
  return { search, sourceKind: source.kind, sourceHref: source.href, ...originProps };
}

/**
 * Post-load `/` viewer: toolbar + DocsShell with op-driven selection and local filter.
 */
export function ComposeLoadedDocs({
  success,
  search,
  onOperationChange,
  onReset,
  shareOrigin,
}: ComposeLoadedDocsProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [focus, setFocus] = useState<SchemaFocus | null>(null);
  const { document, source } = success;

  const navModel = useMemo(() => buildOperationNavModel(document), [document]);
  const selection = resolveOperationSelection(search.op, document.operations);
  const selectedIdentity = selection.kind === "selected" ? selection.identity : null;
  const filtered = filterOperationNavModel(navModel, filterQuery, selectedIdentity);
  const detailModel = resolveDetailModel(document, selectedIdentity);

  return (
    <div className="band min-h-screen" data-testid="loaded-docs-viewer">
      <LoadedDocsToolbar
        title={document.info.title}
        version={document.info.version}
        share={buildShareProps(search, source, shareOrigin)}
        onReset={onReset}
        sourceSummary={<SourceSummary source={source} />}
      />
      <LoadedDocsShell
        filtered={filtered.model}
        filterQuery={filterQuery}
        onFilterQueryChange={setFilterQuery}
        selectedIdentity={selectedIdentity}
        selectionVisible={filtered.selectionVisible}
        selection={selection}
        detailModel={detailModel}
        focus={focus}
        onFocusChange={setFocus}
        onSelectIdentity={(identity) => {
          setFocus(null);
          onOperationChange(identity, { replace: false });
        }}
      />
    </div>
  );
}

/** Source kind/href meta line under the title. */
function SourceSummary({ source }: { source: SpecLoadSuccess["source"] }): ReactNode {
  const href = source.href;
  return (
    <p className="type-meta text-text-faint">
      source · {source.kind}
      {href !== undefined ? ` · ${href}` : ""}
    </p>
  );
}

/** Resolve OperationDetailModel for the selected identity, or null. */
function resolveDetailModel(
  document: SpecLoadSuccess["document"],
  selectedIdentity: string | null,
): OperationDetailModel | null {
  if (selectedIdentity === null) {
    return null;
  }
  const selectedOperation =
    document.operations.find((operation) => operation.identity === selectedIdentity) ?? null;
  if (selectedOperation === null) {
    return null;
  }
  return mapOperationDetail(selectedOperation, document.servers);
}

/** DocsShell slots for the loaded viewer (keeps ComposeLoadedDocs under line limits). */
function LoadedDocsShell({
  filtered,
  filterQuery,
  onFilterQueryChange,
  selectedIdentity,
  selectionVisible,
  selection,
  detailModel,
  focus,
  onFocusChange,
  onSelectIdentity,
}: {
  filtered: OperationNavModel;
  filterQuery: string;
  onFilterQueryChange: (query: string) => void;
  selectedIdentity: string | null;
  selectionVisible: boolean;
  selection: OperationSelection;
  detailModel: OperationDetailModel | null;
  focus: SchemaFocus | null;
  onFocusChange: (focus: SchemaFocus | null) => void;
  onSelectIdentity: (identity: string) => void;
}) {
  return (
    <DocsShell
      nav={
        <DocsOperationNav
          model={filtered}
          filterQuery={filterQuery}
          onFilterQueryChange={onFilterQueryChange}
          selectedIdentity={selectedIdentity}
          onSelectIdentity={onSelectIdentity}
          selectionVisible={selectionVisible}
        />
      }
      main={
        selection.kind === "unknown" ? (
          <UnknownOperationEmpty />
        ) : (
          <OperationDetail operation={detailModel} onFocusChange={onFocusChange} />
        )
      }
      rail={
        focus === null ? (
          <DocsShellPlaceholder message="Schemas and examples appear here." />
        ) : (
          <p className="type-meta text-text-muted">{mapSchemaFocusLabel(focus)}</p>
        )
      }
    />
  );
}
