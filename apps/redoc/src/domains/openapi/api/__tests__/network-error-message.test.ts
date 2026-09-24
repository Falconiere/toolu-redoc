import { describe, expect, it } from "vitest";

import { networkErrorMessage } from "@/domains/openapi/api/network-error-message";

describe("networkErrorMessage", () => {
  it("names connectivity / browser blocking without claiming CORS confirmed", () => {
    const message = networkErrorMessage("https://example.com/openapi.json", {
      pageProtocol: "https:",
    });
    expect(message.toLowerCase()).toContain("connectivity");
    expect(message.toLowerCase()).toMatch(/cors|blocking/);
    expect(message.toLowerCase()).toContain("paste");
    expect(message.toLowerCase()).not.toContain("cors confirmed");
  });

  it("mentions mixed content for https page loading http source", () => {
    const message = networkErrorMessage("http://127.0.0.1/spec.json", {
      pageProtocol: "https:",
    });
    expect(message.toLowerCase()).toContain("mixed content");
    expect(message.toLowerCase()).not.toContain("cors confirmed");
  });

  it("omits mixed content when the page is not https", () => {
    const message = networkErrorMessage("http://127.0.0.1/spec.json", {
      pageProtocol: "http:",
    });
    expect(message.toLowerCase()).not.toContain("mixed content");
  });
});
