/**
 * Production-dist Playwright smoke. Root build (`REDOC_BASE_PATH` unset): load
 * Petstore by URL, filter, select, share, reload. Base-path build (e.g.
 * `REDOC_BASE_PATH=/toolu-redoc/`, the GitHub Pages artifact): load the Museum
 * example from the gallery, then share, deep-link reload, and `/docs`.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Browser, type Page } from "playwright";

import { startFixtureHttpServer } from "@/domains/openapi/__tests__/fixture-http-server";
import { encodeOperationIdentity } from "@/domains/openapi/api/operation-identity";
import { createHttpClient } from "@/utilities/http";
import { resolveBasePath } from "@/utilities/resolve-base-path";

/** Package root — `test:preview-smoke` always runs with cwd = apps/redoc. */
const rootDir = process.cwd();
const distIndex = join(rootDir, "dist", "index.html");
const EXPECTED_TITLE = "Swagger Petstore - OpenAPI 3.0";
const FILTER_QUERY = "findByStatus";
const OP_IDENTITY = encodeOperationIdentity("get", "/pet/findByStatus");
const PREVIEW_PORT = 4173;
const PREVIEW_ORIGIN = `http://127.0.0.1:${PREVIEW_PORT}`;
/** Deploy base the dist was built with; `vite preview` reads the same env. */
const BASE_PATH = resolveBasePath(process.env.REDOC_BASE_PATH);
const APP_URL = `${PREVIEW_ORIGIN}${BASE_PATH}`;
const MUSEUM_TITLE = "Redocly Museum API";
const MUSEUM_OPERATION = "Get museum hours";

/**
 * Probe client bound to the preview origin (not the app API base URL).
 * Overrides Accept so Vite preview does not 404 on application/json.
 */
const previewHttp = createHttpClient({
  baseUrl: PREVIEW_ORIGIN,
  timeoutMs: 2_000,
  credentials: "omit",
  headers: () => ({ accept: "*/*" }),
});

/**
 * Fail with a clear message and nonzero exit. Only for top-level failures —
 * journeys throw instead, so `main`'s `finally` still stops `vite preview`.
 */
function fail(message: string): never {
  console.error(`preview-smoke: ${message}`);
  process.exit(1);
}

/** One HTTP GET of the preview root via {@link previewHttp}; false on network/HttpError. */
async function probePreview(): Promise<boolean> {
  try {
    const { response, requestUrl } = await previewHttp.getResponse(BASE_PATH);
    if (!response.ok) {
      console.warn(`preview-smoke: probe non-OK ${response.status} for ${requestUrl}`);
      return false;
    }
    return true;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`preview-smoke: probe miss for ${APP_URL} — ${detail}`);
    return false;
  }
}

/** Wait until the preview HTTP URL responds OK. */
async function waitForPreview(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const ready = await probePreview();
  if (ready) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setInterval(() => {
      void probePreview().then((ok) => {
        if (ok) {
          clearInterval(timer);
          resolve();
          return undefined;
        }
        if (Date.now() >= deadline) {
          clearInterval(timer);
          reject(new Error(`timed out waiting for ${APP_URL}`));
          return undefined;
        }
        return undefined;
      });
    }, 200);
  });
}

/** Start `vite preview` serving dist/ on PREVIEW_PORT. */
function startPreview(): ChildProcess {
  const child = spawn(
    "bunx",
    ["vite", "preview", "--host", "127.0.0.1", "--port", String(PREVIEW_PORT), "--strictPort"],
    {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    },
  );
  child.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });
  return child;
}

/** Stop a child process tree. */
async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    const onExit = (): void => {
      clearTimeout(timer);
      finish();
    };
    child.once("exit", onExit);
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      child.kill("SIGKILL");
      finish();
    }, 3000);
    child.kill("SIGTERM");
  });
}

/** Launch Chromium: prefer system Chrome when channel is set, else Playwright bundle. */
async function launchBrowser(): Promise<Browser> {
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  if (channel !== undefined && channel.length > 0) {
    return await chromium.launch({ headless: true, channel });
  }
  try {
    return await chromium.launch({ headless: true });
  } catch (error: unknown) {
    console.warn(
      "preview-smoke: Playwright Chromium missing; falling back to channel=chrome",
      error instanceof Error ? error.message : error,
    );
    return await chromium.launch({ headless: true, channel: "chrome" });
  }
}

