/**
 * The named "entity not found → 404" error machine (P3-F, 3rd call site):
 * each domain loader throws its own class so pages can `instanceof`-catch and
 * call `notFound()` — the class name and the pt-BR message are data, the
 * machine is shared.
 */
export const createEntityNotFoundError = (entityName: string, message: string) =>
  class extends Error {
    override name = `${entityName}NotFoundError`

    constructor() {
      super(message)
    }
  }
