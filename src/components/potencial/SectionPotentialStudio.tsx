'use client'

import { useRef, useState } from 'react'

import {
  computeSectionPotential,
  type PotentialMunicipalityOption,
  type PotentialSectionNumbers,
  type PotentialUf,
  type SectionPotential,
} from '@/lib/sectionPotential'
import { cn } from '@/lib/utils'

import { SectionPotentialForm } from './SectionPotentialForm'
import { SectionPotentialResult } from './SectionPotentialResult'
import { SectionPotentialStoryPreview } from './SectionPotentialStoryPreview'
import { POTENTIAL_NOTE } from './sectionPotentialClasses'
import {
  POTENTIAL_FORM_VALIDATION_MESSAGE,
  POTENTIAL_HEADLINE,
  POTENTIAL_INTRO,
  POTENTIAL_LOADING_MESSAGE,
  POTENTIAL_LOADING_NOTE,
  POTENTIAL_NOT_FOUND_EYEBROW,
  POTENTIAL_NOT_FOUND_HINT,
  POTENTIAL_NOT_FOUND_MESSAGE,
  POTENTIAL_NOT_FOUND_TITLE,
  POTENTIAL_NO_DATA_MESSAGE,
  POTENTIAL_PAGE_EYEBROW,
  POTENTIAL_THROTTLED_MESSAGE,
  POTENTIAL_UNAVAILABLE_MESSAGE,
} from './sectionPotentialCopy'

type StudioState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; numbers: PotentialSectionNumbers; potential: SectionPotential }
  | {
      status: 'error'
      reason: 'not-found' | 'no-data' | 'unavailable'
      message: string
      hint: string | null
      fieldsInvalid: boolean
    }

const SectionPotentialSkeleton = () => (
  <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
    <div className="h-3 w-40 rounded bg-(--campaign-band)" />
    <div className="mt-5 rounded-2xl border border-(--campaign-line) bg-white p-6">
      <div className="h-3 w-40 rounded bg-(--campaign-band)" />
      <div className="mt-4 h-12 w-52 rounded bg-(--campaign-band)" />
      <div className="mt-3 flex gap-3">
        <div className="h-4 w-32 rounded bg-(--campaign-band)" />
        <div className="h-4 w-24 rounded bg-(--campaign-band)" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="h-24 rounded bg-(--campaign-band)" />
        <div className="h-24 rounded bg-(--campaign-band)" />
        <div className="h-24 rounded bg-(--campaign-band)" />
      </div>
      <div className="mt-4 h-12 w-full rounded bg-(--campaign-band)" />
    </div>
  </div>
)

/**
 * S46 — a ilha do `/potencial`: formulário do título → consulta à API pública
 * → painel + prévia do story. O cálculo vem do módulo puro compartilhado
 * (`computeSectionPotential`), então a tela e a imagem usam os mesmos números.
 * Nenhum dado pessoal é coletado; nada é persistido no navegador.
 */
