/** Operation detail header: marker, title, summary, method/path bar. */
import { useState } from "react";

import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";
import type { OperationDetailModel } from "@/domains/docs/api/operation-detail-model";

/** Props for the operation detail header region. */
export type OperationDetailHeaderProps = {
  operation: OperationDetailModel;
};

/** Split path into literal vs `{param}` segments for muted templates. */
function pathSegments(path: string): { text: string; param: boolean }[] {
  return path
    .split(/(\{[^}]+\})/)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, param: part.startsWith("{") }));
}

/** Primary tag from the operation, or Untagged. */
function groupLabel(operation: OperationDetailModel): string {
  const tag = operation.tags[0]?.trim();
  if (tag !== undefined && tag.length > 0) {
    return tag;
  }
  return "Untagged";
}

/**
 * API Reference mock header: section marker, large title, muted blurb,
 * method + path bar with copy (Signal live colour stays on the nav method).
 */
export function OperationDetailHeader({ operation }: OperationDetailHeaderProps) {
  const [copied, setCopied] = useState(false);
  const title = operation.summary ?? operation.path;
  const group = groupLabel(operation);
  const segments = pathSegments(operation.path);
  const copyText = `${operation.method.toUpperCase()} ${operation.path}`;
  const blurb =
    operation.description ??
    (operation.summary !== null && operation.summary.trim().length > 0 ? operation.summary : null);

  return (
    <header className="flex min-w-0 flex-col gap-3.5">
      <p className="type-marker text-text-faint">— · {group}</p>
      <h2 className="type-display text-text">{title}</h2>
      {blurb !== null && blurb !== title ? (
        <p className="type-body max-w-(--container-copy) whitespace-pre-wrap text-text-muted">
          {blurb}
        </p>
      ) : null}
      {operation.deprecated ? <p className="type-label text-warning">Deprecated</p> : null}
      <div className="flex h-12 min-w-0 items-center gap-3 rounded-md border border-border bg-disabled-fill py-0 pr-1.5 pl-3">
        <span className="type-tag shrink-0 rounded-xs border border-border-strong px-1.5 py-0.5 text-text">
          {operation.method}
        </span>
        <code className="type-code min-w-0 flex-1 truncate text-text">
          {segments.map((segment) => (
            <span
              key={`${segment.text}:${segment.param ? "p" : "l"}`}
              className={segment.param ? "text-text-muted" : "text-text"}
            >
              {segment.text}
            </span>
          ))}
        </code>
        <button
          type="button"
          className={`type-button h-9 shrink-0 rounded-xs border border-border bg-transparent px-3 text-text-muted transition duration-(--duration-hover) ease-signal hover:border-border-strong hover:text-text active:translate-y-px ${CONTROL_FOCUS}`}
          onClick={() => {
            void navigator.clipboard.writeText(copyText).then(
              () => {
                setCopied(true);
                return undefined;
              },
              () => undefined,
            );
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="type-meta text-text-faint">operationId · {operation.operationId ?? "—"}</p>
    </header>
  );
}
