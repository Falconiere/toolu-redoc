/** DocsShell structure, collapse, overflow, and FSAFE acceptance tests. */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";
import { DocsShellScreen } from "@/domains/docs/screens/docs-shell-screen";

/** Exact FSAFE corpus from the approved shell spec (T26). */
const FSAFE_CORPUS = [
  '<script>alert("xss")</script>',
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
  '"><a href="http://evil.example">click</a>',
] as const;

/** Viewport widths required by AC-4 / T25 shell slice. */
const VIEWPORT_WIDTHS = [375, 599, 600, 859, 860, 1119, 1120, 1399, 1400] as const;

/** 200-character path-like string for overflow checks. */
const LONG_PATH = `/${"segment/".repeat(25)}end`.slice(0, 200);

/** matchMedia stub listeners for change dispatch in tests. */
type MediaListener = (event: MediaQueryListEvent) => void;

const mediaListeners = new Set<MediaListener>();
let mediaMatches = true;

/** Install matchMedia + innerWidth stubs for a CSS pixel width. */
function stubViewport(width: number): void {
  mediaMatches = width >= 860;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.matchMedia = (query: string): MediaQueryList => {
    const listensToMd = query.includes("min-width: 860px");
    return {
      get matches() {
        return listensToMd ? mediaMatches : false;
      },
      media: query,
      onchange: null,
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "change" && typeof listener === "function") {
          mediaListeners.add(listener as MediaListener);
        }
      },
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "change" && typeof listener === "function") {
          mediaListeners.delete(listener as MediaListener);
        }
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  };
}

/** Flip the stubbed md matchMedia and notify subscribers. */
function setMdUp(matches: boolean): void {
  mediaMatches = matches;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: matches ? 860 : 375,
  });
  const event = {
    matches,
    media: "(min-width: 860px)",
  } as MediaQueryListEvent;
  for (const listener of mediaListeners) {
    listener(event);
  }
}

/** Render the shell screen with optional slot overrides. */
function renderShell(slots?: { nav?: ReactNode; main?: ReactNode; rail?: ReactNode }) {
  return render(
    <DocsShellScreen
      title="Fixture Docs"
      version="1.0.0"
      nav={slots?.nav ?? <DocsShellPlaceholder message="Navigation will list operations." />}
      main={slots?.main ?? <DocsShellPlaceholder message="Select an operation." />}
      rail={slots?.rail ?? <DocsShellPlaceholder message="Schemas and examples appear here." />}
    />,
  );
}

afterEach(() => {
  mediaListeners.clear();
  stubViewport(1024);
});

describe("DocsShellScreen", () => {
  it("AC-2: md-up shows three landmark siblings without column shadow classes", () => {
    stubViewport(860);
    const { container } = renderShell();
    const shellMain = container.querySelector("main.band");
    expect(shellMain).not.toBeNull();

    const nav = screen.getByRole("navigation", { name: "Navigation" });
    const operation = screen.getByRole("region", { name: "Operation" });
    const samples = screen.getByRole("region", { name: "Samples" });

    expect(nav).toBeVisible();
    expect(operation).toBeVisible();
    expect(samples).toBeVisible();

    for (const column of [nav, operation, samples]) {
      expect(column.className).not.toMatch(/shadow-card|shadow-panel/);
      expect(column.className).toMatch(/border-border/);
    }

    expect(nav.parentElement).toBe(operation.parentElement);
    expect(samples.parentElement).toBe(operation.parentElement);
  });

  it("AC-3: below md keeps Operation visible; drawers open/close with Escape restore", async () => {
    const user = userEvent.setup();
    stubViewport(375);
    renderShell({
      nav: <span>Nav body</span>,
      main: <span>Operation body</span>,
      rail: <span>Samples body</span>,
    });

    expect(screen.getByRole("region", { name: "Operation" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Navigation" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    const navButton = screen.getByRole("button", { name: "Navigation" });
    const samplesButton = screen.getByRole("button", { name: "Samples" });
    expect(navButton).toHaveAttribute("aria-expanded", "false");
    expect(samplesButton).toHaveAttribute("aria-expanded", "false");

    await user.click(navButton);
    expect(navButton).toHaveAttribute("aria-expanded", "true");
    const navDialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(navDialog).toHaveAttribute("aria-modal", "true");
    expect(within(navDialog).getByText("Nav body")).toBeVisible();
    expect(navDialog).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(navButton).toHaveFocus();
    expect(navButton).toHaveAttribute("aria-expanded", "false");

    await user.click(samplesButton);
    expect(samplesButton).toHaveAttribute("aria-expanded", "true");
    expect(navButton).toHaveAttribute("aria-expanded", "false");
    const samplesDialog = screen.getByRole("dialog", { name: "Samples" });
    expect(within(samplesDialog).getByText("Samples body")).toBeVisible();

    await user.keyboard("{Escape}");
    expect(samplesButton).toHaveFocus();
  });

  it("AC-4: every listed width keeps regions reachable without page overflow", async () => {
    const user = userEvent.setup();
    for (const width of VIEWPORT_WIDTHS) {
      stubViewport(width);
      const { container, unmount } = renderShell({
        main: <p>{LONG_PATH}</p>,
      });

      const operation = screen.getByRole("region", { name: "Operation" });
      expect(operation).toBeVisible();
      expect(within(operation).getByText(LONG_PATH)).toBeInTheDocument();

      if (width >= 860) {
        expect(screen.getByRole("navigation", { name: "Navigation" })).toBeVisible();
        expect(screen.getByRole("region", { name: "Samples" })).toBeVisible();
      } else {
        await user.click(screen.getByRole("button", { name: "Navigation" }));
        expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();
        await user.keyboard("{Escape}");
        await user.click(screen.getByRole("button", { name: "Samples" }));
        expect(screen.getByRole("dialog", { name: "Samples" })).toBeVisible();
        await user.keyboard("{Escape}");
      }

      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
        document.documentElement.clientWidth + 1,
      );
      expect(container.querySelector("main.band")).not.toBeNull();
      unmount();
    }
  });

  it("AC-5: FSAFE corpus stays inert text with no script nodes or fetch", () => {
    stubViewport(860);
    for (const payload of FSAFE_CORPUS) {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
        throw new Error("fetch must not run during docs shell render");
      });

      const { container, unmount } = renderShell({
        nav: payload,
        main: payload,
        rail: payload,
      });

      const shell = container.querySelector("main.band");
      expect(shell).not.toBeNull();
      if (shell === null) {
        throw new Error("expected band main");
      }

      expect(shell.textContent).toContain(payload);
      expect(shell.querySelector("script")).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
      unmount();
    }
  });

  it("force-closes drawers when matchMedia flips to md-up", async () => {
    const user = userEvent.setup();
    stubViewport(375);
    renderShell({ nav: <span>Nav body</span> });

    await user.click(screen.getByRole("button", { name: "Navigation" }));
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();

    act(() => {
      setMdUp(true);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Navigation" })).toBeVisible();
    expect(document.activeElement?.closest("main")).not.toBeNull();
  });
});
