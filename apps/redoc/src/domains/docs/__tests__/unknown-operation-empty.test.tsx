/** UnknownOperationEmpty is distinct from Select an operation. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  UNKNOWN_OPERATION_BODY,
  UNKNOWN_OPERATION_TITLE,
  UnknownOperationEmpty,
} from "@/domains/docs/components/unknown-operation-empty";

describe("UnknownOperationEmpty", () => {
  it("shows distinct unknown-operation copy (AC-5)", () => {
    render(<UnknownOperationEmpty />);
    expect(screen.getByText(UNKNOWN_OPERATION_TITLE)).toBeTruthy();
    expect(screen.getByText(UNKNOWN_OPERATION_BODY)).toBeTruthy();
    expect(screen.queryByText("Select an operation.")).toBeNull();
  });
});
