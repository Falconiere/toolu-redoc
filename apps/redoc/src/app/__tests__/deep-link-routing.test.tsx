/** Deep-link routing: url+op load, history push/back, paste pending op (T20/T21). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ComposeLoadedDocs } from "@/app/compose-loaded-docs";
import {
  startFixtureHttpServer,
  type FixtureHttpServer,
} from "@/domains/openapi/__tests__/fixture-http-server";
import { encodeOperationIdentity } from "@/domains/openapi/api/operation-identity";
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";
import { mergeOperationSearch } from "@/domains/openapi/api/write-operation-search";
import { MISSING_SOURCE_MESSAGE, SpecLoadScreen } from "@/domains/openapi/screens/spec-load-screen";
import { UNKNOWN_OPERATION_TITLE } from "@/domains/docs/components/unknown-operation-empty";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../domains/openapi/__tests__/fixtures",
);

/** Load committed Petstore fixture bytes. */
function petstoreText(): string {
  return readFileSync(join(fixturesDir, "petstore-3.0.json"), "utf8");
}

/** Load committed empty-paths fixture bytes. */
function emptyPathsText(): string {
  return readFileSync(join(fixturesDir, "empty-paths.json"), "utf8");
}

let server: FixtureHttpServer | undefined;

afterEach(async () => {
  if (server !== undefined) {
    await server.close();
    server = undefined;
  }
});

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

beforeEach(() => {
  stubMatchMedia();
});

/**
 * Memory history harness mirroring `/` navigate: push on select, replace on reset.
 * Renders SpecLoadScreen with renderLoaded → ComposeLoadedDocs.
 */
function DeepLinkHarness({ initial }: { initial: SpecLoadSearch }) {
  const [stack, setStack] = useState<SpecLoadSearch[]>([initial]);
  const [index, setIndex] = useState(0);
  const search = stack[index] ?? {};

  const navigateSearch = (next: SpecLoadSearch, replace: boolean): void => {
    setStack((prev) => {
      if (replace) {
        const copy = prev.slice(0, index + 1);
        copy[index] = next;
        return copy;
      }
      return [...prev.slice(0, index + 1), next];
    });
    if (!replace) {
      setIndex((i) => i + 1);
    }
  };

  return (
    <div>
      <p data-testid="search-op">{search.op ?? ""}</p>
      <p data-testid="search-url">{search.url ?? ""}</p>
      <p data-testid="history-index">{index}</p>
      <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
        History back
      </button>
      <button type="button" onClick={() => setIndex((i) => Math.min(stack.length - 1, i + 1))}>
        History forward
      </button>
      <SpecLoadScreen
        search={search}
        onSourceUrlChange={(href) => {
          navigateSearch({ ...search, url: href }, false);
        }}
        renderLoaded={({ success, reset }) => (
          <ComposeLoadedDocs
            success={success}
            search={search}
            shareOrigin="http://localhost:5173"
            onOperationChange={(op, options) => {
              navigateSearch(mergeOperationSearch(search, op), options.replace);
            }}
            onReset={() => {
              navigateSearch(mergeOperationSearch(search, undefined), true);
              reset();
            }}
          />
        )}
      />
    </div>
  );
}

describe("deep-link routing", () => {
  it("auto-loads url+op and selects get /pet/findByStatus (AC-1 / T20)", async () => {
    server = await startFixtureHttpServer();
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    const url = `${server.baseUrl}/fixtures/petstore.json`;

    render(<DeepLinkHarness initial={{ url, op }} />);

    await waitFor(() => {
      expect(screen.getByTestId("loaded-docs-viewer")).toBeInTheDocument();
    });
    expect(screen.getByText("/pet/findByStatus")).toBeInTheDocument();
    expect(screen.getByTestId("search-op")).toHaveTextContent(op);
  });

  it("pushes history on select and restores with Back (AC-2 / AC-3)", async () => {
    server = await startFixtureHttpServer();
    const first = encodeOperationIdentity("get", "/pet/findByStatus");
    const second = encodeOperationIdentity("get", "/store/inventory");
    const url = `${server.baseUrl}/fixtures/petstore.json`;

    render(<DeepLinkHarness initial={{ url, op: first }} />);

    await waitFor(() => {
      expect(screen.getByTestId("loaded-docs-viewer")).toBeInTheDocument();
    });

    const nav = screen.getByRole("navigation", { name: "Navigation" });
    fireEvent.click(
      within(nav).getByRole("button", { name: /Returns pet inventories by status/i }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-op")).toHaveTextContent(second);
    });
    expect(screen.getByText("/store/inventory")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /history back/i }));
    await waitFor(() => {
      expect(screen.getByTestId("search-op")).toHaveTextContent(first);
    });
    expect(screen.getByText("/pet/findByStatus")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /history forward/i }));
    await waitFor(() => {
      expect(screen.getByTestId("search-op")).toHaveTextContent(second);
    });
  });

  it("pending op after paste selects; wrong paste → unknown (AC-6 / AC-7 / T21)", async () => {
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    render(<DeepLinkHarness initial={{ op }} />);

    expect(screen.getByText(MISSING_SOURCE_MESSAGE)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /paste/i }), {
      target: { value: petstoreText() },
    });
    fireEvent.click(screen.getByRole("button", { name: /parse paste/i }));

    await waitFor(() => {
      expect(screen.getByTestId("loaded-docs-viewer")).toBeInTheDocument();
    });
    expect(screen.getByText("/pet/findByStatus")).toBeInTheDocument();
    expect(screen.getByTestId("search-op")).toHaveTextContent(op);
  });

  it("paste of empty-paths with pending op yields unknown (AC-7)", async () => {
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    render(<DeepLinkHarness initial={{ op }} />);

    fireEvent.change(screen.getByRole("textbox", { name: /paste/i }), {
      target: { value: emptyPathsText() },
    });
    fireEvent.click(screen.getByRole("button", { name: /parse paste/i }));

    await waitFor(() => {
      expect(screen.getByTestId("loaded-docs-viewer")).toBeInTheDocument();
    });
    expect(screen.getByText(UNKNOWN_OPERATION_TITLE)).toBeInTheDocument();
    expect(screen.getByTestId("search-op")).toHaveTextContent(op);
  });
});
