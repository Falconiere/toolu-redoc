/** AC-1..7: OperationDetail from real parse → map fixtures (no mocked ops). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mapOperationDetail } from "@/app/map-operation-detail";
import { OperationDetail } from "@/domains/docs/components/operation-detail";
import type { OperationDetailModel } from "@/domains/docs/api/operation-detail-model";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";

const openapiFixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../openapi/__tests__/fixtures",
);
const docsPetstore = join(dirname(fileURLToPath(import.meta.url)), "../api/dev-petstore-3.0.json");

/** Exact FSAFE corpus from the shell spec (T26 detail slice). */
const FSAFE_CORPUS = [
  '<script>alert("xss")</script>',
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
  '"><a href="http://evil.example">click</a>',
] as const;

/** Read a committed fixture as UTF-8. */
function readFixture(dir: string, name: string): string {
  return readFileSync(join(dir, name), "utf8");
}

/** Parse + map all operations from a fixture file. */
function mapFixture(name: string, dir = openapiFixtures): OperationDetailModel[] {
  const parsed = parseOpenApiDocument(readFixture(dir, name));
  if (!parsed.ok) {
    throw new Error(`${name}: ${parsed.error.message}`);
  }
  expect(parsed.document.operations.length).toBeGreaterThan(0);
  return parsed.document.operations.map((operation) =>
    mapOperationDetail(operation, parsed.document.servers),
  );
}

