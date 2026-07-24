/**
 * Types a partial test double as the full contract it stands in for.
 *
 * Unlike casting through `never`, the keys the test DOES provide keep full
 * property-level type checking against `T` — only completeness is waived.
 */
export const stub = <T>(partial: Partial<T>): T => partial as T
