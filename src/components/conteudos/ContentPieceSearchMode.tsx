'use client'

import type { ChangeEvent } from 'react'

import type { ContentPieceCatalogMode } from '@/lib/contentPieceCatalog'
import { cn } from '@/lib/utils'

const MODE_OPTION = cn(
  'relative flex min-h-[42px] items-center justify-center rounded-[7px] px-2.5 text-[13px] font-extrabold text-[#3f3937] transition-colors',
  'has-[:checked]:bg-white has-[:checked]:text-[#184e92] has-[:checked]:shadow-[0_1px_4px_rgb(0_0_0/12%)]',
  'has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--pt-red)',
  'motion-reduce:transition-none',
)

const MODE_OPTION_ENABLED = 'cursor-pointer hover:bg-white/58 hover:text-[#184e92]'

const MODE_OPTION_DISABLED = 'cursor-not-allowed text-[#8b6c1a] opacity-[0.64]'

/**
 * The radio itself covers the whole option (invisible, on top): the entire
 * segment is the hit target and the native keyboard group keeps working.
 */
const MODE_INPUT = 'absolute inset-0 size-full opacity-0'

const MODE_INPUT_ENABLED = 'cursor-pointer'

const MODE_INPUT_DISABLED = 'cursor-not-allowed'

/**
 * S28 — the search mode of the Central (artefato: cenas 07–09): a single radio
 * group inside the GET form, "Termo exato" as the default. With JS, changing
 * the mode submits the form (one tap); without JS, Enter on the search field
 * submits it with the checked option. When the mechanism is unavailable the
 * theme option is disabled with the ⚠ mark — the notice above explains — and
 * the exact option stays active.
 */
export const ContentPieceSearchMode = ({
  mode,
  themeUnavailable,
}: {
  mode: ContentPieceCatalogMode | null
  themeUnavailable: boolean
}) => {
  const themeChecked = mode === 'tema' && !themeUnavailable

  const submitOnChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.currentTarget.form?.requestSubmit()
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-bold text-(--campaign-muted)">Buscar por:</legend>
      <div className="grid grid-cols-2 rounded-[10px] bg-[#ebe9e9] p-1">
        <label className={cn(MODE_OPTION, MODE_OPTION_ENABLED)}>
          <input
            type="radio"
            name="mode"
            value="exato"
            defaultChecked={!themeChecked}
            onChange={submitOnChange}
            className={cn(MODE_INPUT, MODE_INPUT_ENABLED)}
          />
          <span>Termo exato</span>
        </label>
        <label
          className={cn(MODE_OPTION, themeUnavailable ? MODE_OPTION_DISABLED : MODE_OPTION_ENABLED)}
        >
          <input
            type="radio"
            name="mode"
            value="tema"
            defaultChecked={themeChecked}
            disabled={themeUnavailable}
            onChange={submitOnChange}
            className={cn(MODE_INPUT, themeUnavailable ? MODE_INPUT_DISABLED : MODE_INPUT_ENABLED)}
          />
          <span>{themeUnavailable ? '⚠ Por tema' : '✦ Por tema'}</span>
        </label>
      </div>
    </fieldset>
  )
}
