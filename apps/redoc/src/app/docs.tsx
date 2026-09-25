/** Temporary `/docs` — Petstore nav + operation detail in DocsShell. */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { loadDocsDocument } from "@/app/load-docs-document";
import { mapOperationDetail } from "@/app/map-operation-detail";
import petstoreText from "@/domains/docs/api/dev-petstore-3.0.json?raw";
import { DocsOperationNav } from "@/domains/docs/components/docs-operation-nav";
import type { OperationNavItem } from "@/domains/docs/components/docs-operation-nav";
import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";
import { DocsShellScreen } from "@/domains/docs/screens/docs-shell-screen";
import { OperationDetail } from "@/domains/docs/components/operation-detail";
import type { SchemaFocus } from "@/domains/docs/api/operation-detail-model";
import {
  buildOperationNavModel,
  type OperationNavModel,
} from "@/domains/openapi/api/build-operation-nav-model";
import { filterOperationNavModel } from "@/domains/openapi/api/filter-operation-nav-model";

export const Route = createFileRoute("/docs")({
  component: DocsRoute,
});

/** Parse the committed Petstore twin once at module load (static fixture). */
const LOADED_PETSTORE = loadDocsDocument(petstoreText);

/** Resolve a selected identity against the unfiltered nav model. */
function resolveSelectedItem(
  model: OperationNavModel,
  selectedIdentity: string | null,
): OperationNavItem | null {
  if (selectedIdentity === null) {
    return null;
  }
  for (const section of model.sections) {
    for (const item of section.items) {
      if (item.identity === selectedIdentity) {
        return item;
      }
    }
  }
  return null;
}

/** Summarize SchemaFocus for the temporary Samples stub until #7. */
function focusStubLabel(focus: SchemaFocus): string {
  if (focus.kind === "parameter") {
    return `Schema focus: parameter ${focus.name} (${focus.in})`;
  }
  if (focus.kind === "request") {
    return `Schema focus: request ${focus.mediaType}`;
  }
  const media = focus.mediaType ?? "—";
  const header = focus.headerName !== null ? ` header ${focus.headerName}` : "";
  return `Schema focus: response ${focus.status} ${media}${header}`;
}

/**
 * Compose Petstore chrome + tag-grouped nav + operation detail, or an incident
 * note on parse failure. Selection and filter are route-local (no URL sync).
 */
export function DocsRoute() {
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [focus, setFocus] = useState<SchemaFocus | null>(null);

  const navModel = useMemo(() => {
    if (!LOADED_PETSTORE.ok) {
      return null;
    }
    return buildOperationNavModel(LOADED_PETSTORE.document);
  }, []);

  if (!LOADED_PETSTORE.ok) {
    return (
      <main className="band min-h-screen p-8">
        <p className="type-data text-danger">{LOADED_PETSTORE.message}</p>
      </main>
    );
  }

  if (navModel === null) {
    return (
      <main className="band min-h-screen p-8">
        <p className="type-data text-danger">Failed to build navigation model.</p>
      </main>
    );
  }

  const filtered = filterOperationNavModel(navModel, filterQuery, selectedIdentity);
  const selectedItem = resolveSelectedItem(navModel, selectedIdentity);
  const selectedOperation =
    selectedItem === null
      ? null
      : (LOADED_PETSTORE.document.operations.find(
          (operation) => operation.identity === selectedItem.identity,
        ) ?? null);
  const detailModel =
    selectedOperation === null
      ? null
      : mapOperationDetail(selectedOperation, LOADED_PETSTORE.document.servers);

  return (
    <DocsShellScreen
      title={LOADED_PETSTORE.title}
      version={LOADED_PETSTORE.version}
      nav={
        <DocsOperationNav
          model={filtered.model}
          filterQuery={filterQuery}
          onFilterQueryChange={setFilterQuery}
          selectedIdentity={selectedIdentity}
          onSelectIdentity={(identity) => {
            setSelectedIdentity(identity);
            setFocus(null);
          }}
          selectionVisible={filtered.selectionVisible}
        />
      }
      main={<OperationDetail operation={detailModel} onFocusChange={setFocus} />}
      rail={
        focus === null ? (
          <DocsShellPlaceholder message="Schemas and examples appear here." />
        ) : (
          <p className="type-meta text-text-muted">{focusStubLabel(focus)}</p>
        )
      }
    />
  );
}