/** Root build: URL-load Petstore from the fixture server, filter, select, share, reload. */
async function petstoreJourney(page: Page): Promise<void> {
  const fixture = await startFixtureHttpServer();
  try {
    const petstoreHref = `${fixture.baseUrl}/fixtures/petstore.json`;
    const loadUrl = `${PREVIEW_ORIGIN}/?url=${encodeURIComponent(petstoreHref)}`;

    await page.goto(loadUrl, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: EXPECTED_TITLE }).waitFor({ timeout: 30_000 });

    await page.getByLabel("Filter operations").fill(FILTER_QUERY);
    await page.getByRole("button", { name: /Finds Pets by status/i }).click();

    // TanStack Router JSON-encodes string search params, so compare via includes
    // rather than exact encodeOperationIdentity equality on location.search.
    await page.waitForFunction(
      (needle: string) => {
        const op = new URL(window.location.href).searchParams.get("op");
        return op?.includes(needle) === true;
      },
      "findByStatus",
      { timeout: 10_000 },
    );

    const opParam = new URL(page.url()).searchParams.get("op");
    if (opParam === null) {
      throw new Error("expected op search param after selection");
    }
    if (!opParam.includes("get") || !opParam.includes("/pet/findByStatus")) {
      throw new Error(`expected op to contain get+/pet/findByStatus, got ${opParam}`);
    }
    // Pin the identity codec to the known Petstore pair (not a tautological includes).
    if (OP_IDENTITY !== '["get","/pet/findByStatus"]') {
      throw new Error(`encodeOperationIdentity drift: ${OP_IDENTITY}`);
    }

    await page.getByRole("button", { name: "Copy link" }).waitFor({ timeout: 5_000 });

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: EXPECTED_TITLE }).waitFor({ timeout: 30_000 });
  } finally {
    await fixture.close();
  }
}

/**
 * Base-path build (the GitHub Pages artifact): gallery click loads the
 * same-origin Museum example in place, share keeps the base, a reload of the
 * `?url=&op=` deep link restores the operation, and `<base>docs` renders.
 */
async function galleryJourney(page: Page): Promise<void> {
  const museumHref = `${APP_URL}examples/museum-3.1.yaml`;

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.documentElement.dataset.smokeMarker = "kept";
  });
  await page
    .getByRole("list", { name: "Try an example" })
    .getByRole("link", { name: new RegExp(MUSEUM_TITLE) })
    .click();
  await page.getByRole("heading", { name: MUSEUM_TITLE }).waitFor({ timeout: 30_000 });

  const marker = await page.evaluate(() => document.documentElement.dataset.smokeMarker);
  if (marker !== "kept") {
    throw new Error("gallery click caused a full document navigation");
  }
  const urlParam = new URL(page.url()).searchParams.get("url");
  if (urlParam !== museumHref) {
    throw new Error(`expected url=${museumHref}, got ${String(urlParam)}`);
  }

  await page.getByLabel("Filter operations").fill("hours");
  await page.getByRole("button", { name: new RegExp(MUSEUM_OPERATION, "i") }).click();
  await page.waitForFunction(
    (needle: string) =>
      new URL(window.location.href).searchParams.get("op")?.includes(needle) === true,
    "/museum-hours",
    { timeout: 10_000 },
  );

  const shareHref = await page.getByTestId("share-href").textContent();
  if (shareHref?.startsWith(`${APP_URL}?url=`) !== true) {
    throw new Error(`expected share href to start with ${APP_URL}?url=, got ${String(shareHref)}`);
  }

  // Reload = a direct `<base>?url=…&op=…` deep-link load in a fresh document.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: MUSEUM_TITLE }).waitFor({ timeout: 30_000 });
  await page
    .getByRole("heading", { level: 2, name: MUSEUM_OPERATION })
    .waitFor({ timeout: 10_000 });

  await page.goto(`${APP_URL}docs`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: EXPECTED_TITLE }).waitFor({ timeout: 30_000 });
}

async function main(): Promise<void> {
  if (!existsSync(distIndex)) {
    fail(`missing ${distIndex} — run bun run build first`);
  }

  const preview = startPreview();
  let browser: Browser | undefined;

  try {
    await waitForPreview(30_000);
    browser = await launchBrowser();
    const page = await browser.newPage();

    if (BASE_PATH === "/") {
      await petstoreJourney(page);
    } else {
      await galleryJourney(page);
    }

    process.stdout.write(`preview-smoke: ok (base ${BASE_PATH})\n`);
  } finally {
    await browser?.close();
    await stopChild(preview);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
