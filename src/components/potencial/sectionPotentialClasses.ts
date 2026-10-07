import { cn } from '@/lib/utils'

/** S46 — class contracts of the public `/potencial` surface (design cena 1–3d). */

/** Foco da campanha: amarelo + separador escuro (a superfície é branca/creme). */
export const POTENTIAL_FOCUS =
  'focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--pt-yellow) focus-visible:shadow-[0_0_0_6px_rgb(16_42_67/90%)]'

export const POTENTIAL_PRIMARY_BUTTON = cn(
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] border-2 border-(--pt-red) bg-(--pt-red) px-[18px] font-[family-name:var(--font-exo2)] text-sm font-extrabold text-white',
  'transition-[filter] duration-150 ease-out hover:brightness-95 motion-reduce:transition-none',
  POTENTIAL_FOCUS,
)

export const POTENTIAL_OUTLINE_BUTTON = cn(
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] border-2 border-[rgb(162_28_28/28%)] bg-white px-[18px] font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-red)',
  'transition-colors duration-150 ease-out hover:border-(--pt-red) hover:bg-[rgb(162_28_28/7%)] motion-reduce:transition-none',
  POTENTIAL_FOCUS,
)

export const POTENTIAL_GHOST_BUTTON = cn(
  'inline-flex min-h-11 items-center justify-center rounded-lg px-2.5 text-xs font-extrabold text-(--pt-red)',
  'transition-colors duration-150 ease-out hover:bg-(--campaign-band) motion-reduce:transition-none',
  POTENTIAL_FOCUS,
)

export const POTENTIAL_CHIP =
  'inline-flex min-h-6 items-center gap-1.5 rounded-full bg-(--campaign-band) px-2.5 py-0.5 text-[11px] font-bold text-[#3f3a37]'

export const POTENTIAL_FIELD_LABEL = 'block text-[13px] font-bold text-(--campaign-ink)'

export const POTENTIAL_FIELD_INPUT = cn(
  'mt-1.5 flex min-h-12 w-full items-center gap-2 rounded-[10px] border border-[rgb(0_0_0/18%)] bg-white px-3 text-base text-(--campaign-ink)',
  'focus-within:border-(--pt-red) focus-within:shadow-[0_0_0_3px_rgb(162_28_28/18%)]',
)

export const POTENTIAL_FIELD_INPUT_ERROR =
  'border-(--danger) shadow-[0_0_0_3px_rgb(180_35_24/12%)] focus-within:border-(--danger)'

export const POTENTIAL_NOTE = 'text-xs leading-relaxed text-(--campaign-muted)'

export const POTENTIAL_EYEBROW =
  'font-[family-name:var(--font-exo2)] text-xs font-extrabold tracking-[0.1em] text-(--pt-red) uppercase'

export const POTENTIAL_STAT_LABEL =
  'text-[9px] font-extrabold tracking-[0.04em] whitespace-nowrap text-(--campaign-muted) uppercase sm:text-[11px] sm:tracking-[0.06em]'

export const POTENTIAL_STAT_VALUE =
  'mt-1 font-[family-name:var(--font-exo2)] text-lg leading-none font-extrabold whitespace-nowrap tabular-nums text-(--campaign-ink) sm:text-[26px]'
