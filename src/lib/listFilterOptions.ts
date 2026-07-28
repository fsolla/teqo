/**
 * Presentation ordering for multi-select filter option lists: selected values
 * rise to the top in their original relative order; the rest keep theirs.
 * Pure / client-safe — consumed by the shared header Popover and the mobile
 * NativeSelect, never by a server facet loader.
 */

type FilterOptionLike = { value: string }

export const orderFilterOptionsSelectedFirst = <T extends FilterOptionLike>(
  options: readonly T[],
  selected: readonly string[],
): { ordered: readonly T[]; selectedCount: number } => {
  if (selected.length === 0) {
    return { ordered: options, selectedCount: 0 }
  }

  const selectedSet = new Set(selected)
  const selectedOptions: T[] = []
  const rest: T[] = []

  for (const option of options) {
    if (selectedSet.has(option.value)) selectedOptions.push(option)
    else rest.push(option)
  }

  const selectedCount = selectedOptions.length
  if (selectedCount === 0 || selectedCount === options.length) {
    return { ordered: options, selectedCount }
  }

  return { ordered: [...selectedOptions, ...rest], selectedCount }
}
