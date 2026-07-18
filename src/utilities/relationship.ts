export type PopulatedRelationship = { id: number }

const isRelationshipId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

export const isPopulatedRelationship = <Relationship extends PopulatedRelationship>(
  value: unknown,
): value is Relationship =>
  typeof value === 'object' && value !== null && 'id' in value && isRelationshipId(value.id)

export const relationshipId = (value: unknown): number | null => {
  if (isRelationshipId(value)) return value
  return isPopulatedRelationship(value) ? value.id : null
}

export const requireRelationshipId = (
  value: unknown,
  message = 'Relacionamento inválido.',
): number => {
  const id = relationshipId(value)
  if (id === null) throw new Error(message)
  return id
}
