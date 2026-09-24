/** Three-region docs layout with md matchMedia collapse into drawers. */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { DocsShellDrawer } from "@/domains/docs/components/docs-shell-drawer";
import { DocsShellToolbar } from "@/domains/docs/components/docs-shell-toolbar";
import { useMdUp } from "@/domains/docs/hooks/use-md-up";

/** Column root classes — hairline seams only; no decorative shadows. */
const COLUMN_CLASS = "min-w-0 overflow-auto border-border bg-background p-4 md:w-1/4";

/** Props for the docs shell regions. */
export type DocsShellProps = {
  /** Left / nav slot content. */
  nav: ReactNode;
  /** Center / operation slot content. */
  main: ReactNode;
  /** Right / samples slot content. */
  rail: ReactNode;
};

/** Toggle one drawer; opening it closes the other. */
function useExclusiveDrawerToggle(
  setSelf: (value: boolean | ((open: boolean) => boolean)) => void,
  setOther: (value: boolean) => void,
) {
  return () => {
    setSelf((open) => {
      const next = !open;
      if (next) {
        setOther(false);
      }
      return next;
    });
  };
}

/** Nav / Operation / Samples regions — in-flow columns or drawers by breakpoint. */
function DocsShellRegions({
  isMdUp,
  nav,
  main,
  rail,
  navOpen,
  samplesOpen,
  setNavOpen,
  setSamplesOpen,
  navButtonRef,
  samplesButtonRef,
  backgroundInert,
}: {
  isMdUp: boolean;
  nav: ReactNode;
  main: ReactNode;
  rail: ReactNode;
  navOpen: boolean;
  samplesOpen: boolean;
  setNavOpen: (open: boolean) => void;
  setSamplesOpen: (open: boolean) => void;
  navButtonRef: RefObject<HTMLButtonElement | null>;
  samplesButtonRef: RefObject<HTMLButtonElement | null>;
  backgroundInert: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col md:flex-row">
      {isMdUp ? (
        <nav aria-label="Navigation" className={`${COLUMN_CLASS} md:border-r`}>
          {nav}
        </nav>
      ) : (
        <DocsShellDrawer
          title="Navigation"
          open={navOpen}
          side="start"
          onClose={() => {
            setNavOpen(false);
          }}
          openerRef={navButtonRef}
        >
          {nav}
        </DocsShellDrawer>
      )}
      <section
        aria-label="Operation"
        {...(backgroundInert ? { inert: true as const } : {})}
        className="min-w-0 flex-1 overflow-auto border-border bg-background p-4"
      >
        {main}
      </section>
      {isMdUp ? (
        <section aria-label="Samples" className={`${COLUMN_CLASS} md:border-l`}>
          {rail}
        </section>
      ) : (
        <DocsShellDrawer
          title="Samples"
          open={samplesOpen}
          side="end"
          onClose={() => {
            setSamplesOpen(false);
          }}
          openerRef={samplesButtonRef}
        >
          {rail}
        </DocsShellDrawer>
      )}
    </div>
  );
}

/** Regions + matchMedia-driven drawer state for the docs shell. */
export function DocsShell({ nav, main, rail }: DocsShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navButtonRef = useRef<HTMLButtonElement>(null);
  const samplesButtonRef = useRef<HTMLButtonElement>(null);
  const isMdUp = useMdUp();
  const wasMdUp = useRef(isMdUp);
  const [navOpen, setNavOpen] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const toggleNav = useExclusiveDrawerToggle(setNavOpen, setSamplesOpen);
  const toggleSamples = useExclusiveDrawerToggle(setSamplesOpen, setNavOpen);
  const drawerOpen = navOpen || samplesOpen;

  useEffect(() => {
    if (!isMdUp) {
      wasMdUp.current = false;
      return;
    }
    setNavOpen(false);
    setSamplesOpen(false);
    if (!wasMdUp.current) {
      rootRef.current?.closest("main")?.focus();
    }
    wasMdUp.current = true;
  }, [isMdUp]);

  return (
    <div ref={rootRef} className="flex min-w-0 flex-col">
      <DocsShellToolbar
        navOpen={navOpen}
        samplesOpen={samplesOpen}
        onToggleNav={toggleNav}
        onToggleSamples={toggleSamples}
        navButtonRef={navButtonRef}
        samplesButtonRef={samplesButtonRef}
      />
      <DocsShellRegions
        isMdUp={isMdUp}
        nav={nav}
        main={main}
        rail={rail}
        navOpen={navOpen}
        samplesOpen={samplesOpen}
        setNavOpen={setNavOpen}
        setSamplesOpen={setSamplesOpen}
        navButtonRef={navButtonRef}
        samplesButtonRef={samplesButtonRef}
        backgroundInert={drawerOpen && !isMdUp}
      />
    </div>
  );
}
