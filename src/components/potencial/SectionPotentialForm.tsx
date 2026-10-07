'use client'

import {
  POTENTIAL_UFS,
  type PotentialMunicipalityOption,
  type PotentialUf,
} from '@/lib/sectionPotential'
import { cn } from '@/lib/utils'

import { MunicipalityCombobox } from './MunicipalityCombobox'
import {
  POTENTIAL_FIELD_INPUT,
  POTENTIAL_FIELD_INPUT_ERROR,
  POTENTIAL_FIELD_LABEL,
  POTENTIAL_FOCUS,
  POTENTIAL_NOTE,
  POTENTIAL_OUTLINE_BUTTON,
  POTENTIAL_PRIMARY_BUTTON,
} from './sectionPotentialClasses'
import { POTENTIAL_CHECK_LIST, TSE_SELF_SERVICE_URL } from './sectionPotentialCopy'

type SectionPotentialFormProps = {
  uf: PotentialUf
  onUfChange: (uf: PotentialUf) => void
  municipalityText: string
  onMunicipalityTextChange: (value: string) => void
  onMunicipalitySelect: (municipality: PotentialMunicipalityOption) => void
  zone: string
  onZoneChange: (value: string) => void
  section: string
  onSectionChange: (value: string) => void
  fieldsInvalid: boolean
  submitLabel: string
  onSubmit: () => void
}

/**
 * S46 — o formulário do título (design, cena 3a): UF, município, zona e seção
 * em duas colunas, com a lista de conferência e o caminho para o
 * autoatendimento do TSE quando a seção não aparece. Zona e seção ficam
 * marcadas quando a combinação não existe.
 */
export const SectionPotentialForm = ({
  uf,
  onUfChange,
  municipalityText,
  onMunicipalityTextChange,
  onMunicipalitySelect,
  zone,
  onZoneChange,
  section,
  onSectionChange,
  fieldsInvalid,
  submitLabel,
  onSubmit,
}: SectionPotentialFormProps) => (
  <form
    onSubmit={(event) => {
      event.preventDefault()
      onSubmit()
    }}
  >
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className={POTENTIAL_FIELD_LABEL} htmlFor="potencial-uf">
          UF
        </label>
        <div className={POTENTIAL_FIELD_INPUT}>
          <select
            id="potencial-uf"
            value={uf}
            onChange={(event) => onUfChange(event.target.value as PotentialUf)}
            className={cn(
              'w-full min-w-0 appearance-none bg-transparent text-base',
              POTENTIAL_FOCUS,
            )}
          >
            {POTENTIAL_UFS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
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
            className="shrink-0 text-(--campaign-muted)"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      <MunicipalityCombobox
        uf={uf}
        value={municipalityText}
        onValueChange={onMunicipalityTextChange}
        onSelect={onMunicipalitySelect}
      />

      <div>
        <label className={POTENTIAL_FIELD_LABEL} htmlFor="potencial-zona">
          Zona
        </label>
        <div className={cn(POTENTIAL_FIELD_INPUT, fieldsInvalid && POTENTIAL_FIELD_INPUT_ERROR)}>
          <input
            id="potencial-zona"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            aria-invalid={fieldsInvalid || undefined}
            aria-describedby={fieldsInvalid ? 'potencial-fields-error' : undefined}
            value={zone}
            onChange={(event) => onZoneChange(event.target.value.replace(/\D/g, ''))}
            className={cn('w-full min-w-0 bg-transparent text-base', POTENTIAL_FOCUS)}
          />
        </div>
      </div>

      <div>
        <label className={POTENTIAL_FIELD_LABEL} htmlFor="potencial-secao">
          Seção
        </label>
        <div className={cn(POTENTIAL_FIELD_INPUT, fieldsInvalid && POTENTIAL_FIELD_INPUT_ERROR)}>
          <input
            id="potencial-secao"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            aria-invalid={fieldsInvalid || undefined}
            aria-describedby={fieldsInvalid ? 'potencial-fields-error' : undefined}
            value={section}
            onChange={(event) => onSectionChange(event.target.value.replace(/\D/g, ''))}
            className={cn('w-full min-w-0 bg-transparent text-base', POTENTIAL_FOCUS)}
          />
        </div>
      </div>
    </div>

    {fieldsInvalid ? (
      <p
        id="potencial-fields-error"
        className="mt-1.5 text-xs leading-relaxed text-(--destructive)"
      >
        Zona e seção não conferem entre si. Revise os números no título.
      </p>
    ) : null}

    <div className="mt-5 rounded-xl border border-(--campaign-line) bg-white p-4">
      <p className="m-0 text-[13px] font-extrabold">No título de eleitor, confira:</p>
      <ul className="mt-2 list-none space-y-1.5 p-0 text-[13px] leading-5 text-(--campaign-muted)">
        {POTENTIAL_CHECK_LIST.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
    </div>

    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <button type="submit" className={cn(POTENTIAL_PRIMARY_BUTTON, 'flex-1')}>
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
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        {submitLabel}
      </button>
      <a
        href={TSE_SELF_SERVICE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(POTENTIAL_OUTLINE_BUTTON, 'flex-1')}
      >
        Consultar meu título no TSE
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
        >
          <path d="M7 17 17 7" />
          <path d="M7 7h10v10" />
        </svg>
      </a>
    </div>

    <p className={cn(POTENTIAL_NOTE, 'mt-3')}>
      A base usa os dados do 1º turno de 2026 publicados pelo TSE. Seção recém-criada ou transferida
      pode ainda não aparecer.
    </p>
  </form>
)
