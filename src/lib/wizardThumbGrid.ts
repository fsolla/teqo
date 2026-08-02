import type { MunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'

/** Thumb-zone grid: mobile fills from bottom-right; desktop is a normal LTR grid. */
export const WIZARD_THUMB_TILE_GRID_CLASS =
  'grid list-none grid-cols-2 gap-3 place-content-end [direction:rtl] md:grid-cols-3 md:place-content-start md:[direction:ltr]'

/** Reset text direction inside an RTL thumb grid cell. */
export const WIZARD_THUMB_TILE_ITEM_CLASS = '[direction:ltr]'

/** Signal types ordered for thumb reach — urgency types render last in DOM (= bottom-right on mobile). */
export const wizardSignalTypesThumbOrder: MunicipalitySignalType[] = [
  'invasao',
  'esfriamento',
  'visita_adversario',
  'proposta_broker',
  'outro',
]
