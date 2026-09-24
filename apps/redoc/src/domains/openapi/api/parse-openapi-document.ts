/** Public OpenAPI paste/parse entry: text → structured Result. */
import type { ZodError, ZodIssue } from "zod";

import { decodeOpenApiText } from "./decode-openapi-text";
import {
  normalizeOpenApiDocument,
  type NormalizedOpenApiDocument,
} from "./normalize-openapi-document";
import { OpenApiDocumentSchema } from "./openapi-document-schema";
import { openApiParseError, type OpenApiParseError } from "./openapi-parse-error";

/** Result of {@link parseOpenApiDocument}. */
export type ParseOpenApiResult =
  | { ok: true; document: NormalizedOpenApiDocument }
  | { ok: false; error: OpenApiParseError };

/**
 * Decode paste text, Zod-validate OAS 3.0/3.1, and normalize for the viewer.
 * Failures are structured {@link OpenApiParseError} values only — never throws.
 */
export function parseOpenApiDocument(input: string): ParseOpenApiResult {
  const decoded = decodeOpenApiText(input);
  if (!decoded.ok) {
    return decoded;
  }

  const parsed = OpenApiDocumentSchema.safeParse(decoded.value);
  if (!parsed.success) {
    return { ok: false, error: mapZodParseError(parsed.error) };
  }

  return { ok: true, document: normalizeOpenApiDocument(parsed.data) };
}

/** Map Zod issues onto `version` or `schema` with a user-facing message. */
function mapZodParseError(error: ZodError): OpenApiParseError {
  const versionIssue = error.issues.find(isVersionIssue);
  if (versionIssue !== undefined) {
    return openApiParseError("version", versionIssue.message, formatIssuePath(versionIssue.path));
  }
  const first = error.issues[0];
  if (first === undefined) {
    return openApiParseError("schema", "Document failed OpenAPI schema validation.");
  }
  return openApiParseError("schema", first.message, formatIssuePath(first.path));
}

/**
 * True when the issue names an unsupported OpenAPI/Swagger version family.
 * Driven by issue path (`swagger` / `openapi`) and known version messages.
 */
function isVersionIssue(issue: ZodIssue): boolean {
  const root = issue.path[0];
  if (root === "swagger" || root === "openapi") {
    return true;
  }
  const message = issue.message.toLowerCase();
  return (
    message.includes("swagger") ||
    message.includes("openapi must be 3.0") ||
    message.includes("openapi 3.0 or 3.1")
  );
}

/** Format a Zod path as a JSON Pointer fragment when segments exist. */
function formatIssuePath(path: ReadonlyArray<PropertyKey>): string | undefined {
  if (path.length === 0) {
    return undefined;
  }
  return `#/${path.map(String).join("/")}`;
}
