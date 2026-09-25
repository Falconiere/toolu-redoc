/** DocsOperationNav / Selection UI — click, filter banners, keyboard, overflow. */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DocsOperationNav,
  type OperationNavItem,
  type OperationNavModel,
} from "@/domains/docs/components/docs-operation-nav";
import { DocsOperationSelection } from "@/domains/docs/components/docs-operation-selection";
import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";
import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";
import { DocsShellScreen } from "@/domains/docs/screens/docs-shell-screen";

/** Viewport widths required by AC-7 / T25 nav slice. */
const VIEWPORT_WIDTHS = [375, 599, 600, 859, 860, 1119, 1120, 1399, 1400] as const;

/** 200-character path matching docs-shell overflow fixture length. */
const LONG_PATH = `/${"segment/".repeat(25)}end`.slice(0, 200);

/** FEDGE put identity — same shape production encodeOperationIdentity emits. */
const PUT_IDENTITY = '["put","/verbs"]';

/** FEDGE get identity. */
const GET_IDENTITY = '["get","/verbs"]';

/** Multi-tag put item as FEDGE builders emit (beta + undeclared). */
const PUT_ITEM: OperationNavItem = {
  identity: PUT_IDENTITY,
  method: "put",
  path: "/verbs",
  deprecated: false,
  tags: ["beta", "undeclared"],
};

/** Alpha get with operationId from FEDGE. */
const GET_ITEM: OperationNavItem = {
  identity: GET_IDENTITY,
  method: "get",
  path: "/verbs",
  operationId: "listVerbs",
  deprecated: false,
  tags: ["alpha"],
};

/** Hand-built FEDGE-shaped model — identities/paths match production builders. */
const FEDGE_NAV_MODEL: OperationNavModel = {
  operationCount: 8,
  sections: [
    {
      key: "alpha",
      label: "alpha",
      items: [
        GET_ITEM,
        {
          identity: '["post","/verbs"]',
          method: "post",
          path: "/verbs",
          deprecated: false,
          tags: ["alpha"],
        },
        {
          identity: '["trace","/verbs"]',
          method: "trace",
          path: "/verbs",
          deprecated: false,
          tags: ["alpha"],
        },
      ],
    },
    {
      key: "beta",
      label: "beta",
      items: [
        { ...PUT_ITEM },
        {
          identity: '["options","/verbs"]',
          method: "options",
          path: "/verbs",
          deprecated: false,
          tags: ["beta"],
        },
      ],
    },
    {
      key: "undeclared",
      label: "undeclared",
      items: [{ ...PUT_ITEM }],
    },
    {
      key: "ghost",
      label: "ghost",
      items: [
        {
          identity: '["patch","/verbs"]',
          method: "patch",
          path: "/verbs",
          deprecated: false,
          tags: ["ghost"],
        },
      ],
    },
    {
      key: "__toolu.untagged__",
      label: "Untagged",
      items: [
        {
          identity: '["delete","/verbs"]',
          method: "delete",
          path: "/verbs",
          deprecated: false,
          tags: [],
        },
        {
          identity: '["head","/verbs"]',
          method: "head",
          path: "/verbs",
          deprecated: false,
          tags: [],
        },
      ],
    },
  ],
};

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

afterEach(() => {
  mediaListeners.clear();
  stubViewport(1024);
});

/** Controlled nav harness for selection + filter prop updates. */
function NavHarness({
  initialModel = FEDGE_NAV_MODEL,
  initialFilter = "",
  initialSelected = null as string | null,
  selectionVisible = true,
}: {
  initialModel?: OperationNavModel;
  initialFilter?: string;
  initialSelected?: string | null;
  selectionVisible?: boolean;
}) {
  const [filterQuery, setFilterQuery] = useState(initialFilter);
  const [selectedIdentity, setSelectedIdentity] = useState(initialSelected);
  const [model, setModel] = useState(initialModel);
  const [visible, setVisible] = useState(selectionVisible);

  return (
    <DocsOperationNav
      model={model}
      filterQuery={filterQuery}
      selectedIdentity={selectedIdentity}
      selectionVisible={visible}
      onFilterQueryChange={(query) => {
        setFilterQuery(query);
        if (query === "") {
          setModel(FEDGE_NAV_MODEL);
          setVisible(true);
        }
      }}
      onSelectIdentity={setSelectedIdentity}
    />
  );
}

