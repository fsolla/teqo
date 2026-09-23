import { cn } from '@/lib/utils'

/**
 * S29 — the shared control vocabulary of the announcement page (design artefato
 * cenas 01–04). Kept in one module so the CTA, the two menus and the popover
 * rows never drift apart.
 */
export const SAFE_FOCUS =
  'focus-visible:shadow-[0_0_0_2px_var(--pt-red-dark)] focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-(--pt-yellow)'

export const SECONDARY_ACTION = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[rgb(162_28_28/28%)] bg-white px-3',
  'font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-red)',
  'transition-[background-color,border-color] duration-150 ease-out hover:border-(--pt-red) hover:bg-[rgb(162_28_28/7%)] motion-reduce:transition-none',
  SAFE_FOCUS,
)

export const MENU_ROW = cn(
  'flex min-h-11 w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-sm font-semibold text-[#211b19] no-underline',
  'transition-colors hover:bg-(--campaign-band) focus-visible:bg-(--campaign-band) focus-visible:outline-none motion-reduce:transition-none',
)

export const MENU_POPOVER = 'w-[270px] rounded-[10px] border border-black/10 p-1'
