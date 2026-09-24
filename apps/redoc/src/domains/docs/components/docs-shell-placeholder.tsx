/** Ruled placeholder for an empty docs shell column. */

/** Props for a single ruled placeholder sentence. */
export type DocsShellPlaceholderProps = {
  /** One type-meta sentence describing what the column will hold. */
  message: string;
};

/** Hairline ruled box with one meta sentence — no card chrome or icons. */
export function DocsShellPlaceholder({ message }: DocsShellPlaceholderProps) {
  return (
    <div className="min-w-0 border border-border bg-background p-4">
      <p className="type-meta text-text-faint">{message}</p>
    </div>
  );
}
