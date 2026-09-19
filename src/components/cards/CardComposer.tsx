'use client'

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  MinusIcon,
  PlusIcon,
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react'

import {
  canvasToPngBlob,
  cardFileName,
  downloadBlob,
  ensureCardFont,
  loadCardImage,
  loadCardPhoto,
} from '@/components/cards/cardCanvas'
import {
  CARD_HARMONY_HELP,
  CARD_HARMONY_LABEL,
  CARD_PHOTO_PRIVACY_NOTE,
  CARD_PRIVACY_NOTE,
} from '@/components/cards/cardCopy'
import { CardPreviewCanvas } from '@/components/cards/CardPreviewCanvas'
import { useCardCutout } from '@/components/cards/useCardCutout'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { TEAM_CARD_NAME_SLOT, type CardModel, type CardRect } from '@/lib/cardModels'
import { fitCardName, type CardNameFit } from '@/lib/cardNameFit'
import {
  CARD_PHOTO_MAX_ZOOM,
  CARD_PHOTO_MIN_ZOOM,
  CARD_TEAM_PHOTO_MIN_ZOOM,
  cardPhotoTransformsEqual,
  centerCardPhotoTransform,
  panCardPhotoTransform,
  zoomCardPhotoTransform,
  type CardPhotoSize,
  type CardPhotoTransform,
} from '@/lib/cardPhotoTransform'
import {
  createCardMeasure,
  renderNameCard,
  renderPhotoCard,
  renderTeamCard,
} from '@/lib/cardRender'

const primaryButtonClassName =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-(--pt-red) px-5 text-sm font-extrabold text-white transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButtonClassName =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 border-(--campaign-line) bg-white px-5 text-sm font-extrabold text-(--pt-red) transition-colors hover:bg-(--campaign-band) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:ring-offset-2 focus-visible:outline-none'
const controlButtonClassName =
  'inline-flex size-11 items-center justify-center rounded-lg border border-(--campaign-line) bg-white text-(--campaign-ink) transition-colors hover:bg-(--campaign-band) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none'

const NAME_TOO_LONG_MESSAGE =
  'Não foi possível encaixar esse nome no card. Use um nome mais curto, como você é chamado.'

/** S15 design gate: the team preview width per state (S17 ready: 180px mobile / 240px desktop). */
type TeamPreviewStage = 'idle' | 'processing' | 'ready' | 'result'
const TEAM_PREVIEW_WIDTH: Record<TeamPreviewStage, string> = {
  idle: 'max-w-[10.75rem]',
  processing: 'max-w-[9rem]',
  ready: 'max-w-[11.25rem] sm:max-w-[15rem]',
  result: 'max-w-[11.875rem]',
}

const TeamNameField = ({
  id,
  value,
  onChange,
  error,
  inputClassName,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  error: boolean
  inputClassName: string
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-bold text-(--campaign-ink)">
      Seu nome
    </label>
    <input
      id={id}
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="off"
      maxLength={60}
      placeholder="Como você é chamado"
      aria-invalid={error}
      className={inputClassName}
    />
    <p className="mt-2 text-xs leading-5 text-(--campaign-muted)">
      Vai aparecer em caixa alta depois de “TIME DE”. Use um nome curto e conhecido.
    </p>
    {error ? (
      <p role="alert" className="mt-2 text-sm leading-5 font-semibold text-(--pt-red)">
        {NAME_TOO_LONG_MESSAGE}
      </p>
    ) : null}
  </div>
)

/**
 * S17 — the tone-harmony switch of the ready state. Native `role="switch"` (the
 * design gate's semantics; the studio has no shadcn Switch) with the whole row
 * as the target and the label/help always visible.
 */
const TeamHarmonySwitch = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => {
  const helpId = useId()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-describedby={helpId}
      onClick={onToggle}
      className="mt-4 flex min-h-11 w-full items-start gap-3 rounded-lg border border-(--campaign-line) bg-white p-3 text-left focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className={`relative mt-1.5 inline-block h-[26px] w-11 flex-none rounded-full transition-colors ${
          enabled ? 'bg-(--pt-red)' : 'bg-[#cfcac7]'
        }`}
      >
        <span
          className={`absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/25%)] transition-[left] ${
            enabled ? 'left-[21px]' : 'left-[3px]'
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-(--campaign-ink)">{CARD_HARMONY_LABEL}</span>
        <span id={helpId} className="mt-0.5 block text-xs leading-5 text-(--campaign-muted)">
          {CARD_HARMONY_HELP}
        </span>
      </span>
    </button>
  )
}

