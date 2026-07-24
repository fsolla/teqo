export const isUniqueSupporterConflict = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /supporter.*contact.*municipality|supporter_contact_municipality|nulls_not_distinct|duplicate key/i.test(
    message,
  )
}
