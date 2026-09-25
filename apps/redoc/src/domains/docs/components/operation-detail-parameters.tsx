/** Parameters table plus path-parameter issue notices. */
import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";
import type {
  OperationParameterRow,
  OperationPathParameterIssue,
  SchemaFocus,
} from "@/domains/docs/api/operation-detail-model";

/** Props for the parameters region. */
export type OperationDetailParametersProps = {
  parameters: OperationParameterRow[];
  pathParameterIssues: OperationPathParameterIssue[];
  onFocusChange?: ((focus: SchemaFocus) => void) | undefined;
};

/** Name / In / Required / Type / Description table; Type click emits focus. */
export function OperationDetailParameters({
  parameters,
  pathParameterIssues,
  onFocusChange,
}: OperationDetailParametersProps) {
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label="Parameters">
      <h3 className="type-label text-text">Parameters</h3>
      {pathParameterIssues.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {pathParameterIssues.map((issue) => (
            <li key={`${issue.name}:${issue.issue}`} className="type-meta text-warning">
              Path parameter `{issue.name}`: {issue.issue}
            </li>
          ))}
        </ul>
      ) : null}
      {parameters.length === 0 ? (
        <p className="type-meta text-text-faint">No parameters.</p>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-0 border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="type-label px-2 py-1 text-text-muted">Name</th>
                <th className="type-label px-2 py-1 text-text-muted">In</th>
                <th className="type-label px-2 py-1 text-text-muted">Required</th>
                <th className="type-label px-2 py-1 text-text-muted">Type</th>
                <th className="type-label px-2 py-1 text-text-muted">Description</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((row) => (
                <tr key={`${row.in}:${row.name}`} className="border-b border-border">
                  <td className="type-data px-2 py-1 text-text">{row.name}</td>
                  <td className="type-data px-2 py-1 text-text">{row.in}</td>
                  <td className="type-data px-2 py-1 text-text">{row.required ? "yes" : "no"}</td>
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      className={`type-data text-text underline-offset-2 hover:underline ${CONTROL_FOCUS}`}
                      onClick={() => {
                        onFocusChange?.(row.schemaHandle);
                      }}
                    >
                      {row.typeSummary}
                    </button>
                  </td>
                  <td className="type-body px-2 py-1 text-text">{row.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
