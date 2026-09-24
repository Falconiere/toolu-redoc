/** Operation detail header: method/path, summary, deprecated, ids, description. */
import type { OperationDetailModel } from "@/domains/docs/api/operation-detail-model";

/** Props for the operation detail header region. */
export type OperationDetailHeaderProps = {
  operation: OperationDetailModel;
};

/** Mono method + path with summary stand-in and optional deprecated badge. */
export function OperationDetailHeader({ operation }: OperationDetailHeaderProps) {
  const title = operation.summary ?? operation.path;
  return (
    <header className="flex min-w-0 flex-col gap-2 border-b border-border pb-4">
      <p className="type-data min-w-0 text-text">
        <span className="uppercase">{operation.method}</span>{" "}
        <span className="break-all">{operation.path}</span>
      </p>
      <h2 className="type-subhead text-text">{title}</h2>
      {operation.deprecated ? <p className="type-label text-warning">Deprecated</p> : null}
      <p className="type-data text-text-muted">operationId: {operation.operationId ?? "—"}</p>
      {operation.description !== null ? (
        <p className="type-body whitespace-pre-wrap text-text">{operation.description}</p>
      ) : null}
    </header>
  );
}
