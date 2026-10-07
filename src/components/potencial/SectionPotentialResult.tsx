'use client'

import {
  formatPotentialPercent,
  formatPotentialPoints,
  type PotentialSectionNumbers,
  type SectionPotential,
} from '@/lib/sectionPotential'
import { SECTION_STORY_HYPOTHESIS } from '@/lib/sectionStoryRender'
import { cn } from '@/lib/utils'

import {
  POTENTIAL_EYEBROW,
  POTENTIAL_FOCUS,
  POTENTIAL_GHOST_BUTTON,
  POTENTIAL_NOTE,
  POTENTIAL_STAT_LABEL,
  POTENTIAL_STAT_VALUE,
} from './sectionPotentialClasses'
import {
  POTENTIAL_PRIVACY_NOTE,
  POTENTIAL_SOURCE_PREFIX,
  TSE_RESULTS_URL,
} from './sectionPotentialCopy'

type SectionPotentialResultProps = {
  numbers: PotentialSectionNumbers
  potential: SectionPotential
  onChangeSection: () => void
}

/**
 * S46 — o painel de resultado (design, cenas 1/2/3c): número-herói do ganho
 * total, os dois ganhos, as três leituras da mesma seção, o "Como calculamos"
 * com a legenda X₁/X₂ e os guardrails (cenário hipotético + fonte TSE).
 */
export const SectionPotentialResult = ({
  numbers,
  potential,
  onChangeSection,
}: SectionPotentialResultProps) => (
  <div>
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-(--campaign-line) bg-white px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--campaign-cream) text-(--pt-red)">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-bold">
            <span className="sm:hidden">
              {numbers.uf} · {numbers.municipalityName}
            </span>
            <span className="hidden sm:inline">
              {numbers.uf} · {numbers.municipalityName} · Zona {numbers.zone} · Seção{' '}
              {numbers.section}
            </span>
          </p>
          <p className="m-0 text-xs text-(--campaign-muted)">
            <span className="sm:hidden">
              Zona {numbers.zone} · Seção {numbers.section}
            </span>
            <span className="hidden sm:inline">Dados do título de eleitor</span>
          </p>
        </div>
      </div>
      <button
        type="button"
        className={cn(POTENTIAL_GHOST_BUTTON, 'shrink-0')}
        onClick={onChangeSection}
      >
        Trocar seção
      </button>
    </div>

    <div className="mt-4 rounded-2xl border border-(--campaign-line) bg-(--campaign-cream) p-5 sm:p-7">
      <p className={POTENTIAL_EYEBROW}>Potencial nesta seção</p>
      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
        <p className="m-0 font-[family-name:var(--font-exo2)] text-[56px] leading-none font-black text-(--pt-red)">
          {formatPotentialPoints(potential.gainTotalPp)}
        </p>
        <p className="m-0 pb-1 text-sm leading-5 text-(--campaign-muted)">
          de ganho total entre turnos
          <br />
          no cenário com todos os votos disponíveis
        </p>
      </div>
      <p className="m-0 mt-2 text-sm text-(--campaign-muted)">
        Só com os votos imediatos (X₁):{' '}
        <b className="text-(--campaign-ink)">{formatPotentialPoints(potential.gainImmediatePp)}</b>
      </p>

      <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-xl border border-(--campaign-line) bg-white">
        <div className="p-2.5 sm:p-4">
          <p className={POTENTIAL_STAT_LABEL}>1º turno</p>
          <p className={POTENTIAL_STAT_VALUE}>{formatPotentialPercent(potential.firstRoundPct)}</p>
          <p className="mt-0.5 hidden text-[11px] text-(--campaign-muted) sm:block">
            Lula na seção
          </p>
        </div>
        <div className="border-l border-(--campaign-line) p-2.5 sm:p-4">
          <p className={POTENTIAL_STAT_LABEL}>
            <span className="sm:hidden">2º · imediato</span>
            <span className="hidden sm:inline">2º turno · imediato</span>
          </p>
          <p className={POTENTIAL_STAT_VALUE}>{formatPotentialPercent(potential.immediatePct)}</p>
          <p className="mt-0.5 hidden text-[11px] text-(--campaign-muted) sm:block">só X₁</p>
        </div>
        <div className="border-l border-(--campaign-line) p-2.5 sm:p-4">
          <p className={POTENTIAL_STAT_LABEL}>
            <span className="sm:hidden">2º · total</span>
            <span className="hidden sm:inline">2º turno · total</span>
          </p>
          <p className={POTENTIAL_STAT_VALUE}>{formatPotentialPercent(potential.totalPct)}</p>
          <p className="mt-0.5 hidden text-[11px] text-(--campaign-muted) sm:block">
            X₁ + faltantes
          </p>
        </div>
      </div>

      <details className="group mt-4 rounded-xl border border-(--campaign-line) bg-white p-4">
        <summary
          className={cn(
            'flex min-h-11 cursor-pointer items-center gap-2 text-sm font-extrabold',
            POTENTIAL_FOCUS,
          )}
        >
          Como calculamos
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="mt-3 space-y-2 text-[13px] leading-5 text-(--campaign-muted)">
          <p className="m-0">1º turno: % do Lula = votos do Lula ÷ votos válidos da seção × 100.</p>
          <p className="m-0">2º turno: (LULA + X) ÷ (LULA + X + FLÁVIO) × 100.</p>
          <p className="m-0">Ganho: 2º − 1º, em pontos percentuais.</p>
          <p className="m-0 rounded-lg bg-(--campaign-band) px-3 py-2">
            <b className="text-(--campaign-ink)">X₁</b> = nulos + brancos + votos de terceiros
            (disponíveis já no 1º turno). <b className="text-(--campaign-ink)">X₂</b> = X₁ +
            faltantes.
          </p>
        </div>
      </details>

      <p className={cn(POTENTIAL_NOTE, 'mt-4')}>
        <b className="text-(--campaign-ink)">
          Cenário hipotético — não é previsão nem promessa de resultado.
        </b>{' '}
        Hipótese: na seção, só Lula e Flávio disputam o 2º turno; {SECTION_STORY_HYPOTHESIS}
      </p>
      <p className={cn(POTENTIAL_NOTE, 'mt-2')}>
        {POTENTIAL_SOURCE_PREFIX}{' '}
        <a
          href={TSE_RESULTS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'rounded-sm font-bold text-(--pt-red) underline-offset-4 hover:underline',
            POTENTIAL_FOCUS,
          )}
        >
          Arquivos de Urna
        </a>
        . {POTENTIAL_PRIVACY_NOTE}
      </p>
    </div>
  </div>
)
