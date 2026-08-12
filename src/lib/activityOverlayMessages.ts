/**
 * C123 — client-safe overlay messages. Split from `activityOverlayErrors.ts`
 * (whose mapper imports the server-only FormData ladder) so the overlay
 * component can reference the generic failure copy without dragging the
 * server graph into the client bundle.
 */
export const ACTIVITY_DUPLICATE_TITLE_MESSAGE = 'Já existe uma atividade com este título.'
export const ACTIVITY_DEMAND_DUPLICATE_MESSAGE =
  'Já existe uma demanda com um dos títulos informados.'
export const ACTIVITY_OVERLAY_GENERIC_FAILURE_MESSAGE =
  'Não foi possível salvar o compromisso. Tente novamente.'
