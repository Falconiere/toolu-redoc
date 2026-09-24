/** AC-1 / AC-6: real Petstore bytes through loadDocsChrome into DocsShellScreen. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { loadDocsChrome } from "@/app/load-docs-chrome";
import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";
import { DocsShellScreen } from "@/domains/docs/screens/docs-shell-screen";

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
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
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
    expect(chrome.message.toLowerCase()).toMatch(/empty|document|yaml|json/);
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
