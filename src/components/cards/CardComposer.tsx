'use client'

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  MinusIcon,
  PlusIcon,
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'

import {
  canvasToPngBlob,
  cardFileName,
  downloadBlob,
  ensureCardFont,
  loadCardImage,
  loadCardPhoto,
} from '@/components/cards/cardCanvas'
import { CardPreviewCanvas } from '@/components/cards/CardPreviewCanvas'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import type { CardModel } from '@/lib/cardModels'
import type { CardNameFit } from '@/lib/cardNameFit'
import {
  CARD_PHOTO_MAX_ZOOM,
  CARD_PHOTO_MIN_ZOOM,
  centerCardPhotoTransform,
  panCardPhotoTransform,
  zoomCardPhotoTransform,
  type CardPhotoTransform,
} from '@/lib/cardPhotoTransform'
import { createCardMeasure, renderNameCard, renderPhotoCard } from '@/lib/cardRender'

const PRIVACY_NOTE =
  'Seu nome e sua foto são processados apenas no seu aparelho e não são enviados para nós.'
const PHOTO_PRIVACY_NOTE = 'Sua foto fica neste aparelho e não é enviada para nós.'

const primaryButtonClassName =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-(--pt-red) px-5 text-sm font-extrabold text-white transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButtonClassName =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 border-(--campaign-line) bg-white px-5 text-sm font-extrabold text-(--pt-red) transition-colors hover:bg-(--campaign-band) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:ring-offset-2 focus-visible:outline-none'
const controlButtonClassName =
  'inline-flex size-11 items-center justify-center rounded-lg border border-(--campaign-line) bg-white text-(--campaign-ink) transition-colors hover:bg-(--campaign-band) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none'

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
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const nameInputId = useId()
  const zoomInputId = useId()

  const photoWindow = model.photoWindow
  const photoSize = photo ? { width: photo.naturalWidth, height: photo.naturalHeight } : null

  useEffect(() => {
    let cancelled = false

    const draw = async () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return

      setLoadState('loading')
      try {
        await ensureCardFont(fontFamily)
        const base = await loadCardImage(model.assetSrc)
        if (cancelled) return

        ctx.clearRect(0, 0, model.width, model.height)

        if (model.kind === 'name') {
          const fit = renderNameCard(ctx, model, {
            image: base,
            name,
            fontFamily,
            measure: createCardMeasure(ctx, fontFamily),
          })
          if (!cancelled) setNameFit(fit)
        } else if (photo && photoTransform && photoWindow) {
          const clamped = renderPhotoCard(ctx, {
            photo,
            frame: base,
            photoSize: { width: photo.naturalWidth, height: photo.naturalHeight },
            frameSize: { width: model.width, height: model.height },
            window: photoWindow,
            transform: photoTransform,
          })
          if (
            !cancelled &&
            (clamped.zoom !== photoTransform.zoom ||
              clamped.offsetX !== photoTransform.offsetX ||
              clamped.offsetY !== photoTransform.offsetY)
          ) {
            setPhotoTransform(clamped)
          }
        } else if (photoWindow) {
          ctx.fillStyle = '#ded8d2'
          ctx.fillRect(0, 0, model.width, model.height)
          ctx.drawImage(base, 0, 0, model.width, model.height)
        }

        if (!cancelled) setLoadState('ready')
      } catch {
        if (!cancelled) setLoadState('error')
      }
    }

    void draw()
    return () => {
      cancelled = true
    }
  }, [model, name, photo, photoTransform, photoWindow, fontFamily])

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

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!photoSize || !photoTransform || !photoWindow) return
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    const canvas = canvasRef.current
    if (
      !drag ||
      drag.pointerId !== event.pointerId ||
      !photoSize ||
      !photoTransform ||
      !photoWindow
    )
      return
    if (!canvas) return

    const scale = model.width / Math.max(1, canvas.getBoundingClientRect().width)
    const dx = (event.clientX - drag.x) * scale
    const dy = (event.clientY - drag.y) * scale
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY }
    setPhotoTransform(panCardPhotoTransform(photoTransform, photoSize, photoWindow, dx, dy))
  }

  const handlePointerEnd = () => {
    dragRef.current = null
  }

  const panBy = (dx: number, dy: number) => {
    if (!photoSize || !photoTransform || !photoWindow) return
    setPhotoTransform(panCardPhotoTransform(photoTransform, photoSize, photoWindow, dx, dy))
  }

  const zoomTo = (zoom: number) => {
    if (!photoSize || !photoTransform || !photoWindow) return
    setPhotoTransform(zoomCardPhotoTransform(photoTransform, photoSize, photoWindow, zoom))
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

  const isNameModel = model.kind === 'name'
  const nameCanAdvance = nameFit?.ok === true
  const canAdvance = isNameModel ? nameCanAdvance : photo !== null
  const nameError = isNameModel && name.trim().length > 0 && nameFit !== null && !nameFit.ok
  const title =
    step === 'result'
      ? 'Seu card está pronto para compartilhar.'
      : isNameModel
        ? 'Personalize com seu nome'
        : 'Enquadre sua foto'
  const description =
    step === 'result' || isNameModel
      ? null
      : 'Arraste para posicionar e use os controles para aproximar ou ajustar.'

  const header =
    shell === 'dialog' ? (
      <DialogHeader className="min-w-0 text-left">
        <DialogTitle className="text-xl font-black tracking-[-0.01em] text-balance">
          {title}
        </DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
    ) : (
      <DrawerHeader className="min-w-0 text-left">
        <DrawerTitle className="text-lg font-black tracking-[-0.01em] text-balance">
          {title}
        </DrawerTitle>
        {description ? <DrawerDescription>{description}</DrawerDescription> : null}
      </DrawerHeader>
    )

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
          className={`relative mx-auto w-full max-w-[22rem] ${photo ? 'touch-none' : ''}`}
          tabIndex={photo ? 0 : undefined}
          role={photo ? 'group' : undefined}
          aria-label={photo ? 'Ajuste da foto' : undefined}
          onKeyDown={
            photo
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
            onPointerDown={photo ? handlePointerDown : undefined}
            onPointerMove={photo ? handlePointerMove : undefined}
            onPointerUp={photo ? handlePointerEnd : undefined}
            onPointerCancel={photo ? handlePointerEnd : undefined}
          />
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
                Não foi possível encaixar esse nome no card. Use um nome mais curto, como você é
                chamado.
              </p>
            ) : null}
            <p className="mt-2 text-xs text-(--campaign-muted)">{PRIVACY_NOTE}</p>
          </div>
        ) : null}

        {step === 'compose' && !isNameModel && photoWindow ? (
          <div className="mt-5">
            {photo && photoTransform ? (
              <>
                <div className="flex items-center gap-3">
                  <label htmlFor={zoomInputId} className="text-sm font-bold text-(--campaign-ink)">
                    Zoom
                  </label>
                  <button
                    type="button"
                    aria-label="Diminuir zoom"
                    onClick={() => zoomTo(photoTransform.zoom - 0.1)}
                    className={controlButtonClassName}
                  >
                    <MinusIcon className="size-4" aria-hidden="true" />
                  </button>
                  <input
                    id={zoomInputId}
                    type="range"
                    min={CARD_PHOTO_MIN_ZOOM}
                    max={CARD_PHOTO_MAX_ZOOM}
                    step={0.05}
                    value={photoTransform.zoom}
                    onChange={(event) => zoomTo(Number(event.target.value))}
                    className="h-11 w-full flex-1 accent-(--pt-red)"
                  />
                  <button
                    type="button"
                    aria-label="Aumentar zoom"
                    onClick={() => zoomTo(photoTransform.zoom + 0.1)}
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
            ) : (
              <p className="text-sm text-(--campaign-muted)">
                Escolha uma foto vertical ou horizontal para começar.
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void handlePhotoFile(event.target.files?.[0])}
            />

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

            <p className="mt-3 text-xs text-(--campaign-muted)">{PHOTO_PRIVACY_NOTE}</p>
          </div>
        ) : null}

        {step === 'result' ? (
          <div className="mt-5">
            <p className="text-sm text-(--campaign-muted)">{PRIVACY_NOTE}</p>
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
              Criar meu card
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