export const SectionPotentialStudio = ({ fontFamily }: { fontFamily: string }) => {
  const [uf, setUf] = useState<PotentialUf>('BA')
  const [municipalityText, setMunicipalityText] = useState('')
  const [municipality, setMunicipality] = useState<PotentialMunicipalityOption | null>(null)
  const [zone, setZone] = useState('')
  const [section, setSection] = useState('')
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [state, setState] = useState<StudioState>({ status: 'idle' })
  const requestSeq = useRef(0)

  const onUfChange = (nextUf: PotentialUf) => {
    setUf(nextUf)
    setMunicipality(null)
    setMunicipalityText('')
  }

  const submit = async () => {
    const zoneNumber = Number(zone)
    const sectionNumber = Number(section)
    if (
      !municipality ||
      !Number.isInteger(zoneNumber) ||
      zoneNumber < 1 ||
      !Number.isInteger(sectionNumber) ||
      sectionNumber < 1
    ) {
      setFormMessage(POTENTIAL_FORM_VALIDATION_MESSAGE)
      return
    }
    setFormMessage(null)

    setState({ status: 'loading' })
    const requestId = ++requestSeq.current

    try {
      const response = await fetch(
        `/api/potencial/secao?uf=${uf}&codigo=${municipality.code}&zona=${zoneNumber}&secao=${sectionNumber}`,
        { headers: { accept: 'application/json' } },
      )
      if (requestId !== requestSeq.current) return

      if (response.status === 404) {
        setState({
          status: 'error',
          reason: 'not-found',
          message: POTENTIAL_NOT_FOUND_MESSAGE,
          hint: POTENTIAL_NOT_FOUND_HINT,
          fieldsInvalid: true,
        })
        return
      }
      if (response.status === 429) {
        setState({
          status: 'error',
          reason: 'unavailable',
          message: POTENTIAL_THROTTLED_MESSAGE,
          hint: null,
          fieldsInvalid: false,
        })
        return
      }
      if (!response.ok) throw new Error(`potencial:${response.status}`)

      const body = (await response.json()) as {
        ok: boolean
        section?: PotentialSectionNumbers
      }
      if (!body.ok || !body.section) throw new Error('potencial:body')

      const result = computeSectionPotential(body.section)
      if (!result.available) {
        setState({
          status: 'error',
          reason: 'no-data',
          message: POTENTIAL_NO_DATA_MESSAGE,
          hint: POTENTIAL_NOT_FOUND_HINT,
          fieldsInvalid: false,
        })
        return
      }
      setState({ status: 'ready', numbers: body.section, potential: result.potential })
    } catch {
      if (requestId !== requestSeq.current) return
      setState({
        status: 'error',
        reason: 'unavailable',
        message: POTENTIAL_UNAVAILABLE_MESSAGE,
        hint: null,
        fieldsInvalid: false,
      })
    }
  }

  const isError = state.status === 'error'
  const notFound = isError && state.reason === 'not-found'
  // A validação local vence o alerta do estado: depois de um 404, um resubmit
  // com campo vazio precisa mostrar o que falta, não a mensagem antiga.
  const alertMessage = formMessage ?? (isError ? state.message : null)

  return (
    <div className="mx-auto w-full max-w-[1160px] px-5 pt-8 pb-12 sm:px-8 lg:px-10">
      <div className="text-center">
        <p className={POTENTIAL_PAGE_EYEBROW}>
          {notFound ? POTENTIAL_NOT_FOUND_EYEBROW : POTENTIAL_PAGE_EYEBROW}
        </p>
        <h1
          className={cn(
            'm-0 mt-2 font-[family-name:var(--font-exo2)] leading-[1.12] font-black tracking-[-0.02em] text-balance',
            notFound ? 'text-[28px] leading-[1.15]' : 'text-[27px] sm:text-[34px] lg:text-[40px]',
          )}
        >
          {notFound ? POTENTIAL_NOT_FOUND_TITLE : POTENTIAL_HEADLINE}
        </h1>
        {state.status === 'idle' ? (
          <p className="mx-auto mt-3 max-w-[680px] text-[15px] leading-6 text-(--campaign-muted)">
            {POTENTIAL_INTRO}
          </p>
        ) : null}
      </div>

      {state.status === 'loading' ? (
        <div className="mt-8" role="status" aria-live="polite">
          <p className="m-0 flex items-center gap-2 text-sm font-black">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--pt-red)"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            >
              <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            </svg>
            {POTENTIAL_LOADING_MESSAGE}
          </p>
          <p className={cn(POTENTIAL_NOTE, 'mt-1')}>{POTENTIAL_LOADING_NOTE}</p>
          <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_396px]">
            <SectionPotentialSkeleton />
            <div className="rounded-2xl border border-(--campaign-line) bg-white p-5">
              <div className="h-4 w-32 animate-pulse rounded bg-(--campaign-band) motion-reduce:animate-none" />
              <div className="mt-4 aspect-[1080/1920] w-full animate-pulse rounded bg-(--campaign-band) motion-reduce:animate-none" />
              <div className="mt-4 h-12 w-full animate-pulse rounded bg-(--campaign-band) motion-reduce:animate-none" />
              <div className="mt-2 h-12 w-full animate-pulse rounded bg-(--campaign-band) motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      ) : null}

      {state.status === 'idle' || isError ? (
        <div className="mx-auto mt-6 w-full max-w-[680px]">
          {alertMessage ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-[rgb(180_35_24/40%)] bg-[#fef3f2] p-4 text-(--destructive)"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
              <div>
                <p className="m-0 text-sm font-black">{alertMessage}</p>
                {isError && state.hint ? (
                  <p className="m-0 mt-1 text-[13px] leading-5">{state.hint}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <SectionPotentialForm
              uf={uf}
              onUfChange={onUfChange}
              municipalityText={municipalityText}
              onMunicipalityTextChange={(value) => {
                setMunicipalityText(value)
                if (municipality && value !== municipality.name) setMunicipality(null)
              }}
              onMunicipalitySelect={(selected) => {
                setMunicipality(selected)
                setMunicipalityText(selected.name)
              }}
              zone={zone}
              onZoneChange={setZone}
              section={section}
              onSectionChange={setSection}
              fieldsInvalid={isError && state.fieldsInvalid}
              submitLabel={isError ? 'Tentar de novo' : 'Ver o potencial da minha seção'}
              onSubmit={() => {
                void submit()
              }}
            />
          </div>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <div
          className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_396px]"
          aria-live="polite"
        >
          <SectionPotentialResult
            numbers={state.numbers}
            potential={state.potential}
            onChangeSection={() => setState({ status: 'idle' })}
          />
          <SectionPotentialStoryPreview
            numbers={state.numbers}
            potential={state.potential}
            fontFamily={fontFamily}
          />
        </div>
      ) : null}

      {state.status === 'idle' || isError ? (
        <p className={cn(POTENTIAL_NOTE, 'mt-6 text-center')}>
          A consulta não pede nome, e-mail ou telefone — e nada fica salvo no seu aparelho.
        </p>
      ) : null}
    </div>
  )
}
