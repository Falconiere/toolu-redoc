/** SpecExampleGallery — manifest rows, share hrefs, and click routing (AC-4). */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildShareHref } from "@/domains/openapi/api/build-share-href";
import { EXAMPLE_SPECS, exampleSpecHref } from "@/domains/openapi/api/example-specs";
import { SpecExampleGallery } from "@/domains/openapi/components/spec-example-gallery";

const ORIGIN = "https://falconiere.github.io";
const BASE = "/toolu-redoc/";
const MUSEUM_HREF = "https://falconiere.github.io/toolu-redoc/examples/museum-3.1.yaml";

function renderGallery(onLoadExample = vi.fn<(href: string) => void>()) {
  render(
    <SpecExampleGallery
      specs={EXAMPLE_SPECS}
      origin={ORIGIN}
      basePath={BASE}
      onLoadExample={onLoadExample}
    />,
  );
  return onLoadExample;
}

/**
 * Click `link` and report whether the gallery prevented the browser default.
 * A window listener runs after React's root handler, records the verdict, then
 * cancels the click so jsdom does not attempt a (unimplemented) navigation.
 */
function clickPrevented(link: HTMLElement, init: MouseEventInit = {}): boolean {
  let prevented = false;
  const observe = (event: Event): void => {
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener("click", observe);
  fireEvent.click(link, init);
  window.removeEventListener("click", observe);
  return prevented;
}

describe("SpecExampleGallery", () => {
  it("lists every manifest entry in order with title, version, format, blurb, and share href", () => {
    renderGallery();
    const list = screen.getByRole("list", { name: "Try an example" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(EXAMPLE_SPECS.length);

    EXAMPLE_SPECS.forEach((spec, index) => {
      const item = items[index];
      expect(item).toBeDefined();
      if (item === undefined) {
        return;
      }
      const link = within(item).getByRole("link");
      expect(link).toHaveTextContent(spec.title);
      expect(link).toHaveTextContent(spec.blurb);
      expect(link).toHaveTextContent(`OpenAPI ${spec.openapi}`);
      expect(link).toHaveTextContent(spec.format.toUpperCase());
      expect(link).toHaveAttribute(
        "href",
        buildShareHref(ORIGIN, { url: exampleSpecHref(spec, ORIGIN, BASE) }, BASE),
      );
    });
  });

  it("routes a plain click to onLoadExample with the same-origin example href", () => {
    const onLoadExample = renderGallery();
    const link = screen.getByRole("link", { name: /Redocly Museum API/ });

    expect(clickPrevented(link)).toBe(true);
    expect(onLoadExample).toHaveBeenCalledExactlyOnceWith(MUSEUM_HREF);
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }])(
    "leaves a modified click (%o) to the browser",
    (modifier) => {
      const onLoadExample = renderGallery();
      const link = screen.getByRole("link", { name: /Redocly Museum API/ });

      expect(clickPrevented(link, modifier)).toBe(false);
      expect(onLoadExample).not.toHaveBeenCalled();
    },
  );
});
