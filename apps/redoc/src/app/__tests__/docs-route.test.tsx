/** AC-1 / AC-3 / AC-8: real Petstore bytes through loadDocsDocument into /docs. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { DocsRoute } from "@/app/docs";
import { loadDocsChrome } from "@/app/load-docs-chrome";
import { loadDocsDocument } from "@/app/load-docs-document";
import { operationNavPrimaryText } from "@/domains/docs/components/docs-operation-nav-row";
import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";
import { DocsShellScreen } from "@/domains/docs/screens/docs-shell-screen";
import { buildOperationNavModel } from "@/domains/openapi/api/build-operation-nav-model";

/** Provenance SHA-256 for the docs Petstore twin (same bytes as openapi fixture). */
const PETSTORE_SHA256 = "246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413";

const petstorePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../domains/docs/api/dev-petstore-3.0.json",
);

/** Load the committed docs Petstore twin as UTF-8 text. */
function petstoreText(): string {
  return readFileSync(petstorePath, "utf8");
}

/** Minimal matchMedia stub so DocsShell can mount under jsdom. */
function stubMatchMedia(matches = true): void {
  window.matchMedia = (query: string): MediaQueryList => {
    const mql = {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } satisfies {
      matches: boolean;
      media: string;
      onchange: null;
      addEventListener: (...args: never[]) => void;
      removeEventListener: (...args: never[]) => void;
      addListener: (...args: never[]) => void;
      removeListener: (...args: never[]) => void;
      dispatchEvent: (...args: never[]) => boolean;
    };
    return mql;
  };
}

describe("docs route chrome (AC-1 / AC-6)", () => {
  beforeEach(() => {
    stubMatchMedia(true);
  });

  it("loads Petstore bytes through loadDocsChrome and renders shell chrome", () => {
    const text = petstoreText();
    const digest = createHash("sha256").update(text).digest("hex");
    expect(digest).toBe(PETSTORE_SHA256);

    const chrome = loadDocsChrome(text);
    expect(chrome.ok).toBe(true);
    if (!chrome.ok) {
      throw new Error(`expected ok chrome, got: ${chrome.message}`);
    }
    expect(chrome.title).toBe("Swagger Petstore - OpenAPI 3.0");
    expect(chrome.version).toBe("1.0.27");

    const { container } = render(
      <DocsShellScreen
        title={chrome.title}
        version={chrome.version}
        nav={<DocsShellPlaceholder message="Navigation will list operations." />}
        main={<DocsShellPlaceholder message="Select an operation." />}
        rail={<DocsShellPlaceholder message="Schemas and examples appear here." />}
      />,
    );

    expect(container.querySelector(".band")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(chrome.title);
    expect(screen.getByText(chrome.version)).toBeInTheDocument();
  });

  it("returns ok:false with a message for whitespace-only input", () => {
    const chrome = loadDocsChrome("   \n\t  ");
    expect(chrome.ok).toBe(false);
    if (chrome.ok) {
      throw new Error("expected parse failure for whitespace-only input");
    }
    expect(chrome.message.toLowerCase()).toMatch(/openapi|document|paste/);
  });

  it("returns ok:false with a message for Swagger 2 JSON", () => {
    const chrome = loadDocsChrome(
      JSON.stringify({
        swagger: "2.0",
        info: { title: "Legacy", version: "1.0.0" },
        paths: {},
      }),
    );
    expect(chrome.ok).toBe(false);
    if (chrome.ok) {
      throw new Error("expected parse failure for Swagger 2");
    }
    expect(chrome.message.toLowerCase()).toContain("swagger");
  });

  it("falls back for whitespace-only title and version", () => {
    const chrome = loadDocsChrome(
      JSON.stringify({
        openapi: "3.0.3",
        info: { title: "  ", version: "" },
        paths: {},
      }),
    );
    expect(chrome.ok).toBe(true);
    if (!chrome.ok) {
      throw new Error(`expected ok chrome, got: ${chrome.message}`);
    }
    expect(chrome.title).toBe("Untitled document");
    expect(chrome.version).toBe("—");
  });
});

describe("docs route operation nav (AC-1 / AC-3 / AC-8)", () => {
  beforeEach(() => {
    stubMatchMedia(true);
  });

  it("lists every Petstore operation in Navigation from real fixture bytes", () => {
    const text = petstoreText();
    expect(createHash("sha256").update(text).digest("hex")).toBe(PETSTORE_SHA256);

    const loaded = loadDocsDocument(text);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      throw new Error(`expected ok document, got: ${loaded.message}`);
    }

    const navModel = buildOperationNavModel(loaded.document);
    expect(navModel.operationCount).toBe(19);
    expect(navModel.sections.map((section) => section.key)).toEqual(["pet", "store", "user"]);

    render(<DocsRoute />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(loaded.title);
    expect(screen.getByText(loaded.version)).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Filter operations" })).toBeInTheDocument();
    expect(screen.getByText("Select an operation.")).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Navigation" });
    for (const section of navModel.sections) {
      expect(nav.querySelector(`[data-section-key="${section.key}"]`)).not.toBeNull();
      for (const item of section.items) {
        const primary = operationNavPrimaryText(item);
        const row = within(nav).getByRole("button", {
          name: new RegExp(`${item.method.toUpperCase()}.*${escapeRegExp(primary)}`, "s"),
        });
        expect(row).toBeInTheDocument();
      }
    }
  });

  it("updates main selection chrome when a nav row is clicked", async () => {
    const user = userEvent.setup();
    const text = petstoreText();
    expect(createHash("sha256").update(text).digest("hex")).toBe(PETSTORE_SHA256);

    const loaded = loadDocsDocument(text);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      throw new Error(`expected ok document, got: ${loaded.message}`);
    }
    const first = buildOperationNavModel(loaded.document).sections[0]?.items[0];
    if (first === undefined) {
      throw new Error("expected at least one Petstore nav item");
    }

    render(<DocsRoute />);

    const nav = screen.getByRole("navigation", { name: "Navigation" });
    const primary = operationNavPrimaryText(first);
    await user.click(
      within(nav).getByRole("button", {
        name: new RegExp(`${first.method.toUpperCase()}.*${escapeRegExp(primary)}`, "s"),
      }),
    );

    const main = screen.getByRole("region", { name: "Operation" });
    const article = within(main).getByRole("article");
    const methodSpan = article.querySelector("span.uppercase");
    const pathSpan = methodSpan?.nextElementSibling;
    expect(methodSpan?.textContent).toBe(first.method);
    expect(pathSpan?.textContent).toBe(first.path);
    if (first.summary !== undefined && first.summary.trim().length > 0) {
      expect(within(article).getByRole("heading", { level: 2 })).toHaveTextContent(
        first.summary.trim(),
      );
    }
    expect(screen.queryByText("Select an operation.")).not.toBeInTheDocument();
  });
});

/** Escape a string for safe use inside a RegExp source. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
