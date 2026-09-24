/** Merge path-item and operation parameters; flag path-template issues. */
import type { OpenApiParameter, OpenApiParameterOrRef } from "./openapi-parameter-schema";

/** Path-template parameter problem retained on the normalized operation. */
export type PathParameterIssue = {
  name: string;
  issue: "missing" | "not_required";
};

/** Result of merging parameters and checking path-template names. */
export type MergeParametersResult = {
  parameters: OpenApiParameterOrRef[];
  pathParameterIssues: PathParameterIssue[];
};

/** True when value is a Reference Object (`$ref` string present). */
function isReference(value: OpenApiParameterOrRef): value is { $ref: string } {
  return Object.hasOwn(value, "$ref") && typeof value.$ref === "string";
}

/** Stable merge key for `(name, in)` or unresolved `$ref`. */
function parameterKey(parameter: OpenApiParameterOrRef): string {
  if (isReference(parameter)) {
    return `$ref:${parameter.$ref}`;
  }
  return `${parameter.name}\0${parameter.in}`;
}

/**
 * Merge path-item then operation parameters by `(name, in)`.
 * Operation entries win; `$ref` parameters keyed by pointer stay distinct.
 */
export function mergeParameters(
  pathItemParameters: readonly OpenApiParameterOrRef[] | undefined,
  operationParameters: readonly OpenApiParameterOrRef[] | undefined,
): OpenApiParameterOrRef[] {
  const merged = new Map<string, OpenApiParameterOrRef>();
  for (const parameter of pathItemParameters ?? []) {
    merged.set(parameterKey(parameter), parameter);
  }
  for (const parameter of operationParameters ?? []) {
    merged.set(parameterKey(parameter), parameter);
  }
  return [...merged.values()];
}

/** Extract `{name}` placeholders from an OAS path template. */
export function pathTemplateNames(path: string): string[] {
  const names: string[] = [];
  const pattern = /\{([^{}]+)\}/g;
  for (const match of path.matchAll(pattern)) {
    const name = match[1];
    if (name !== undefined && name.length > 0) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Merge parameters and flag missing / non-required path-template params.
 * Does not drop sibling operations or non-path parameters.
 */
export function mergeParametersForPath(
  path: string,
  pathItemParameters: readonly OpenApiParameterOrRef[] | undefined,
  operationParameters: readonly OpenApiParameterOrRef[] | undefined,
): MergeParametersResult {
  const parameters = mergeParameters(pathItemParameters, operationParameters);
  const pathParameterIssues = flagPathTemplateIssues(path, parameters);
  return { parameters, pathParameterIssues };
}

/** Compare merged params against `{name}` placeholders in the path. */
function flagPathTemplateIssues(
  path: string,
  parameters: readonly OpenApiParameterOrRef[],
): PathParameterIssue[] {
  const declared = pathParamsByName(parameters);
  const issues: PathParameterIssue[] = [];
  for (const name of pathTemplateNames(path)) {
    const parameter = declared.get(name);
    if (parameter === undefined) {
      issues.push({ name, issue: "missing" });
      continue;
    }
    if (parameter.required !== true) {
      issues.push({ name, issue: "not_required" });
    }
  }
  return issues;
}

/** Index inline `in: path` parameters by name (refs ignored for flags). */
function pathParamsByName(
  parameters: readonly OpenApiParameterOrRef[],
): Map<string, OpenApiParameter> {
  const declared = new Map<string, OpenApiParameter>();
  for (const parameter of parameters) {
    if (isReference(parameter)) {
      continue;
    }
    if (parameter.in === "path") {
      declared.set(parameter.name, parameter);
    }
  }
  return declared;
}