type CardComposerProps = {
  model: CardModel
  shell: 'dialog' | 'drawer'
  fontFamily: string
  onClose: () => void
}

export const CardComposer = ({ model, shell, fontFamily, onClose }: CardComposerProps) => {
  const [step, setStep] = useState<'compose' | 'result'>('compose')
  const [name, setName] = useState('')
  const [nameFit, setNameFit] = useState<CardNameFit | null>(null)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [photoTransform, setPhotoTransform] = useState<CardPhotoTransform | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null)
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null)
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  /** S17 — LIGADO by default; resets only when the composer unmounts (no persistence). */
  const [harmonyEnabled, setHarmonyEnabled] = useState(true)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const nameInputId = useId()
  const zoomInputId = useId()

  const photoWindow = model.photoWindow
  const isNameModel = model.kind === 'name'
  const isTeamModel = model.kind === 'team'
  /** S18 — the team framing may sit below the S13 cover floor. */
  const photoMinZoom = isTeamModel ? CARD_TEAM_PHOTO_MIN_ZOOM : CARD_PHOTO_MIN_ZOOM
  const cutout = useCardCutout(photoWindow, isTeamModel ? model.assetSrc : undefined)
  const cutoutState = cutout.state

  const teamProcessing = cutoutState.status === 'processing' ? cutoutState : null
  const teamError = cutoutState.status === 'error' ? cutoutState : null
  const teamReady = cutoutState.status === 'ready' ? cutoutState : null

  const photoSize = useMemo<CardPhotoSize | null>(
    () => (photo ? { width: photo.naturalWidth, height: photo.naturalHeight } : null),
    [photo],
  )
  const transformSourceSize = useMemo<CardPhotoSize | null>(() => {
    if (!isTeamModel) return photoSize
    return teamReady ? { width: teamReady.width, height: teamReady.height } : null
  }, [isTeamModel, photoSize, teamReady])

  /**
   * The cutout carries the initial framing; local state takes over after the
   * first pan/zoom. Deriving (instead of mirroring through an effect) keeps the
   * first ready paint composed — no bare-base frame.
   */
  const effectiveTransform = isTeamModel
    ? (photoTransform ?? teamReady?.transform ?? null)
    : photoTransform

  // Assets + font load once per model: typing/panning must not flip the preview
  // back into the loading state (flicker) nor re-announce the live region.
  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    setBaseImage(null)
    setOverlayImage(null)
    setPreviewImage(null)

    const load = async () => {
      try {
        const fontReady = await ensureCardFont(fontFamily)
        if (!fontReady) throw new Error('card-font-unavailable')
        const [image, overlay, preview] = await Promise.all([
          loadCardImage(model.assetSrc),
          model.overlaySrc ? loadCardImage(model.overlaySrc) : Promise.resolve(null),
          model.previewSrc ? loadCardImage(model.previewSrc) : Promise.resolve(null),
        ])
        if (cancelled) return
        setBaseImage(image)
        setOverlayImage(overlay)
        setPreviewImage(preview)
        setLoadState('ready')
      } catch {
        if (!cancelled) setLoadState('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [model.assetSrc, model.overlaySrc, model.previewSrc, fontFamily])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !baseImage || loadState !== 'ready') return

    ctx.clearRect(0, 0, model.width, model.height)

    if (isNameModel) {
      setNameFit(
        renderNameCard(ctx, model, {
          image: baseImage,
          name,
          fontFamily,
          measure: createCardMeasure(ctx, fontFamily),
        }),
      )
      return
    }

    if (isTeamModel) {
      const measure = createCardMeasure(ctx, fontFamily)

      if (teamReady && overlayImage && effectiveTransform && photoWindow) {
        const result = renderTeamCard(ctx, model, {
          base: baseImage,
          overlay: overlayImage,
          photo: harmonyEnabled && teamReady.harmonized ? teamReady.harmonized : teamReady.canvas,
          photoSize: { width: teamReady.width, height: teamReady.height },
          transform: effectiveTransform,
          window: photoWindow,
          name,
          fontFamily,
          measure,
        })
        setNameFit(result.fit)
        if (!cardPhotoTransformsEqual(result.transform, effectiveTransform)) {
          setPhotoTransform(result.transform)
        }
        return
      }

      setNameFit(fitCardName(name, measure, TEAM_CARD_NAME_SLOT))
      const idleImage = cutoutState.status === 'idle' && previewImage ? previewImage : baseImage
      ctx.drawImage(idleImage, 0, 0, model.width, model.height)
      return
    }

    if (photo && effectiveTransform && photoWindow && photoSize) {
      const clamped = renderPhotoCard(ctx, {
        photo,
        frame: baseImage,
        photoSize,
        frameSize: { width: model.width, height: model.height },
        window: photoWindow,
        transform: effectiveTransform,
      })
      if (!cardPhotoTransformsEqual(clamped, effectiveTransform)) {
        setPhotoTransform(clamped)
      }
      return
    }

    if (photoWindow) {
      ctx.fillStyle = '#ded8d2'
      ctx.fillRect(0, 0, model.width, model.height)
      ctx.drawImage(baseImage, 0, 0, model.width, model.height)
    }
  }, [
    baseImage,
    overlayImage,
    previewImage,
    loadState,
    isNameModel,
    isTeamModel,
    teamReady,
    harmonyEnabled,
    cutoutState.status,
    model,
    name,
    fontFamily,
    photo,
    photoSize,
    effectiveTransform,
    photoWindow,
  ])

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file || !photoWindow) return
    setPhotoError(null)

    try {
      const image = await loadCardPhoto(file)
      setPhoto(image)
      setPhotoTransform(
        centerCardPhotoTransform(
          { width: image.naturalWidth, height: image.naturalHeight },
          photoWindow,
        ),
      )
    } catch {
      setPhoto(null)
      setPhotoTransform(null)
      setPhotoError('Não foi possível usar esta foto. Escolha outra imagem e tente novamente.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleTeamPhotoFile = (file: File | undefined) => {
    if (!file) return
    setPhotoError(null)
    setPhotoTransform(null)
    void cutout.start(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /** Applies a pan/zoom update over the derived or user-owned transform. */
  const withTransform = (
    update: (
      transform: CardPhotoTransform,
      size: CardPhotoSize,
      window: CardRect,
    ) => CardPhotoTransform,
  ) => {
    if (!transformSourceSize || !photoWindow) return
    setPhotoTransform((current) => {
      const base = current ?? (isTeamModel ? (teamReady?.transform ?? null) : null)
      return base ? update(base, transformSourceSize, photoWindow) : base
    })
  }

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!transformSourceSize || !photoWindow) return
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    const canvas = canvasRef.current
    if (!drag || drag.pointerId !== event.pointerId || !canvas) return

    const scale = model.width / Math.max(1, canvas.getBoundingClientRect().width)
    const dx = (event.clientX - drag.x) * scale
    const dy = (event.clientY - drag.y) * scale
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY }
    withTransform((transform, size, window) =>
      panCardPhotoTransform(transform, size, window, dx, dy, photoMinZoom),
    )
  }

  const handlePointerEnd = () => {
    dragRef.current = null
  }

  const panBy = (dx: number, dy: number) => {
    withTransform((transform, size, window) =>
      panCardPhotoTransform(transform, size, window, dx, dy, photoMinZoom),
    )
  }

  const zoomTo = (zoom: number) => {
    withTransform((transform, size, window) =>
      zoomCardPhotoTransform(transform, size, window, zoom, { minZoom: photoMinZoom }),
    )
  }

  const handleDownload = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsDownloading(true)
    setDownloadError(null)
    try {
      const blob = await canvasToPngBlob(canvas)
      downloadBlob(blob, cardFileName(model.id))
    } catch {
      setDownloadError('Não foi possível gerar o arquivo agora. Tente de novo.')
    } finally {
      setIsDownloading(false)
    }
  }

  const nameCanAdvance = nameFit?.ok === true
  const canAdvance = isNameModel
    ? nameCanAdvance
    : isTeamModel
      ? teamReady !== null && nameCanAdvance
      : photo !== null
  const nameError =
    (isNameModel || isTeamModel) && name.trim().length > 0 && nameFit !== null && !nameFit.ok
  const adjustable = isTeamModel ? teamReady !== null : photo !== null
  const title = (() => {
    if (step === 'result') return 'Seu card está pronto para compartilhar.'
    if (isNameModel) return 'Personalize com seu nome'
    if (!isTeamModel) return 'Enquadre sua foto'
    if (teamProcessing) return 'Preparando sua foto'
    if (teamError) return 'Vamos tentar outra vez'
    if (nameError) return 'Encurte o nome'
    if (teamReady) return 'Confira seu card'
    return 'Entre para o time'
  })()
  const description = (() => {
    if (step === 'result' || isNameModel) return null
    if (isTeamModel) {
      return teamReady && !nameError
        ? 'O recorte já foi centralizado. Se precisar, arraste a foto ou use os controles.'
        : null
    }
    return 'Arraste para posicionar e use os controles para aproximar ou ajustar.'
  })()
  const eyebrow = isTeamModel
    ? step === 'result'
      ? 'Tudo certo'
      : teamError
        ? 'Falha no recorte'
        : nameError
          ? 'Nome muito longo'
          : 'Time de você'
    : null
  const eyebrowNode = eyebrow ? (
    <p className="text-[10px] font-black tracking-[0.1em] text-(--pt-red) uppercase sm:text-xs">
      {eyebrow}
    </p>
  ) : null

  // The drawer header defaults to centered + `shrink-0`, so a long description
  // would overflow the popup; `text-left!` + `flex-1` port the design gate
  // (left-aligned, wrapped header) for every model in the shared composer.
  const header =
    shell === 'dialog' ? (
      <DialogHeader className="min-w-0 text-left">
        {eyebrowNode}
        <DialogTitle className="text-xl font-black tracking-[-0.01em] text-balance">
          {title}
        </DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
    ) : (
      <DrawerHeader className="min-w-0 flex-1 text-left!">
        {eyebrowNode}
        <DrawerTitle className="text-lg font-black tracking-[-0.01em] text-balance">
          {title}
        </DrawerTitle>
        {description ? <DrawerDescription>{description}</DrawerDescription> : null}
      </DrawerHeader>
    )

  const teamPreviewStage: TeamPreviewStage =
    step === 'result' ? 'result' : teamReady ? 'ready' : teamProcessing ? 'processing' : 'idle'
  const previewWidthClassName = isTeamModel ? TEAM_PREVIEW_WIDTH[teamPreviewStage] : 'max-w-[22rem]'

  const nameInputClassName = `mt-2 h-11 w-full rounded-lg bg-white px-3 text-base text-(--campaign-ink) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none ${
    nameError
      ? 'border-2 border-(--pt-red)'
      : 'border border-(--field-border) focus-visible:border-(--pt-red)'
  }`

  const zoomAndPanControls = effectiveTransform ? (
    <>
      <div className="flex items-center gap-3">
        <label htmlFor={zoomInputId} className="text-sm font-bold text-(--campaign-ink)">
          Zoom
        </label>
        <button
          type="button"
          aria-label="Diminuir zoom"
          onClick={() => zoomTo(effectiveTransform.zoom - 0.1)}
          className={controlButtonClassName}
        >
          <MinusIcon className="size-4" aria-hidden="true" />
        </button>
        <input
          id={zoomInputId}
          type="range"
          min={photoMinZoom}
          max={CARD_PHOTO_MAX_ZOOM}
          step={0.05}
          value={effectiveTransform.zoom}
          onChange={(event) => zoomTo(Number(event.target.value))}
          className="h-11 w-full flex-1 accent-(--pt-red)"
        />
        <button
          type="button"
          aria-label="Aumentar zoom"
          onClick={() => zoomTo(effectiveTransform.zoom + 0.1)}
          className={controlButtonClassName}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4">
        <p className="text-sm font-bold text-(--campaign-ink)">Ajuste fino</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <button
            type="button"
            aria-label="Mover foto para a esquerda"
            onClick={() => panBy(-12, 0)}
            className={controlButtonClassName}
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Mover foto para cima"
            onClick={() => panBy(0, -12)}
            className={controlButtonClassName}
          >
            <ArrowUpIcon className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Mover foto para baixo"
            onClick={() => panBy(0, 12)}
            className={controlButtonClassName}
          >
            <ArrowDownIcon className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Mover foto para a direita"
            onClick={() => panBy(12, 0)}
            className={controlButtonClassName}
          >
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  ) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-(--background) text-(--foreground)">
      <div className="flex items-start gap-3 px-5 pt-5">
        {header}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-(--campaign-muted) transition-colors hover:bg-(--campaign-band) hover:text-(--campaign-ink) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none"
        >
          ×
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-5">
        <p className="sr-only" role="status" aria-live="polite">
          {loadState === 'loading' ? 'Carregando prévia…' : ''}
        </p>

        <div
          className={`relative mx-auto w-full ${previewWidthClassName} ${adjustable ? 'touch-none' : ''}`}
          tabIndex={adjustable ? 0 : undefined}
          role={adjustable ? 'group' : undefined}
          aria-label={adjustable ? 'Ajuste da foto' : undefined}
          onKeyDown={
            adjustable
              ? (event) => {
                  const step = event.shiftKey ? 48 : 12
                  const deltas: Record<string, [number, number]> = {
                    ArrowLeft: [-step, 0],
                    ArrowRight: [step, 0],
                    ArrowUp: [0, -step],
                    ArrowDown: [0, step],
                  }
                  const delta = deltas[event.key]
                  if (!delta) return
                  event.preventDefault()
                  panBy(delta[0], delta[1])
                }
              : undefined
          }
        >
          <CardPreviewCanvas
            model={model}
            canvasRef={canvasRef}
            className={`mx-auto block h-auto max-h-[38dvh] w-auto max-w-full rounded-lg border border-(--campaign-line) shadow-sm transition-opacity ${
              loadState === 'loading' ? 'opacity-60' : 'opacity-100'
            }`}
            onPointerDown={adjustable ? handlePointerDown : undefined}
            onPointerMove={adjustable ? handlePointerMove : undefined}
            onPointerUp={adjustable ? handlePointerEnd : undefined}
            onPointerCancel={adjustable ? handlePointerEnd : undefined}
          />
          {teamReady && step === 'compose' && !nameError ? (
            <span className="pointer-events-none absolute right-2 bottom-2 rounded bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
              Arraste para ajustar
            </span>
          ) : null}
        </div>

        {loadState === 'error' ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-(--pt-red)">
            Não foi possível carregar o modelo. Recarregue a página e tente de novo.
          </p>
        ) : null}

        {step === 'compose' && isNameModel ? (
          <div className="mt-5">
            <label htmlFor={nameInputId} className="block text-sm font-bold text-(--campaign-ink)">
              Seu nome
            </label>
            <input
              id={nameInputId}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              maxLength={60}
              className="mt-2 h-11 w-full rounded-lg border border-(--field-border) bg-white px-3 text-base text-(--campaign-ink) focus-visible:border-(--pt-red) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none"
            />
            <p className="mt-2 text-xs text-(--campaign-muted)">
              Use seu primeiro nome ou o nome pelo qual as pessoas conhecem você.
            </p>
            {nameError ? (
              <p role="alert" className="mt-2 text-sm font-semibold text-(--pt-red)">
                {NAME_TOO_LONG_MESSAGE}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-(--campaign-muted)">{CARD_PRIVACY_NOTE}</p>
          </div>
        ) : null}

        {step === 'compose' && isTeamModel && !teamProcessing && !teamReady && !teamError ? (
          <div className="mt-5">
            <TeamNameField
              id={nameInputId}
              value={name}
              onChange={setName}
              error={nameError}
              inputClassName={nameInputClassName}
            />
            <div className="mt-5 rounded-lg border border-(--campaign-line) bg-(--campaign-surface) p-4">
              <p className="text-sm font-bold text-(--campaign-ink)">Sua foto de busto</p>
              <p className="mt-1 text-sm leading-5 text-(--campaign-muted)">
                Para um recorte melhor, escolha uma foto nítida, de frente e com fundo simples.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border-2 border-(--campaign-line) bg-white px-5 text-sm font-extrabold text-(--pt-red) transition-colors hover:bg-(--campaign-band) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none"
              >
                Escolher foto
              </button>
            </div>
            <p className="mt-4 text-xs leading-5 text-(--campaign-muted)">{CARD_PRIVACY_NOTE}</p>
          </div>
        ) : null}

        {step === 'compose' && teamProcessing ? (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p
                role="status"
                aria-live="polite"
                className="text-sm font-bold text-(--campaign-ink)"
              >
                {teamProcessing.phase === 'download'
                  ? 'Baixando o modelo de recorte…'
                  : 'Removendo o fundo da foto…'}
              </p>
              <p aria-hidden="true" className="text-sm font-black text-(--pt-red)">
                {Math.round(teamProcessing.ratio * 100)}%
              </p>
            </div>
            <div
              role="progressbar"
              aria-label={`Progresso do recorte: ${Math.round(teamProcessing.ratio * 100)}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(teamProcessing.ratio * 100)}
              className="mt-2 h-2 overflow-hidden rounded-full bg-(--campaign-band)"
            >
              <div
                className="h-full rounded-full bg-(--pt-red) transition-all"
                style={{ width: `${Math.round(teamProcessing.ratio * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-sm leading-5 text-(--campaign-muted)">
              Na primeira vez, o modelo precisa ser baixado. Depois, vamos remover o fundo da foto
              no seu aparelho. Isso pode levar um pouco.
            </p>
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-(--campaign-cream) p-3">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-(--team-blue) text-white"
              >
                <CheckIcon className="size-3" aria-hidden="true" />
              </span>
              <p className="text-xs leading-5 text-(--campaign-muted)">{CARD_PHOTO_PRIVACY_NOTE}</p>
            </div>
          </div>
        ) : null}

        {step === 'compose' && teamError ? (
          <div className="mt-5">
            <div role="alert" className="rounded-lg border border-(--pt-red) bg-red-50 p-4">
              <p className="text-sm font-black text-(--pt-red)">
                Não foi possível remover o fundo desta foto.
              </p>
              <p className="mt-1 text-sm leading-5 text-(--campaign-ink)">
                Tente de novo ou escolha outra foto.
              </p>
            </div>
            <p className="mt-4 text-sm leading-5 text-(--campaign-muted)">
              Fotos de busto, nítidas e com fundo simples costumam funcionar melhor.
            </p>
            <p className="mt-3 text-xs leading-5 text-(--campaign-muted)">
              {CARD_PHOTO_PRIVACY_NOTE}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={secondaryButtonClassName}
              >
                Escolher outra foto
              </button>
              <button type="button" onClick={cutout.retry} className={primaryButtonClassName}>
                Tentar de novo
              </button>
            </div>
          </div>
        ) : null}

        {step === 'compose' && teamReady && photoWindow && transformSourceSize ? (
          <div className="mt-5">
            {nameError ? (
              <>
                <TeamNameField
                  id={nameInputId}
                  value={name}
                  onChange={setName}
                  error={nameError}
                  inputClassName={nameInputClassName}
                />
                <p className="mt-4 text-xs leading-5 text-(--campaign-muted)">
                  A foto escolhida e o recorte permanecem salvos neste aparelho enquanto você
                  corrige o nome.
                </p>
              </>
            ) : (
              <>
                {zoomAndPanControls}
                {teamReady.harmonized ? (
                  <TeamHarmonySwitch
                    enabled={harmonyEnabled}
                    onToggle={() => setHarmonyEnabled((enabled) => !enabled)}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`${secondaryButtonClassName} mt-3 w-full`}
                >
                  Trocar foto
                </button>
                <p className="mt-3 text-xs leading-5 text-(--campaign-muted)">
                  {CARD_PHOTO_PRIVACY_NOTE}
                </p>
              </>
            )}
          </div>
        ) : null}

        {step === 'compose' && !isNameModel && !isTeamModel && photoWindow ? (
          <div className="mt-5">
            {photo && effectiveTransform ? (
              zoomAndPanControls
            ) : (
              <p className="text-sm text-(--campaign-muted)">
                Escolha uma foto vertical ou horizontal para começar.
              </p>
            )}

            {photoError ? (
              <div role="alert" className="mt-4 rounded-lg border border-(--pt-red) bg-white p-3">
                <p className="text-sm font-bold text-(--pt-red)">Não foi possível usar esta foto</p>
                <p className="mt-1 text-sm text-(--campaign-muted)">
                  Escolha outra imagem e tente novamente.
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={secondaryButtonClassName}
              >
                {photoError ? 'Escolher outra foto' : photo ? 'Trocar foto' : 'Escolher foto'}
              </button>
            </div>

            <p className="mt-3 text-xs text-(--campaign-muted)">{CARD_PHOTO_PRIVACY_NOTE}</p>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(event) =>
            isTeamModel
              ? handleTeamPhotoFile(event.target.files?.[0])
              : void handlePhotoFile(event.target.files?.[0])
          }
        />

        {step === 'result' ? (
          <div className="mt-5">
            {isTeamModel ? (
              <div className="flex items-start gap-3 rounded-lg bg-(--campaign-cream) p-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-green-700 text-white"
                >
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                </span>
                <p className="text-xs leading-5 text-(--campaign-muted)">{CARD_PRIVACY_NOTE}</p>
              </div>
            ) : (
              <p className="text-sm text-(--campaign-muted)">{CARD_PRIVACY_NOTE}</p>
            )}
            {downloadError ? (
              <p role="alert" className="mt-2 text-sm font-semibold text-(--pt-red)">
                {downloadError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-3 border-t border-(--campaign-line) px-5 py-4">
        {step === 'compose' ? (
          <>
            <button type="button" onClick={onClose} className={secondaryButtonClassName}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canAdvance || loadState !== 'ready'}
              onClick={() => setStep('result')}
              className={primaryButtonClassName}
            >
              {teamProcessing ? 'Processando…' : 'Criar meu card'}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onClose} className={secondaryButtonClassName}>
              Criar outro card
            </button>
            <button
              type="button"
              disabled={isDownloading || loadState !== 'ready'}
              onClick={() => void handleDownload()}
              className={primaryButtonClassName}
            >
              {isDownloading ? 'Gerando…' : 'Baixar meu card'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