/** Find an operation by method + path. */
function byPath(
  models: OperationDetailModel[],
  method: string,
  path: string,
): OperationDetailModel {
  const found = models.find((model) => model.method === method && model.path === path);
  if (found === undefined) {
    throw new Error(`missing ${method.toUpperCase()} ${path}`);
  }
  return found;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OperationDetail acceptance", () => {
  it("AC-1: every Petstore operation renders method + path without throw", () => {
    const models = mapFixture("dev-petstore-3.0.json", dirname(docsPetstore));
    const parsed = parseOpenApiDocument(
      readFixture(dirname(docsPetstore), "dev-petstore-3.0.json"),
    );
    if (!parsed.ok) {
      throw new Error(parsed.error.message);
    }
    expect(models.length).toBe(parsed.document.operations.length);
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      const { unmount } = render(<OperationDetail operation={model} />);
      const article = screen.getByRole("article");
      const methodSpan = article.querySelector("span.uppercase");
      const pathSpan = methodSpan?.nextElementSibling;
      expect(methodSpan?.textContent).toBe(model.method);
      expect(pathSpan?.textContent).toBe(model.path);
      unmount();
    }
  });

  it("AC-2: param-merge table shows merge wins, dual limit, and missing path issue", () => {
    const models = mapFixture("param-merge.json");
    const pets = byPath(models, "get", "/pets/{petId}");
    render(<OperationDetail operation={pets} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("operation limit wins")).toBeInTheDocument();
    const limitRows = within(table)
      .getAllByText("limit")
      .map((cell) => cell.closest("tr"));
    expect(limitRows.length).toBeGreaterThanOrEqual(2);
    const inValues = limitRows.map((row) =>
      row === null ? "" : (within(row).getAllByRole("cell")[1]?.textContent ?? ""),
    );
    expect(inValues).toEqual(expect.arrayContaining(["query", "header"]));

    const items = byPath(models, "get", "/items/{itemId}");
    const { unmount } = render(<OperationDetail operation={items} />);
    expect(screen.getByText("Path parameter `itemId`: missing")).toBeInTheDocument();
    expect(screen.getByText("verbose")).toBeInTheDocument();
    unmount();
  });

  it("AC-3: bodies fixture media types, statuses, header, 204 empty, focus updates", async () => {
    const user = userEvent.setup();
    const onFocusChange = vi.fn();
    const upload = mapFixture("operation-detail-bodies.json")[0];
    if (upload === undefined) {
      throw new Error("missing upload op");
    }
    render(<OperationDetail operation={upload} onFocusChange={onFocusChange} />);

    const requestMedia = screen.getByRole("group", { name: "Request media type" });
    for (const media of [
      "application/json",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
    ]) {
      expect(within(requestMedia).getByRole("radio", { name: media })).toBeInTheDocument();
    }
    const statusBox = screen.getByRole("group", { name: "Response status" });
    for (const status of ["200", "default", "2XX", "204"]) {
      expect(within(statusBox).getByRole("radio", { name: status })).toBeInTheDocument();
    }
    expect(screen.getByText(/X-RateLimit/)).toBeInTheDocument();

    await user.click(within(statusBox).getByRole("radio", { name: "204" }));
    expect(screen.getByText("No response body.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Response media type" })).toBeNull();

    const focusCalls = onFocusChange.mock.calls.map((call: unknown[]): unknown => call[0]);
    expect(
      focusCalls.some(
        (focus) =>
          typeof focus === "object" &&
          focus !== null &&
          "kind" in focus &&
          focus.kind === "response" &&
          "status" in focus &&
          focus.status === "204",
      ),
    ).toBe(true);

    await user.click(within(statusBox).getByRole("radio", { name: "200" }));
    expect(screen.queryByText("No response body.")).toBeNull();
  });

  it("AC-3 smoke: Petstore PUT /pet and GET /pet/{petId}", () => {
    const models = mapFixture("dev-petstore-3.0.json", dirname(docsPetstore));
    const putPet = byPath(models, "put", "/pet");
    expect(putPet.requestBody?.mediaTypes).toContain("application/json");
    const { unmount } = render(<OperationDetail operation={putPet} />);
    expect(screen.getByText("/pet")).toBeInTheDocument();
    unmount();

    const getPet = byPath(models, "get", "/pet/{petId}");
    render(<OperationDetail operation={getPet} />);
    expect(screen.getByText("petId")).toBeInTheDocument();
  });

  it("AC-4: meta fallbacks, deprecated marker, op servers, no execute controls", () => {
    const models = mapFixture("operation-detail-meta.json");
    const bare = byPath(models, "get", "/bare");
    const { unmount } = render(<OperationDetail operation={bare} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("/bare");
    expect(screen.getByText(/operationId: —/)).toBeInTheDocument();
    expect(screen.queryByText("Still readable")).toBeNull();
    unmount();

    const legacy = byPath(models, "get", "/legacy");
    const { container } = render(<OperationDetail operation={legacy} />);
    expect(screen.getByText("Deprecated")).toBeInTheDocument();
    expect(screen.getByText("https://op.example/{tenant}")).toBeInTheDocument();
    expect(screen.getByText("tenant=acme")).toBeInTheDocument();
    expect(screen.queryByText(/root\.example/)).toBeNull();
    expect(container.textContent.toLowerCase()).not.toMatch(/execute|try it|try-it/);
  });

  it("AC-5: examples.json falsy / external / media precedence; no fetch", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const demo = mapFixture("examples.json")[0];
    if (demo === undefined) {
      throw new Error("missing demo");
    }
    render(<OperationDetail operation={demo} />);
    const request = screen.getByLabelText("Request body");
    expect(within(request).getByText("false")).toBeInTheDocument();

    const exampleBox = within(request).getByRole("group", { name: "Request example" });
    await user.click(within(exampleBox).getByRole("radio", { name: "zero" }));
    expect(within(request).getByText("0")).toBeInTheDocument();
    await user.click(within(exampleBox).getByRole("radio", { name: "empty" }));
    expect(within(request).getByLabelText("Example value")).toHaveTextContent("");
    await user.click(within(exampleBox).getByRole("radio", { name: "nil" }));
    expect(within(request).getByText("null")).toBeInTheDocument();
    await user.click(within(exampleBox).getByRole("radio", { name: /External example URL/ }));
    expect(
      within(request).getByText(/externalValue: https:\/\/example.com\/examples\/payload.json/),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("AC-6: null operation shows empty copy without tables", () => {
    render(<OperationDetail operation={null} />);
    expect(screen.getByText("Select an operation.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByLabelText("Request body")).toBeNull();
    expect(screen.queryByLabelText("Responses")).toBeNull();
  });

  it("emits a single default focus on mount and on operation change", () => {
    const onFocusChange = vi.fn();
    const upload = mapFixture("operation-detail-bodies.json")[0];
    const bare = byPath(mapFixture("operation-detail-meta.json"), "get", "/bare");
    if (upload === undefined) {
      throw new Error("missing upload op");
    }
    const { rerender } = render(
      <OperationDetail operation={upload} onFocusChange={onFocusChange} />,
    );
    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onFocusChange.mock.calls[0]?.[0]).not.toBeNull();

    onFocusChange.mockClear();
    rerender(<OperationDetail operation={bare} onFocusChange={onFocusChange} />);
    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onFocusChange.mock.calls[0]?.[0]).toMatchObject({
      kind: "response",
      status: bare.responses[0]?.status,
    });

    onFocusChange.mockClear();
    rerender(<OperationDetail operation={null} onFocusChange={onFocusChange} />);
    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledWith(null);
  });

  it("AC-7: FSAFE strings stay inert text with zero fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const models = mapFixture("operation-detail-meta.json");
    const bare = byPath(models, "get", "/bare");
    const poisoned: OperationDetailModel = {
      ...bare,
      description: FSAFE_CORPUS.join("\n"),
      parameters: [
        {
          name: FSAFE_CORPUS[0],
          in: "query",
          required: false,
          deprecated: false,
          description: FSAFE_CORPUS[1],
          typeSummary: "string",
          schemaHandle: {
            kind: "parameter",
            name: FSAFE_CORPUS[0],
            in: "query",
            typeSummary: "string",
            ref: null,
          },
        },
      ],
      requestBody: {
        description: null,
        required: false,
        mediaTypes: ["application/json"],
        contents: {
          "application/json": {
            typeSummary: "string",
            schemaHandle: {
              kind: "request",
              mediaType: "application/json",
              typeSummary: "string",
              ref: null,
              exampleKey: null,
              exampleValue: FSAFE_CORPUS[2],
              externalValue: null,
            },
            defaultExampleKey: null,
            singularExample: { present: true, value: FSAFE_CORPUS[2] },
            namedExamples: [],
          },
        },
      },
    };
    const { container } = render(<OperationDetail operation={poisoned} />);
    for (const sample of FSAFE_CORPUS) {
      expect(container.textContent).toContain(sample);
    }
    expect(container.querySelector("script")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
