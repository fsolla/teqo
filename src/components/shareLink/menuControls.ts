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

/**
 * S44 — the home section's single primary action (design artefato
 * `secao-home-plenaria-da-vitoria-ui-design.html`, `.primary-action`): the
 * yellow CTA is both the agenda trigger before the broadcast and the entry
 * link while on air. The announcement page keeps its own CTA constant.
 */
export const SHARE_LINK_HOME_PRIMARY_ACTION = cn(
  'inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-[10px] bg-(--pt-yellow) px-5 py-3',
  'font-[family-name:var(--font-exo2)] text-[17px] leading-none font-black text-(--pt-yellow-ink) no-underline',
  'shadow-[0_5px_0_#cfb900,0_10px_22px_rgb(0_0_0/12%)]',
  'transition-[transform,filter] duration-[180ms] ease-out hover:brightness-[0.97] hover:-translate-y-px',
  'active:translate-y-[3px] active:shadow-[0_2px_0_#cfb900,0_5px_12px_rgb(0_0_0/10%)] motion-reduce:transition-none',
  'focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-(--pt-yellow)',
  'focus-visible:shadow-[0_0_0_2px_var(--pt-red-dark),0_5px_0_#cfb900,0_10px_22px_rgb(0_0_0/12%)]',
)

export const MENU_ROW = cn(
  'flex min-h-11 w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-sm font-semibold text-[#211b19] no-underline',
  'transition-colors hover:bg-(--campaign-band) focus-visible:bg-(--campaign-band) focus-visible:outline-none motion-reduce:transition-none',
)

export const MENU_POPOVER =
  'w-[270px] max-lg:w-(--radix-popover-trigger-width) rounded-[10px] border border-black/10 p-1 shadow-[0_14px_34px_rgb(71_19_14/15%)]'
