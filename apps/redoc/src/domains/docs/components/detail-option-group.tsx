/** Radio-group picker for media types, statuses, or named examples. */
import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";

/** One selectable option in a named radio group. */
export type DetailOption = {
  value: string;
  label: string;
};

/** Props for a horizontal radio option group. */
export type DetailOptionGroupProps = {
  name: string;
  label: string;
  options: DetailOption[];
  value: string | null;
  onChange: (value: string) => void;
};

/** Accessible radio group used by request/response pickers. */
export function DetailOptionGroup({
  name,
  label,
  options,
  value,
  onChange,
}: DetailOptionGroupProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className="type-meta text-text-muted">{label}</legend>
      <div className="flex min-w-0 flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`type-data inline-flex cursor-pointer items-center rounded-xs border px-2 py-1 ${
                selected ? "border-accent text-text" : "border-border text-text-muted"
              } ${CONTROL_FOCUS}`}
            >
              <input
                type="radio"
                className="absolute opacity-0"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => {
                  onChange(option.value);
                }}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
