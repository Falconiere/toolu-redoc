/** Parameters as grouped card lists (API Reference mock). */
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

/** Section title + mono note for a parameter `in` group. */
const IN_NOTES: Record<OperationParameterRow["in"], { title: string; note: string }> = {
  path: { title: "Path", note: "URL segments" },
  query: { title: "Query", note: "URL parameters" },
  header: { title: "Header", note: "Request headers" },
  cookie: { title: "Cookie", note: "Cookies" },
  $ref: { title: "Reference", note: "$ref" },
};

/** Group flat parameters by `in`, preserving first-seen order. */
function groupByIn(parameters: OperationParameterRow[]): {
  key: OperationParameterRow["in"];
  title: string;
  note: string;
  rows: OperationParameterRow[];
}[] {
  const order: OperationParameterRow["in"][] = [];
  const buckets = new Map<OperationParameterRow["in"], OperationParameterRow[]>();
  for (const row of parameters) {
    const existing = buckets.get(row.in);
    if (existing === undefined) {
      order.push(row.in);
      buckets.set(row.in, [row]);
    } else {
      existing.push(row);
    }
  }
  return order.map((key) => {
    const meta = IN_NOTES[key];
    return { key, title: meta.title, note: meta.note, rows: buckets.get(key) ?? [] };
  });
}

/** One parameter row inside a surface panel. */
function ParameterCardRow({
  row,
  isFirst,
  onFocusChange,
}: {
  row: OperationParameterRow;
  isFirst: boolean;
  onFocusChange?: ((focus: SchemaFocus) => void) | undefined;
}) {
  return (
    <div className={`px-4 py-3.5 ${isFirst ? "" : "border-t border-border-inner"}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-2.5">
        <code className="type-code text-text">{row.name}</code>
        <button
          type="button"
          className={`type-data text-text-muted underline-offset-2 hover:underline ${CONTROL_FOCUS}`}
          onClick={() => {
            onFocusChange?.(row.schemaHandle);
          }}
        >
          {row.typeSummary}
        </button>
        {row.required ? (
          <span className="type-label rounded-xs border border-border-strong px-1.5 py-0.5 text-text-muted">
            Required
          </span>
        ) : null}
        {row.deprecated ? <span className="type-label text-warning">Deprecated</span> : null}
      </div>
      <p className="type-body-sm mt-1.5 text-text-muted">{row.description ?? "—"}</p>
    </div>
  );
}

/** Name / In / Required / Type / Description as mock card panels. */
export function OperationDetailParameters({
  parameters,
  pathParameterIssues,
  onFocusChange,
}: OperationDetailParametersProps) {
  const groups = groupByIn(parameters);

  return (
    <fieldset className="flex min-w-0 flex-col gap-9 border-0 p-0">
      <legend className="absolute -m-px h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap">
        Parameters
      </legend>
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
        <section className="flex min-w-0 flex-col gap-3">
          <h3 className="type-subhead text-text">Parameters</h3>
          <div className="type-body-sm rounded-xl border border-dashed border-border-strong px-4 py-3.5 text-text-muted">
            This endpoint takes no parameters.
          </div>
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex min-w-0 flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="type-subhead text-text">{group.title}</h3>
              <span className="type-marker text-text-faint">{group.note}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {group.rows.map((row, index) => (
                <ParameterCardRow
                  key={`${row.in}:${row.name}`}
                  row={row}
                  isFirst={index === 0}
                  onFocusChange={onFocusChange}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </fieldset>
  );
}
