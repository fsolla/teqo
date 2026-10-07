'use client'

import { useEffect, useRef, useState } from 'react'

import {
  formatPotentialPercent,
  formatPotentialPoints,
  sectionStoryFileName,
  type PotentialSectionNumbers,
  type SectionPotential,
} from '@/lib/sectionPotential'
import { STORY_HEIGHT, STORY_WIDTH, type SectionStoryInput } from '@/lib/sectionStoryRender'
import { cn } from '@/lib/utils'

import {
  POTENTIAL_CHIP,
  POTENTIAL_NOTE,
  POTENTIAL_OUTLINE_BUTTON,
  POTENTIAL_PRIMARY_BUTTON,
} from './sectionPotentialClasses'
import {
  POTENTIAL_STORY_EXPORT_FAILED,
  POTENTIAL_STORY_PREVIEW_NOTE,
  POTENTIAL_STORY_READY,
  POTENTIAL_STORY_SHARE_NOTE,
} from './sectionPotentialCopy'
import {
  canvasToPngBlob,
  downloadBlob,
  drawStoryOnCanvas,
  ensureStoryFont,
} from './sectionStoryCanvas'

type SectionPotentialStoryPreviewProps = {
  numbers: PotentialSectionNumbers
  potential: SectionPotential
  fontFamily: string
}

const DownloadIcon = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
)

const ShareIcon = () => (
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
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
    <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
  </svg>
)

const storyInput = (
  numbers: PotentialSectionNumbers,
  potential: SectionPotential,
  fontFamily: string,
): SectionStoryInput => ({
  municipalityName: numbers.municipalityName,
  uf: numbers.uf,
  zone: numbers.zone,
  section: numbers.section,
  firstRound: formatPotentialPercent(potential.firstRoundPct),
  immediate: formatPotentialPercent(potential.immediatePct),
  total: formatPotentialPercent(potential.totalPct),
  gainImmediate: formatPotentialPoints(potential.gainImmediatePp),
  gainTotal: formatPotentialPoints(potential.gainTotalPp),
  fontFamily,
})

/**
 * S46 — a prévia do story (design, cenas 1/2/3d): o MESMO canvas que vira o
 * PNG 1080×1920. "Baixar imagem" é o piso universal; "Compartilhar" abre a
 * folha do sistema com o arquivo quando o aparelho suporta (cancelar não baixa)
 * e cai no download quando não — o contrato do share de conteúdo. Uma falha de
 * export nunca fica silenciosa: o visitante vê a mensagem honesta.
 */
export const SectionPotentialStoryPreview = ({
  numbers,
  potential,
  fontFamily,
}: SectionPotentialStoryPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileName = sectionStoryFileName(numbers)

  useEffect(() => {
    let alive = true
    setPreviewReady(false)
    void (async () => {
      // A fonte é o gate da medição do canvas; se o load falhar, desenha mesmo
      // assim com o fallback da família (a página já carrega a Arimo).
      await ensureStoryFont(fontFamily)
      if (!alive || !canvasRef.current) return
      drawStoryOnCanvas(canvasRef.current, storyInput(numbers, potential, fontFamily))
      if (alive) setPreviewReady(true)
    })()
    return () => {
      alive = false
    }
  }, [numbers, potential, fontFamily])

  const exportBlob = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current
    if (!canvas) return null
    try {
      return await canvasToPngBlob(canvas)
    } catch {
      return null
    }
  }

  const download = async () => {
    const blob = await exportBlob()
    if (!blob) {
      setExportFailed(true)
      return
    }
    setExportFailed(false)
    downloadBlob(blob, fileName)
    setGenerated(true)
  }

  const onDownload = async () => {
    if (busy) return
    setBusy(true)
    try {
      await download()
    } finally {
      setBusy(false)
    }
  }

  const onShare = async () => {
    if (busy) return
    setBusy(true)
    let fellBack = false
    try {
      const blob = await exportBlob()
      if (!blob) {
        setExportFailed(true)
        return
      }
      const file = new File([blob], fileName, { type: 'image/png' })
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Potencial de Lula na minha seção' })
          setGenerated(true)
          return
        } catch (error) {
          // Cancelar a folha não é falha: nunca baixa no lugar.
          if (error instanceof DOMException && error.name === 'AbortError') return
        }
      }
      fellBack = true
    } finally {
      setBusy(false)
    }
    if (fellBack) await onDownload()
  }

  const ariaLabel = [
    `Prévia do story 1080 por 1920 da seção ${numbers.section} de ${numbers.municipalityName} (${numbers.uf}), cenário hipotético.`,
    `Lula no 1º turno: ${formatPotentialPercent(potential.firstRoundPct)}.`,
    `Lula no 2º turno só com os votos imediatos (X₁): ${formatPotentialPercent(potential.immediatePct)}.`,
    `Lula no 2º turno com todos os votos (X₂): ${formatPotentialPercent(potential.totalPct)}.`,
    `Ganho imediato: ${formatPotentialPoints(potential.gainImmediatePp)}; ganho total: ${formatPotentialPoints(potential.gainTotalPp)}.`,
  ].join(' ')

  return (
    <div className="rounded-2xl border border-(--campaign-line) bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-sm font-bold">Prévia do story</p>
        <span className={POTENTIAL_CHIP}>1080 × 1920</span>
      </div>

      {generated ? (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl bg-support-engaged px-4 py-3 text-[13px] font-black text-support-engaged-foreground"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {POTENTIAL_STORY_READY}
        </div>
      ) : null}

      <div className="relative mt-4">
        <canvas
          ref={canvasRef}
          width={STORY_WIDTH}
          height={STORY_HEIGHT}
          role="img"
          aria-label={ariaLabel}
          aria-busy={!previewReady}
          className="block h-auto w-full rounded border border-(--campaign-line)"
        />
        {!previewReady ? (
          <p className="absolute inset-0 grid place-items-center bg-white/70 text-xs font-bold text-(--campaign-muted)">
            Gerando prévia…
          </p>
        ) : null}
      </div>

      <p className={cn(POTENTIAL_NOTE, 'mt-3')}>{POTENTIAL_STORY_PREVIEW_NOTE}</p>
      <div className="mt-4 flex flex-col gap-2">
        {generated ? (
          <>
            <button
              type="button"
              className={POTENTIAL_PRIMARY_BUTTON}
              onClick={onShare}
              disabled={busy || !previewReady}
            >
              <ShareIcon />
              Compartilhar
            </button>
            <button
              type="button"
              className={POTENTIAL_OUTLINE_BUTTON}
              onClick={onDownload}
              disabled={busy || !previewReady}
            >
              <DownloadIcon />
              Baixar de novo
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={POTENTIAL_PRIMARY_BUTTON}
              onClick={onDownload}
              disabled={busy || !previewReady}
            >
              <DownloadIcon />
              Baixar imagem
            </button>
            <button
              type="button"
              className={POTENTIAL_OUTLINE_BUTTON}
              onClick={onShare}
              disabled={busy || !previewReady}
            >
              <ShareIcon />
              Compartilhar
            </button>
          </>
        )}
      </div>
      {exportFailed ? (
        <p role="alert" className="mt-3 text-xs leading-relaxed font-bold text-(--destructive)">
          {POTENTIAL_STORY_EXPORT_FAILED}
        </p>
      ) : null}
      <p className={cn(POTENTIAL_NOTE, 'mt-3')}>{POTENTIAL_STORY_SHARE_NOTE}</p>
    </div>
  )
}
