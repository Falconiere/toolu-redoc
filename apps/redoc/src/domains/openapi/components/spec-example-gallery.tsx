/** Load-screen gallery of bundled example specs (same-origin, one click to load). */
import type { MouseEvent } from "react";

import { buildShareHref } from "@/domains/openapi/api/build-share-href";
import { exampleSpecHref, type ExampleSpec } from "@/domains/openapi/api/example-specs";

/** Focus ring utilities matching SpecLoad form controls. */
const CONTROL_FOCUS =
  "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-(--spacing-focus-ring) focus-visible:ring-focus-ring";

const GALLERY_LABEL_ID = "spec-example-gallery-label";

/** Props for {@link SpecExampleGallery}. */
export type SpecExampleGalleryProps = {
  specs: readonly ExampleSpec[];
  /** Browser origin the examples are served from. */
  origin: string;
  /** Deploy base path (`import.meta.env.BASE_URL`). */
  basePath: string;
  /** Plain click → load this absolute example href in place. */
  onLoadExample: (href: string) => void;
};

/** True when the browser should handle the click itself (new tab / window / download). */
function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * Index rows — number · title + blurb · spec tag. Each row is a real share link
 * (`?url=<example>`), so modified clicks open a new tab that auto-loads; a plain
 * click loads in place through the same path as **Load URL**.
 */
export function SpecExampleGallery({
  specs,
  origin,
  basePath,
  onLoadExample,
}: SpecExampleGalleryProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 id={GALLERY_LABEL_ID} className="type-label text-text-faint">
        Try an example
      </h2>
      <ol aria-labelledby={GALLERY_LABEL_ID} className="border-t border-border">
        {specs.map((spec, index) => {
          const exampleHref = exampleSpecHref(spec, origin, basePath);
          return (
            <li key={spec.id} className="border-b border-border">
              <a
                href={buildShareHref(origin, { url: exampleHref }, basePath)}
                className={`grid grid-cols-[auto_1fr_auto] items-baseline gap-3 border border-transparent px-2 py-3 text-text transition duration-(--duration-hover) ease-signal hover:bg-surface ${CONTROL_FOCUS}`}
                onClick={(event) => {
                  if (isModifiedClick(event)) {
                    return;
                  }
                  event.preventDefault();
                  onLoadExample(exampleHref);
                }}
              >
                <span className="type-data text-text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="type-body block text-text">{spec.title}</span>
                  <span className="type-body-sm block text-text-muted">{spec.blurb}</span>
                </span>
                <span className="type-tag text-text-muted">
                  OpenAPI {spec.openapi} · {spec.format.toUpperCase()}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
