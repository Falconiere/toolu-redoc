import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
  startFixtureHttpServer,
  type FixtureHttpServer,
} from "@/domains/openapi/__tests__/fixture-http-server";
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";
import { MISSING_SOURCE_MESSAGE, SpecLoadScreen } from "@/domains/openapi/screens/spec-load-screen";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

function petstoreText(): string {
  return readFileSync(join(fixturesDir, "petstore-3.0.json"), "utf8");
}

let server: FixtureHttpServer | undefined;

afterEach(async () => {
  if (server !== undefined) {
    await server.close();
    server = undefined;
  }
});

async function start(): Promise<FixtureHttpServer> {
  server = await startFixtureHttpServer();
  return server;
}

/** Stateful harness: merges `url` updates while preserving `op` (AC-8). */
function SearchHarness({ initial }: { initial: SpecLoadSearch }) {
  const [search, setSearch] = useState(initial);
  return (
    <div>
      <p data-testid="search-op">{search.op ?? ""}</p>
      <p data-testid="search-url">{search.url ?? ""}</p>
      <SpecLoadScreen
        search={search}
        onSourceUrlChange={(href) => {
          setSearch((previous) => ({ ...previous, url: href }));
        }}
      />
    </div>
  );
}

describe("SpecLoadScreen", () => {
  it("shows Petstore title, version, and operation count after paste (AC-1b)", async () => {
    render(<SpecLoadScreen search={{}} />);

    fireEvent.change(screen.getByRole("textbox", { name: /paste/i }), {
      target: { value: petstoreText() },
    });
    fireEvent.click(screen.getByRole("button", { name: /parse paste/i }));

    const panel = await screen.findByTestId("spec-load-success");
    expect(within(panel).getByText(/Swagger Petstore/i)).toBeInTheDocument();
    expect(within(panel).getByText(/version · 1\.0\.27/)).toBeInTheDocument();
    expect(within(panel).getByText(/operations · [1-9]\d*/)).toBeInTheDocument();
  });

  it("shows network failure banner with Paste recovery (AC-4 / AC-11)", async () => {
    render(<SpecLoadScreen search={{ url: "http://127.0.0.1:1/openapi.json" }} />);

    const alert = await screen.findByRole("alert");
    const text = alert.textContent.toLowerCase();
    expect(text).toMatch(/connectivity|blocking|cors/);
    expect(text).not.toContain("cors confirmed");
    expect(screen.getByRole("button", { name: /^paste$/i })).toBeInTheDocument();
  });

  it("shows html_body banner for HTML login fixture URL (AC-11)", async () => {
    const fixture = await start();
    render(<SpecLoadScreen search={{ url: `${fixture.baseUrl}/fixtures/login.html` }} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent.toLowerCase()).toMatch(/html|login|page/);
  });

  it("auto-loads ?url= and preserves op in search state (AC-8)", async () => {
    const fixture = await start();
    const op = encodeURIComponent(JSON.stringify(["get", "/pets"]));
    const url = `${fixture.baseUrl}/fixtures/petstore.json`;

    render(<SearchHarness initial={{ url, op }} />);

    expect(screen.getByTestId("search-op")).toHaveTextContent(op);

    await waitFor(() => {
      expect(screen.getByTestId("spec-load-success")).toBeInTheDocument();
    });

    expect(screen.getByTestId("search-op")).toHaveTextContent(op);
    expect(screen.getByTestId("search-url")).toHaveTextContent(url);
    expect(screen.getByText(/Swagger Petstore/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /url/i }), {
      target: { value: `${fixture.baseUrl}/fixtures/missing` },
    });
    fireEvent.click(screen.getByRole("button", { name: /load url/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent.toLowerCase()).toMatch(/404|not found|status/);
    });
    expect(screen.getByTestId("search-op")).toHaveTextContent(op);
  });

  it("shows missing-source message when op is present without url (AC-9)", () => {
    const op = encodeURIComponent(JSON.stringify(["get", "/pets"]));
    render(<SpecLoadScreen search={{ op }} />);

    expect(screen.getByRole("alert")).toHaveTextContent(MISSING_SOURCE_MESSAGE);
    expect(screen.getByRole("button", { name: /^paste$/i })).toBeInTheDocument();
  });

  it("shows missing-source message when url and op are both absent (AC-9)", () => {
    render(<SpecLoadScreen search={{}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(MISSING_SOURCE_MESSAGE);
  });
});
