/** Temporary `/docs` — Petstore fixture through parse into DocsShellScreen. */
import { createFileRoute } from "@tanstack/react-router";

import { loadDocsChrome } from "@/app/load-docs-chrome";
import petstoreText from "@/domains/docs/api/dev-petstore-3.0.json?raw";
import { DocsShellPlaceholder } from "@/domains/docs/components/docs-shell-placeholder";
import { DocsShellScreen } from "@/domains/docs/screens/docs-shell-screen";

export const Route = createFileRoute("/docs")({
  component: DocsRoute,
});

/** Compose Petstore chrome into the docs shell, or an incident note on parse failure. */
function DocsRoute() {
  const chrome = loadDocsChrome(petstoreText);
  if (!chrome.ok) {
    return (
      <main className="band min-h-screen p-8">
        <p className="type-data text-danger">{chrome.message}</p>
      </main>
    );
  }
  return (
    <DocsShellScreen
      title={chrome.title}
      version={chrome.version}
      nav={<DocsShellPlaceholder message="Navigation will list operations." />}
      main={<DocsShellPlaceholder message="Select an operation." />}
      rail={<DocsShellPlaceholder message="Schemas and examples appear here." />}
    />
  );
}
