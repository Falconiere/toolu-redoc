/** Vite config — build, dev server, and Vitest, in one file. */
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

import { resolveBasePath } from "./src/utilities/resolve-base-path";

// One config, not two: a separate `vitest.config.ts` REPLACES this file for test
// runs rather than merging with it, so the router plugin and the `@/*` alias
// would silently vanish under Vitest. `defineConfig` is imported from
// `vitest/config` so the `test` block is typed.
export default defineConfig({
  // GitHub Pages serves the demo under `/<repo>/`; Cloudflare serves `/`. The
  // runtime reads the result back as `import.meta.env.BASE_URL` (router
  // basepath, share hrefs, example hrefs), so this is the one place it is set.
  base: resolveBasePath(process.env.REDOC_BASE_PATH),
  // `cloudflared` quick tunnels mint random `*.trycloudflare.com` hosts; a
  // leading-dot entry allows the apex and every subdomain (Vite host check).
  server: {
    allowedHosts: [".trycloudflare.com"],
  },
  plugins: [
    // The router plugin must come before the React plugin — it rewrites route
    // modules that the React plugin then transforms.
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      // Routes live in `src/app/` (the kit's folder vocabulary), and the
      // generated tree lands OUTSIDE that folder so the generator never treats
      // its own output as a route. Ignore helpers (`load-*`, `map-*`) and
      // colocated tests.
      routesDirectory: "./src/app",
      generatedRouteTree: "./src/route-tree.gen.ts",
      routeFileIgnorePattern: "^(__tests__|load-|map-|compose-)",
    }),
    react(),
    // Tailwind is the styling system, not an option: src/ui/globals.css is the
    // one stylesheet and every component is utilities. Without this plugin the
    // @import, the @theme blocks and the @utility roles all pass through as
    // inert CSS and the app renders unstyled — nothing else reports it.
    tailwindcss(),
    tsconfigPaths(),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
