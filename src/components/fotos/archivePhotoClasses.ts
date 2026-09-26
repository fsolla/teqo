import { cn } from '@/lib/utils'

/** Shared class contracts of the public photo album (artefato C233, cenas 01–07). */

export const ARCHIVE_PHOTO_FOCUS =
  'focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-(--pt-yellow)'

export const ARCHIVE_PHOTO_CHIP = cn(
  'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-(--campaign-line) bg-white px-3 text-xs font-bold text-black',
  ARCHIVE_PHOTO_FOCUS,
)

export const ARCHIVE_PHOTO_ACTIVE_CHIP = cn(
  'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#184e92]/35 bg-[#eef4fb] px-3 text-xs font-bold text-[#184e92]',
  ARCHIVE_PHOTO_FOCUS,
)

export const ARCHIVE_PHOTO_PRIMARY_BUTTON = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-(--pt-red) px-4 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-white no-underline',
  'shadow-[0_4px_0_#7f1616] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-[0_2px_0_#7f1616] motion-reduce:transition-none',
  ARCHIVE_PHOTO_FOCUS,
)

export const ARCHIVE_PHOTO_SECONDARY_BUTTON = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-(--campaign-line) bg-white px-4 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-black no-underline',
  'transition-colors duration-150 ease-out hover:border-black/30 motion-reduce:transition-none',
  ARCHIVE_PHOTO_FOCUS,
)

export const ARCHIVE_PHOTO_CARD = cn('block rounded-xl text-left', ARCHIVE_PHOTO_FOCUS)
