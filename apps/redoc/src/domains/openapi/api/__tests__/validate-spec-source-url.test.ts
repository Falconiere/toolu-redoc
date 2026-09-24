import { describe, expect, it } from "vitest";

import { validateSpecSourceUrl } from "@/domains/openapi/api/validate-spec-source-url";

describe("validateSpecSourceUrl", () => {
  it("accepts absolute https and http URLs", () => {
    const https = validateSpecSourceUrl("https://example.com/a.json");
    expect(https).toEqual({ ok: true, href: "https://example.com/a.json" });

    const http = validateSpecSourceUrl("http://127.0.0.1/x");
    expect(http.ok).toBe(true);
    if (http.ok) {
      expect(http.href).toBe("http://127.0.0.1/x");
    }
  });

  it("rejects userinfo", () => {
    const result = validateSpecSourceUrl("https://user:pass@h/x");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("disallowed_url");
      expect(result.error.message.toLowerCase()).toContain("userinfo");
    }
  });

  it("rejects file: and data: schemes", () => {
    for (const raw of ["file:///etc/passwd", "data:text/plain,hi"] as const) {
      const result = validateSpecSourceUrl(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("disallowed_url");
      }
    }
  });

  it("rejects relative and empty strings", () => {
    for (const raw of ["", "   ", "/a.json", "a.json", "//example.com/x"] as const) {
      const result = validateSpecSourceUrl(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("disallowed_url");
      }
    }
  });
});
