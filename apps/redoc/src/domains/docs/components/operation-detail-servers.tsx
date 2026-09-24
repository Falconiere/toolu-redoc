/** Read-only effective servers list (no Try-it / Execute controls). */
import type { OperationServerModel } from "@/domains/docs/api/operation-detail-model";

/** Props for the servers region; omit the region when servers is empty. */
export type OperationDetailServersProps = {
  servers: OperationServerModel[];
};

/** URL + variable defaults for the effective server list. */
export function OperationDetailServers({ servers }: OperationDetailServersProps) {
  if (servers.length === 0) {
    return null;
  }
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label="Servers">
      <h3 className="type-label text-text">Servers</h3>
      <ul className="flex min-w-0 flex-col gap-2">
        {servers.map((server) => (
          <li key={server.url} className="min-w-0 border border-border p-2">
            <p className="type-data break-all text-text">{server.url}</p>
            {server.description !== null ? (
              <p className="type-meta text-text-muted">{server.description}</p>
            ) : null}
            {server.variables.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-1">
                {server.variables.map((variable) => (
                  <li key={variable.name} className="type-data text-text-muted">
                    {variable.name}={variable.defaultValue}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