describe("DocsOperationNav", () => {
  it("AC-3: click updates selection; multi-tag identity shares aria-current", async () => {
    const user = userEvent.setup();
    const onSelectIdentity = vi.fn();
    const { rerender } = render(
      <DocsOperationNav
        model={FEDGE_NAV_MODEL}
        filterQuery=""
        selectedIdentity={null}
        selectionVisible={true}
        onFilterQueryChange={() => {}}
        onSelectIdentity={onSelectIdentity}
      />,
    );

    const beta = document.querySelector('[data-section-key="beta"]');
    expect(beta).not.toBeNull();
    if (beta === null) {
      throw new Error("expected beta section");
    }
    const putInBeta = within(beta as HTMLElement).getByRole("button", {
      name: /PUT\s+\/verbs/i,
    });
    await user.click(putInBeta);
    expect(onSelectIdentity).toHaveBeenCalledWith(PUT_IDENTITY);

    rerender(
      <DocsOperationNav
        model={FEDGE_NAV_MODEL}
        filterQuery=""
        selectedIdentity={PUT_IDENTITY}
        selectionVisible={true}
        onFilterQueryChange={() => {}}
        onSelectIdentity={onSelectIdentity}
      />,
    );

    const betaSection = document.querySelector('[data-section-key="beta"]');
    const undeclaredSection = document.querySelector('[data-section-key="undeclared"]');
    expect(betaSection).not.toBeNull();
    expect(undeclaredSection).not.toBeNull();
    if (betaSection === null || undeclaredSection === null) {
      throw new Error("expected beta and undeclared sections");
    }

    const betaPut = within(betaSection as HTMLElement).getByRole("button", {
      name: /PUT\s+\/verbs/i,
    });
    const undeclaredPut = within(undeclaredSection as HTMLElement).getByRole("button", {
      name: /PUT\s+\/verbs/i,
    });
    expect(betaPut).toHaveAttribute("aria-current", "true");
    expect(undeclaredPut).toHaveAttribute("aria-current", "true");
  });

  it("AC-6: tab reaches filter and a row; CONTROL_FOCUS classes present", async () => {
    const user = userEvent.setup();
    stubViewport(860);
    render(
      <DocsOperationNav
        model={FEDGE_NAV_MODEL}
        filterQuery=""
        selectedIdentity={null}
        selectionVisible={true}
        onFilterQueryChange={() => {}}
        onSelectIdentity={() => {}}
      />,
    );

    const filter = screen.getByRole("searchbox", { name: "Filter operations" });
    expect(filter.className).toContain("focus-visible:border-accent");
    for (const token of CONTROL_FOCUS.split(" ")) {
      expect(filter.className).toContain(token);
    }

    filter.focus();
    expect(filter).toHaveFocus();

    await user.tab();
    const focused = document.activeElement;
    expect(focused).not.toBeNull();
    expect(focused?.tagName).toBe("BUTTON");
    expect(focused?.className).toContain("focus-visible:border-accent");
    for (const token of CONTROL_FOCUS.split(" ")) {
      expect(focused?.className).toContain(token);
    }
  });

  it("AC-7: long path in nav keeps page scrollWidth within clientWidth+1", async () => {
    const user = userEvent.setup();
    const longItem: OperationNavItem = {
      identity: '["get","' + LONG_PATH + '"]',
      method: "get",
      path: LONG_PATH,
      deprecated: false,
      tags: ["alpha"],
    };
    const longModel: OperationNavModel = {
      operationCount: 1,
      sections: [{ key: "alpha", label: "alpha", items: [longItem] }],
    };

    for (const width of VIEWPORT_WIDTHS) {
      stubViewport(width);
      const { unmount } = render(
        <DocsShellScreen
          title="Fixture Docs"
          version="1.0.0"
          nav={
            <DocsOperationNav
              model={longModel}
              filterQuery=""
              selectedIdentity={null}
              selectionVisible={true}
              onFilterQueryChange={() => {}}
              onSelectIdentity={() => {}}
            />
          }
          main={<DocsShellPlaceholder message="Select an operation." />}
          rail={<DocsShellPlaceholder message="Schemas and examples appear here." />}
        />,
      );

      if (width >= 860) {
        expect(screen.getByRole("navigation", { name: "Navigation" })).toBeVisible();
        expect(screen.getByRole("button", { name: /GET/ })).toBeInTheDocument();
      } else {
        await user.click(screen.getByRole("button", { name: "Navigation" }));
        expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();
        expect(screen.getByRole("button", { name: /GET/ })).toBeInTheDocument();
        await user.keyboard("{Escape}");
      }

      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
        document.documentElement.clientWidth + 1,
      );
      unmount();
    }
  });

  it("shows no-results, filtered-out banner, and Clear filter", async () => {
    const user = userEvent.setup();
    render(
      <NavHarness
        initialModel={{ sections: [], operationCount: 8 }}
        initialFilter="zzz-no-match"
        initialSelected={PUT_IDENTITY}
        selectionVisible={false}
      />,
    );

    expect(screen.getByText("No endpoint matches that filter.")).toBeVisible();
    expect(screen.getByText("Selected operation is hidden by the filter.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(screen.queryByText("No endpoint matches that filter.")).toBeNull();
    expect(screen.queryByText("Selected operation is hidden by the filter.")).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Filter operations" })).toHaveValue("");
    expect(document.querySelector('[data-section-key="beta"]')).not.toBeNull();
  });

  it("shows empty-document message when unfiltered sections are empty", () => {
    render(
      <DocsOperationNav
        model={{ sections: [], operationCount: 0 }}
        filterQuery=""
        selectedIdentity={null}
        selectionVisible={true}
        onFilterQueryChange={() => {}}
        onSelectIdentity={() => {}}
      />,
    );
    expect(screen.getByText("No operations in this document.")).toBeVisible();
    expect(screen.queryByText("No endpoint matches that filter.")).toBeNull();
  });

  it("keeps empty-document message when operationCount is 0 even with a filter query", () => {
    render(
      <DocsOperationNav
        model={{ sections: [], operationCount: 0 }}
        filterQuery="anything"
        selectedIdentity={null}
        selectionVisible={true}
        onFilterQueryChange={() => {}}
        onSelectIdentity={() => {}}
      />,
    );
    expect(screen.getByText("No operations in this document.")).toBeVisible();
    expect(screen.queryByText("No endpoint matches that filter.")).toBeNull();
  });
});

describe("DocsOperationSelection", () => {
  it("AC-3: null shows placeholder; item shows method path summary operationId", () => {
    const { rerender } = render(<DocsOperationSelection item={null} />);
    expect(screen.getByText("Select an operation.")).toBeVisible();

    const withSummary: OperationNavItem = {
      ...GET_ITEM,
      summary: "List the verbs",
      deprecated: true,
    };
    rerender(<DocsOperationSelection item={withSummary} />);
    expect(screen.getByText("GET")).toBeVisible();
    expect(screen.getByText("/verbs")).toBeVisible();
    expect(screen.getByText("List the verbs")).toBeVisible();
    expect(screen.getByText("listVerbs")).toBeVisible();
    expect(screen.getByText("(deprecated)")).toBeVisible();
  });
});
