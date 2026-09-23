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
