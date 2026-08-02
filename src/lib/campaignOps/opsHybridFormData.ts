/** Client-safe FormData helpers for OPS_HYBRID enqueue paths (OH13). */

export const readFormRelationshipIds = (data: FormData, name: string): number[] => {
  const ids: number[] = []
  for (const raw of data.getAll(name)) {
    if (typeof raw !== 'string' || raw.trim() === '') continue
    const value = Number(raw)
    if (Number.isInteger(value) && value > 0) ids.push(value)
  }
  return [...new Set(ids)]
}

export const readOptionalFormText = (data: FormData, name: string): string | undefined => {
  const raw = data.get(name)
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
}
