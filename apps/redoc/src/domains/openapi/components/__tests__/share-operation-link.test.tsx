/** ShareOperationLink disclosures for query-bearing and paste sources. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { encodeOperationIdentity } from "@/domains/openapi/api/operation-identity";
import {
  SHARE_PASTE_DISCLOSURE,
  SHARE_URL_QUERY_DISCLOSURE,
  ShareOperationLink,
} from "@/domains/openapi/components/share-operation-link";

describe("ShareOperationLink", () => {
  it("shows URL query disclosure when source href contains ?", () => {
    const source = "https://ex.com/a.json?x=1";
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    render(
      <ShareOperationLink
        search={{ url: source, op }}
        sourceKind="url"
        sourceHref={source}
        origin="http://localhost:5173"
      />,
    );
    expect(screen.getByTestId("share-url-query-disclosure")).toHaveTextContent(
      SHARE_URL_QUERY_DISCLOSURE,
    );
  });

  it("shows paste disclosure for paste sources", () => {
    render(
      <ShareOperationLink
        search={{ op: encodeOperationIdentity("get", "/pet/findByStatus") }}
        sourceKind="paste"
        origin="http://localhost:5173"
      />,
    );
    expect(screen.getByTestId("share-paste-disclosure")).toHaveTextContent(SHARE_PASTE_DISCLOSURE);
  });
});
