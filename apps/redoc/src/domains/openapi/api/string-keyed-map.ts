/** Zod helper: string-keyed maps that keep exotic keys like `__proto__`. */
import * as z from "zod";

/** True when value is a non-null plain object (not an array). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Empty string map whose prototype cannot swallow `__proto__` keys. */
function emptyStringMap<V>(): Record<string, V> {
  const record: Record<string, V> = {};
  Object.setPrototypeOf(record, null);
  return record;
}

/**
 * Like `z.record`, but materializes into a null-prototype object so keys such
 * as `__proto__` are stored as own properties instead of being dropped.
 */
export function stringKeyedMap<T extends z.ZodType>(valueSchema: T) {
  return z.unknown().transform((input, ctx): Record<string, z.output<T>> => {
    const out = emptyStringMap<z.output<T>>();
    if (!isPlainObject(input)) {
      ctx.addIssue({
        code: "custom",
        message: "Expected a mapping object",
      });
      return out;
    }
    for (const key of Reflect.ownKeys(input)) {
      if (typeof key !== "string") {
        continue;
      }
      const parsed = valueSchema.safeParse(Reflect.get(input, key));
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            ...issue,
            path: [key, ...issue.path],
          });
        }
        continue;
      }
      out[key] = parsed.data;
    }
    return out;
  });
}
