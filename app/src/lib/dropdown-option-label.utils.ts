/** Reads a display label from a `{ id, label }[]` options list (config/constants/dropdowns). */
export function getDropdownOptionLabel<T extends string>(options: readonly { id: T | string; label: string }[], id: T | string | null | undefined, fallback = ""): string {
  if (id === null || id === undefined) return fallback;
  return options.find((o) => o.id === id)?.label ?? fallback ?? String(id);
}
