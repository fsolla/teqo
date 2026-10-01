import { cn } from '@/lib/utils'

/** Shared class contracts of the Central de Conteúdos (artefato S27, cenas 01–08). */

export const CONTENT_PIECE_FOCUS =
  'focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-(--pt-red)'

export const CONTENT_PIECE_CHIP = cn(
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-(--campaign-line) bg-white px-3 text-xs font-bold text-black',
  CONTENT_PIECE_FOCUS,
)

export const CONTENT_PIECE_ACTIVE_CHIP = cn(
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#184e92]/35 bg-[#eef4fb] px-3 text-xs font-bold text-[#184e92]',
  CONTENT_PIECE_FOCUS,
)

export const CONTENT_PIECE_TAG =
  'inline-flex rounded-full bg-[#eef4fb] px-2 py-1 text-[11px] font-extrabold text-[#184e92]'

/** S39 — the provenance tag of a piece sampled from the visitor's territory. */
const CONTENT_PIECE_LOCAL_TAG = cn(CONTENT_PIECE_TAG, 'bg-[#fff3c4] text-[#6b5100]')

/** S28 — the neutral badge of a theme-mode result that only matched the query. */
export const CONTENT_PIECE_EXACT_TAG =
  'inline-flex rounded-full border border-black/12 bg-white px-2 py-1 text-[11px] font-extrabold text-[#514945]'

export const CONTENT_PIECE_PRIMARY_BUTTON = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-(--pt-yellow) px-4 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-yellow-ink) no-underline',
  'shadow-[0_4px_0_#cfb900] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-[0_2px_0_#cfb900] motion-reduce:transition-none',
  CONTENT_PIECE_FOCUS,
)

export const CONTENT_PIECE_OUTLINE_BUTTON = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[rgb(162_28_28/28%)] bg-white px-4 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-red) no-underline',
  'transition-colors duration-150 ease-out hover:border-(--pt-red) hover:bg-[rgb(162_28_28/7%)] motion-reduce:transition-none',
  CONTENT_PIECE_FOCUS,
)

export const CONTENT_PIECE_CARD = cn(
  'overflow-hidden rounded-[14px] border border-(--campaign-line) bg-white shadow-[0_8px_24px_rgb(71_19_14/7%)]',
)

/**
 * S42 — the home section's tags (artefato: cenas 01–06): 40px targets on
 * touch and 36px from `sm` up, in the static (filled) and link (outline +
 * chevron) variants. The catalogue and the piece page keep the S27 tags
 * (`CONTENT_PIECE_TAG`/`CONTENT_PIECE_LOCAL_TAG`) untouched.
 */
export const CONTENT_PIECE_HOME_TAG = cn(
  CONTENT_PIECE_TAG,
  'min-h-10 items-center px-2.5 py-1.5 sm:min-h-9',
)

export const CONTENT_PIECE_HOME_LOCAL_TAG = cn(
  CONTENT_PIECE_LOCAL_TAG,
  'min-h-10 items-center px-2.5 py-1.5 sm:min-h-9',
)

export const CONTENT_PIECE_TAG_LINK = cn(
  CONTENT_PIECE_TAG,
  'min-h-10 max-w-full items-center gap-1 border border-[rgb(24_78_146/30%)] bg-[#f8fbff] px-2.5 py-1.5 no-underline sm:min-h-9',
  'transition-[border-color,background-color,transform] duration-150 ease-out hover:-translate-y-px hover:border-current hover:bg-[#eef4fb] hover:underline hover:underline-offset-[3px] motion-reduce:transition-none',
  CONTENT_PIECE_FOCUS,
)

/** S42 — the local (territory) variant of the filtrable tag. */
export const CONTENT_PIECE_LOCAL_TAG_LINK = cn(
  CONTENT_PIECE_TAG_LINK,
  'border-[rgb(107_81_0/28%)] bg-[#fff8dc] text-[#6b5100] hover:bg-[#fff3c4]',
)

/** S42 — the card's `Ver esta peça →` under the share button (artefato `.piece-link`). */
export const CONTENT_PIECE_PIECE_LINK = cn(
  'mt-2 flex min-h-11 w-full items-center justify-center rounded-sm text-xs font-extrabold text-(--pt-red) underline-offset-4 hover:underline sm:min-h-9',
  CONTENT_PIECE_FOCUS,
)
