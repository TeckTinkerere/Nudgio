/**
 * Exhaustiveness helper for `switch` statements over a union.
 *
 * A new `MediaKind`, `CapabilityKind` or error category added to MR-08 without
 * updating every switch is exactly the kind of drift MR-18's "no unresolved
 * placeholder" standard exists to prevent. Calling this in the `default` case
 * turns a missed case into a compile error instead of a silent runtime gap.
 */
export const assertNever = (value: never, context?: string): never => {
  throw new Error(
    `Unhandled case${context ? ` in ${context}` : ''}: ${JSON.stringify(value)}`,
  );
};
