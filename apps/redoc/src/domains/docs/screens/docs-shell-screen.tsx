/** Band screen composing docs chrome with the three-column DocsShell. */
import type { ReactNode } from "react";

import { DocsShell } from "@/domains/docs/components/docs-shell";

/** Props for the docs shell screen chrome and slots. */
export type DocsShellScreenProps = {
  /** Document title shown in the band chrome. */
  title: string;
  /** Document version shown in the band chrome. */
  version: string;
  /** Left / nav slot content. */
  nav: ReactNode;
  /** Center / operation slot content. */
  main: ReactNode;
  /** Right / samples slot content. */
  rail: ReactNode;
};

/** Band + title/version chrome wrapping the DocsShell regions. */
export function DocsShellScreen({ title, version, nav, main, rail }: DocsShellScreenProps) {
  return (
    <main className="band min-h-screen" tabIndex={-1}>
      <header className="border-b border-border px-4 py-4">
        <h1 className="type-subhead text-text">{title}</h1>
        <p className="type-data text-text-muted">{version}</p>
      </header>
      <DocsShell nav={nav} main={main} rail={rail} />
    </main>
  );
}
