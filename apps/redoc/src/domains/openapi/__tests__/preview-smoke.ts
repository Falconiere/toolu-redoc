/** Production-dist Playwright smoke: load Petstore by URL, filter, select, share, reload. */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Browser } from "playwright";

import { startFixtureHttpServer } from "@/domains/openapi/__tests__/fixture-http-server";
import { encodeOperationIdentity } from "@/domains/openapi/api/operation-identity";
import { createHttpClient } from "@/utilities/http";

/** Package root — `test:preview-smoke` always runs with cwd = apps/redoc. */
const rootDir = process.cwd();
const distIndex = join(rootDir, "dist", "index.html");
const EXPECTED_TITLE = "Swagger Petstore - OpenAPI 3.0";
const FILTER_QUERY = "findByStatus";
const OP_IDENTITY = encodeOperationIdentity("get", "/pet/findByStatus");
const PREVIEW_PORT = 4173;
const PREVIEW_ORIGIN = `http://127.0.0.1:${PREVIEW_PORT}`;

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

/** Fail with a clear message and nonzero exit. */
function fail(message: string): never {
  console.error(`preview-smoke: ${message}`);
  process.exit(1);
}

/** One HTTP GET of the preview root via {@link previewHttp}; false on network/HttpError. */
async function probePreview(): Promise<boolean> {
  try {
    const { response, requestUrl } = await previewHttp.getResponse("/");
    if (!response.ok) {
      console.warn(`preview-smoke: probe non-OK ${response.status} for ${requestUrl}`);
      return false;
    }
    return true;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`preview-smoke: probe miss for ${PREVIEW_ORIGIN}/ — ${detail}`);
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
          reject(new Error(`timed out waiting for ${PREVIEW_ORIGIN}/`));
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

async function main(): Promise<void> {
  if (!existsSync(distIndex)) {
    fail(`missing ${distIndex} — run bun run build first`);
  }

  const fixture = await startFixtureHttpServer();
  const preview = startPreview();
  let browser: Browser | undefined;

  try {
    await waitForPreview(30_000);

    const petstoreHref = `${fixture.baseUrl}/fixtures/petstore.json`;
    const loadUrl = `${PREVIEW_ORIGIN}/?url=${encodeURIComponent(petstoreHref)}`;

    browser = await launchBrowser();
    const page = await browser.newPage();

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
      fail("expected op search param after selection");
    }
    if (!opParam.includes("get") || !opParam.includes("/pet/findByStatus")) {
      fail(`expected op to contain get+/pet/findByStatus, got ${opParam}`);
    }
    // Pin the identity codec to the known Petstore pair (not a tautological includes).
    if (OP_IDENTITY !== '["get","/pet/findByStatus"]') {
      fail(`encodeOperationIdentity drift: ${OP_IDENTITY}`);
    }

    await page.getByRole("button", { name: "Copy link" }).waitFor({ timeout: 5_000 });

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: EXPECTED_TITLE }).waitFor({ timeout: 30_000 });

    process.stdout.write("preview-smoke: ok\n");
  } finally {
    await browser?.close();
    await stopChild(preview);
    await fixture.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
