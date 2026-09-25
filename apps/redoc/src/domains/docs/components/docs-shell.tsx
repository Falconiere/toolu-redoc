/** Three-region docs layout with md matchMedia collapse into drawers. */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { DocsShellDrawer } from "@/domains/docs/components/docs-shell-drawer";
import { DocsShellToolbar } from "@/domains/docs/components/docs-shell-toolbar";
import { useMdUp } from "@/domains/docs/hooks/use-md-up";

/** Nav column — fixed mock width on md+. */
const NAV_COLUMN_CLASS =
  "min-w-0 overflow-auto border-border bg-background p-4 md:w-(--spacing-docs-nav) md:shrink-0 md:grow-0 md:border-r md:px-4 md:pt-6 md:pb-4";

/** Samples column — wide mock rail on md+. */
const RAIL_COLUMN_CLASS =
  "min-w-0 overflow-auto border-border bg-background p-4 md:w-(--spacing-docs-rail) md:max-w-[45vw] md:shrink-0 md:grow-0 md:border-l md:p-6";

/** Props for the docs shell regions. */
export type DocsShellProps = {
  /** Left / nav slot content. */
  nav: ReactNode;
  /** Center / operation slot content. */
  main: ReactNode;
  /** Right / samples slot content. */
  rail: ReactNode;
  /**
   * When false, omit the Samples column (md-up) and Samples opener (below md).
   * Defaults to true so callers with placeholder rails keep three regions.
   */
  samplesVisible?: boolean;
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

/** Apply or clear the HTML `inert` attribute on a node. */
function useInertAttribute(ref: RefObject<HTMLElement | null>, inert: boolean): void {
  useEffect(() => {
    const node = ref.current;
    if (node === null) {
      return;
    }
    if (inert) {
      node.setAttribute("inert", "");
    } else {
      node.removeAttribute("inert");
    }
  }, [ref, inert]);
}

/** Props for the three-region layout body. */
type DocsShellRegionsProps = {
  isMdUp: boolean;
  nav: ReactNode;
  main: ReactNode;
  rail: ReactNode;
  samplesVisible: boolean;
  navOpen: boolean;
  samplesOpen: boolean;
  setNavOpen: (open: boolean) => void;
  setSamplesOpen: (open: boolean) => void;
  navButtonRef: RefObject<HTMLButtonElement | null>;
  samplesButtonRef: RefObject<HTMLButtonElement | null>;
  backgroundInert: boolean;
};

/** Nav / Operation / Samples regions — in-flow columns or drawers by breakpoint. */
function DocsShellRegions({
  isMdUp,
  nav,
  main,
  rail,
  samplesVisible,
  navOpen,
  samplesOpen,
  setNavOpen,
  setSamplesOpen,
  navButtonRef,
  samplesButtonRef,
  backgroundInert,
}: DocsShellRegionsProps) {
  const operationRef = useRef<HTMLElement>(null);
  useInertAttribute(operationRef, backgroundInert);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
      {isMdUp ? (
        <nav aria-label="Navigation" className={NAV_COLUMN_CLASS}>
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
        ref={operationRef}
        aria-label="Operation"
        className="min-w-0 flex-1 overflow-auto border-border bg-background p-4 md:px-12 md:py-10"
      >
        {main}
      </section>
      {samplesVisible ? (
        isMdUp ? (
          <section aria-label="Samples" className={RAIL_COLUMN_CLASS}>
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
        )
      ) : null}
    </div>
  );
}

/** Regions + matchMedia-driven drawer state for the docs shell. */
export function DocsShell({ nav, main, rail, samplesVisible = true }: DocsShellProps) {
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
      rootRef.current?.focus();
    }
    wasMdUp.current = true;
  }, [isMdUp]);

  useEffect(() => {
    if (!samplesVisible) {
      setSamplesOpen(false);
    }
  }, [samplesVisible]);

  return (
    <div ref={rootRef} tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
      <DocsShellToolbar
        navOpen={navOpen}
        samplesOpen={samplesOpen}
        samplesVisible={samplesVisible}
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
        samplesVisible={samplesVisible}
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
