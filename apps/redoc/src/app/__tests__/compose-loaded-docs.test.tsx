/** ComposeLoadedDocs: selection, filter smoke, unknown op, share disclosure. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ComposeLoadedDocs } from "@/app/compose-loaded-docs";
import { UNKNOWN_OPERATION_TITLE } from "@/domains/docs/components/unknown-operation-empty";
import { encodeOperationIdentity } from "@/domains/openapi/api/operation-identity";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";
import type { SpecLoadSuccess } from "@/domains/openapi/api/load-openapi-document";
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";
import { SHARE_URL_QUERY_DISCLOSURE } from "@/domains/openapi/components/share-operation-link";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../domains/openapi/__tests__/fixtures",
);

/** Load committed Petstore fixture bytes. */
function petstoreText(): string {
  return readFileSync(join(fixturesDir, "petstore-3.0.json"), "utf8");
}

/** Build a SpecLoadSuccess from Petstore paste. */
function petstoreSuccess(kind: "paste" | "url" = "paste", href?: string): SpecLoadSuccess {
  const parsed = parseOpenApiDocument(petstoreText());
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return {
    document: parsed.document,
    source: {
      kind,
      ...(href === undefined ? {} : { href }),
      redirectCount: 0,
    },
  };
}

/** Minimal matchMedia stub so DocsShell can mount under jsdom. */
function stubMatchMedia(): void {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

describe("ComposeLoadedDocs", () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it("selects get /pet/findByStatus from op and shows detail (AC-1)", async () => {
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    render(
      <ComposeLoadedDocs
        success={petstoreSuccess()}
        search={{ op }}
        onOperationChange={() => {}}
        onReset={() => {}}
        shareOrigin="http://localhost:5173"
      />,
    );

    expect(screen.getByTestId("loaded-docs-viewer")).toBeInTheDocument();
    expect(screen.getByText(/Swagger Petstore/i)).toBeInTheDocument();
    expect(screen.getByText("/pet/findByStatus")).toBeInTheDocument();
    // OperationDetail default-focuses; Samples rail maps via #7 SchemaRail.
    expect(await screen.findByLabelText("Schema rail")).toBeInTheDocument();
  });

  it("calls onOperationChange with push when a nav row is clicked (AC-2)", () => {
    const onOperationChange = vi.fn();
    const first = encodeOperationIdentity("get", "/pet/findByStatus");
    render(
      <ComposeLoadedDocs
        success={petstoreSuccess()}
        search={{ op: first }}
        onOperationChange={onOperationChange}
        onReset={() => {}}
        shareOrigin="http://localhost:5173"
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Navigation" });
    const inventory = within(nav).getByRole("button", {
      name: /Returns pet inventories by status/i,
    });
    fireEvent.click(inventory);
    expect(onOperationChange).toHaveBeenCalledWith(
      encodeOperationIdentity("get", "/store/inventory"),
      { replace: false },
    );
  });

  it("narrows filter then clears (AC-4 smoke)", () => {
    render(
      <ComposeLoadedDocs
        success={petstoreSuccess()}
        search={{}}
        onOperationChange={() => {}}
        onReset={() => {}}
        shareOrigin="http://localhost:5173"
      />,
    );

    const filter = screen.getByRole("searchbox", { name: /filter operations/i });
    const before = screen.getAllByRole("button").length;
    fireEvent.change(filter, { target: { value: "  InVeNtOrY  " } });
    const after = screen.getAllByRole("button").length;
    expect(after).toBeLessThan(before);
    fireEvent.change(filter, { target: { value: "" } });
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(after);
  });

  it("shows unknown empty for malformed op and keeps share op (AC-5)", () => {
    render(
      <ComposeLoadedDocs
        success={petstoreSuccess()}
        search={{ op: "not-json" }}
        onOperationChange={() => {}}
        onReset={() => {}}
        shareOrigin="http://localhost:5173"
      />,
    );

    expect(screen.getByText(UNKNOWN_OPERATION_TITLE)).toBeInTheDocument();
    expect(screen.queryByText("Select an operation.")).toBeNull();
    expect(screen.getByTestId("share-href").textContent).toContain("op=not-json");
  });

  it("discloses query-bearing source URL on share (AC-9)", () => {
    const source = "https://example.com/openapi.json?a=1&b=2";
    render(
      <ComposeLoadedDocs
        success={petstoreSuccess("url", source)}
        search={{ url: source, op: encodeOperationIdentity("get", "/pet/findByStatus") }}
        onOperationChange={() => {}}
        onReset={() => {}}
        shareOrigin="http://localhost:5173"
      />,
    );

    expect(screen.getByTestId("share-url-query-disclosure")).toHaveTextContent(
      SHARE_URL_QUERY_DISCLOSURE,
    );
    const href = screen.getByTestId("share-href").textContent;
    expect(href.length).toBeGreaterThan(0);
    const parsed = new URL(href);
    expect(parsed.searchParams.get("url")).toBe(source);
  });

  it("becomes unknown when op is absent from a replaced empty document (AC-10)", () => {
    const emptyParsed = parseOpenApiDocument(
      readFileSync(join(fixturesDir, "empty-paths.json"), "utf8"),
    );
    expect(emptyParsed.ok).toBe(true);
    if (!emptyParsed.ok) {
      throw new Error(emptyParsed.error.message);
    }
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    const { rerender } = render(
      <ComposeLoadedDocs
        success={petstoreSuccess()}
        search={{ op }}
        onOperationChange={() => {}}
        onReset={() => {}}
        shareOrigin="http://localhost:5173"
      />,
    );
    expect(screen.getByText("/pet/findByStatus")).toBeInTheDocument();

    rerender(
      <ComposeLoadedDocs
        success={{
          document: emptyParsed.document,
          source: { kind: "paste", redirectCount: 0 },
        }}
        search={{ op }}
        onOperationChange={() => {}}
        onReset={() => {}}
        shareOrigin="http://localhost:5173"
      />,
    );
    expect(screen.getByText(UNKNOWN_OPERATION_TITLE)).toBeInTheDocument();
    expect(
      within(screen.getByTestId("loaded-docs-viewer")).queryByText("/pet/findByStatus"),
    ).toBeNull();
  });
});

describe("ComposeLoadedDocs search typing", () => {
  it("accepts SpecLoadSearch without unused imports", () => {
    const search: SpecLoadSearch = {};
    expect(search.op).toBeUndefined();
  });
});
