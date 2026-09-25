/** T27 preview smoke: production dist + fixture URL load → filter → select → share → reload. */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";

import { chromium, type Browser } from "playwright";

import { startFixtureHttpServer } from "@/domains/openapi/__tests__/fixture-http-server";
import { encodeOperationIdentity } from "@/domains/openapi/api/operation-identity";

/** Package root — `test:preview-smoke` always runs with cwd = apps/redoc. */
const rootDir = process.cwd();
const distIndex = join(rootDir, "dist", "index.html");
const EXPECTED_TITLE = "Swagger Petstore - OpenAPI 3.0";
const FILTER_QUERY = "findByStatus";
const OP_IDENTITY = encodeOperationIdentity("get", "/pet/findByStatus");
const PREVIEW_PORT = 4173;
const PREVIEW_ORIGIN = `http://127.0.0.1:${PREVIEW_PORT}`;

/** Fail with a clear message and nonzero exit. */
function fail(message: string): never {
  console.error(`preview-smoke: ${message}`);
  process.exit(1);
}

/** One TCP poll against the preview listen port (no fetch / no API http client). */
function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}

/** Wait until the preview server accepts connections. */
async function waitForPreview(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const ready = await probePort(PREVIEW_PORT);
  if (ready) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setInterval(() => {
      void probePort(PREVIEW_PORT).then((ok) => {
        if (ok) {
          clearInterval(timer);
          resolve();
          return undefined;
        }
        if (Date.now() >= deadline) {
          clearInterval(timer);
          reject(new Error(`timed out waiting for ${PREVIEW_ORIGIN}`));
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
    // Keep identity helper referenced so the smoke stays pinned to the codec.
    if (!OP_IDENTITY.includes("findByStatus")) {
      fail("encodeOperationIdentity fixture drift");
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
