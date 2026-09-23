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
  CARD_COLINHA_PRIVACY_NOTE,
  CARD_HARMONY_HELP,
  CARD_HARMONY_LABEL,
  CARD_PHOTO_PRIVACY_NOTE,
  CARD_PRIVACY_NOTE,
} from '@/components/cards/cardCopy'
import { CardPreviewCanvas } from '@/components/cards/CardPreviewCanvas'
import { StateDeputySelect } from '@/components/cards/StateDeputySelect'
import { useCardCutout } from '@/components/cards/useCardCutout'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { COLINHA_FONT_FAMILY, colinhaVoteRows } from '@/lib/cardColinha'
import { TEAM_CARD_NAME_SLOT, type CardModel, type CardRect } from '@/lib/cardModels'
import { fitCardName, type CardNameFit } from '@/lib/cardNameFit'
import {
  CARD_PHOTO_MAX_ZOOM,
  CARD_PHOTO_MIN_ZOOM,
  cardPhotoTransformsEqual,
  centerCardPhotoTransform,
  panCardPhotoTransform,
  zoomCardPhotoTransform,
  type CardPhotoSize,
  type CardPhotoTransform,
} from '@/lib/cardPhotoTransform'
import {
  createCardMeasure,
  renderColinhaCard,
  renderNameCard,
  renderPhotoCard,
  renderTeamCard,
} from '@/lib/cardRender'
import { sendCardDownloadEvent } from '@/lib/contentEvents'
import { getStateDeputyCard, type StateDeputyCatalogEntry } from '@/lib/stateDeputyCatalog'

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

/**
 * S30 — the dobradinha preview gets the gate's larger stage (scene 4: 230px
 * desktop; scene 5: 205px mobile) while the S15 tokens above stay untouched.
 * `selected` is the chosen-but-photoless state, which the gate draws at the same
 * prominence as the result; the pre-selection and the too-long error stay
 * compact (scenes 3 and 4-right).
 */
type StateDeputyPreviewStage = TeamPreviewStage | 'selected'
const STATE_DEPUTY_PREVIEW_WIDTH: Record<StateDeputyPreviewStage, string> = {
  idle: 'max-w-[10.75rem]',
  processing: 'max-w-[9rem]',
  ready: 'max-w-[12.8125rem] sm:max-w-[15rem]',
  result: 'max-w-[12.8125rem] sm:max-w-[14.375rem]',
  selected: 'max-w-[12.8125rem] sm:max-w-[14.375rem]',
}

/**
 * S31 — the colinha stages of the design gate: compact while the estadual is
 * unchosen (scene 2, 145px) and the scene 3/5 stage after the pick (405px
 * desktop, 300px mobile).
 */
const COLINHA_PREVIEW_WIDTH: Record<'idle' | 'selected', string> = {
  idle: 'max-w-[9.0625rem]',
  selected: 'max-w-[18.75rem] sm:max-w-[25.3125rem]',
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
  /** S31 — the colinha brand lockup of the top box (`lockupSrc`). */
  const [lockupImage, setLockupImage] = useState<HTMLImageElement | null>(null)
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  /** S17 — LIGADO by default; resets only when the composer unmounts (no persistence). */
  const [harmonyEnabled, setHarmonyEnabled] = useState(true)
  /** S30 — the state deputy of the dobradinha model (name/number/art pair). */
  const [selectedDeputySlug, setSelectedDeputySlug] = useState<string | null>(null)
  const [deputyImages, setDeputyImages] = useState<{
    slug: string
    photos: HTMLImageElement
    base: HTMLImageElement
  } | null>(null)
  const [deputyAssetError, setDeputyAssetError] = useState(false)
  /** Bumped when the same deputy is re-picked after a pair load failure. */
  const [deputyReloadToken, setDeputyReloadToken] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const nameInputId = useId()
  const zoomInputId = useId()

  const photoWindow = model.photoWindow
  const isNameModel = model.kind === 'name'
  const isTeamModel = model.kind === 'team'
  const isColinhaModel = model.kind === 'colinha'
  const isStateDeputyModel = isTeamModel && model.stateDeputyPicker === true
  const selectedDeputy = selectedDeputySlug
    ? (getStateDeputyCard(selectedDeputySlug) ?? null)
    : null
  /** S31 — the estadual row owns the label/case of the `Linha conferida` copy. */
  const estadualRow = colinhaVoteRows(selectedDeputy)[1]
  const deputyPairReady = selectedDeputy !== null && deputyImages?.slug === selectedDeputy.slug
  // S30 — the tone reference is the selected deputy's group art, frozen when the
  // cutout starts (switching the deputy later keeps the processed photo).
  const cutout = useCardCutout(
    photoWindow,
    isStateDeputyModel ? selectedDeputy?.photosSrc : isTeamModel ? model.assetSrc : undefined,
  )
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
    setLockupImage(null)
    setPreviewImage(null)

    const load = async () => {
      try {
        const fontReady = await ensureCardFont(fontFamily)
        if (!fontReady) throw new Error('card-font-unavailable')
        // S30 — the dobradinha model loads its art pair per selection (below);
        // the static defaults stay unused so no illustrative JULIO art flashes
        // before the choice. S31 — the colinha composes the top from its three
        // official assets and never draws the tile art (`previewSrc`).
        const [image, overlay, lockup, preview] = await Promise.all([
          isStateDeputyModel ? Promise.resolve(null) : loadCardImage(model.assetSrc),
          !isStateDeputyModel && model.overlaySrc
            ? loadCardImage(model.overlaySrc)
            : Promise.resolve(null),
          model.lockupSrc ? loadCardImage(model.lockupSrc) : Promise.resolve(null),
          model.previewSrc && !isColinhaModel
            ? loadCardImage(model.previewSrc)
            : Promise.resolve(null),
        ])
        if (cancelled) return
        setBaseImage(image)
        setOverlayImage(overlay)
        setLockupImage(lockup)
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
  }, [
    isStateDeputyModel,
    isColinhaModel,
    model.assetSrc,
    model.overlaySrc,
    model.lockupSrc,
    model.previewSrc,
    fontFamily,
  ])

  /**
   * S30 — the selected deputy's pair swaps in place: the previous art stays
   * painted until both files decode (no loading state, no flicker) and the name
   * and cutout states are untouched by the swap.
   */
  useEffect(() => {
    if (!isStateDeputyModel || !selectedDeputy) return

    let cancelled = false
    setDeputyAssetError(false)

    const load = async () => {
      try {
        const [photos, base] = await Promise.all([
          loadCardImage(selectedDeputy.photosSrc),
          loadCardImage(selectedDeputy.baseSrc),
        ])
        if (cancelled) return
        setDeputyImages({ slug: selectedDeputy.slug, photos, base })
      } catch {
        if (!cancelled) setDeputyAssetError(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isStateDeputyModel, selectedDeputy, deputyReloadToken])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || loadState !== 'ready') return

    const measure = createCardMeasure(ctx, fontFamily)

    if (isNameModel) {
      if (!baseImage) return
      ctx.clearRect(0, 0, model.width, model.height)
      setNameFit(renderNameCard(ctx, model, { image: baseImage, name, fontFamily, measure }))
      return
    }

    if (isColinhaModel) {
      // S31 — the slip: official top composition + legal + the six rows; the
      // estadual row follows the shared selection and the fixed rows never
      // change. No name, photo or cutout enters this flow.
      if (!baseImage || !overlayImage || !lockupImage) return
      ctx.clearRect(0, 0, model.width, model.height)
      renderColinhaCard(ctx, model, {
        group: baseImage,
        lockup: lockupImage,
        band: overlayImage,
        deputy: selectedDeputy,
        fontFamily: COLINHA_FONT_FAMILY,
        measure: createCardMeasure(ctx, COLINHA_FONT_FAMILY, 900),
      })
      return
    }

    if (isTeamModel) {
      // S30 — the dobradinha pair comes from the selected catalog entry: `photos`
      // is the FOTOS background (drawn under the cutout) and `base` is the front
      // BASE overlay (drawn above it) — the opposite of the S15 masters.
      const artBase = isStateDeputyModel ? deputyImages?.photos : baseImage
      const artOverlay = isStateDeputyModel ? deputyImages?.base : overlayImage

      if (isStateDeputyModel && !selectedDeputy) {
        // Before the choice: the approved example art (no banners), exactly the
        // gate's scene 3 placeholder.
        ctx.clearRect(0, 0, model.width, model.height)
        setNameFit(fitCardName(name, measure, TEAM_CARD_NAME_SLOT))
        if (previewImage) ctx.drawImage(previewImage, 0, 0, model.width, model.height)
        return
      }

      // Art not decoded yet (first selection or a swap in flight): keep the
      // current frame painted instead of clearing to a bare canvas.
      if (!artBase || !artOverlay) return

      ctx.clearRect(0, 0, model.width, model.height)

      if (teamReady && effectiveTransform && photoWindow) {
        const result = renderTeamCard(ctx, model, {
          base: artBase,
          overlay: artOverlay,
          subject: {
            kind: 'photo',
            photo: harmonyEnabled && teamReady.harmonized ? teamReady.harmonized : teamReady.canvas,
            photoSize: { width: teamReady.width, height: teamReady.height },
            transform: effectiveTransform,
          },
          window: photoWindow,
          name,
          fontFamily,
          measure,
        })
        setNameFit(result.fit)
        if (result.transform && !cardPhotoTransformsEqual(result.transform, effectiveTransform)) {
          setPhotoTransform(result.transform)
        }
        return
      }

      if (isStateDeputyModel) {
        // Chosen but no photo yet: the visitor silhouette marks the photo slot.
        if (!photoWindow) return
        setNameFit(
          renderTeamCard(ctx, model, {
            base: artBase,
            overlay: artOverlay,
            subject: { kind: 'silhouette' },
            window: photoWindow,
            name,
            fontFamily,
            measure,
          }).fit,
        )
        return
      }

      setNameFit(fitCardName(name, measure, TEAM_CARD_NAME_SLOT))
      const idleImage = cutoutState.status === 'idle' && previewImage ? previewImage : artBase
      ctx.drawImage(idleImage, 0, 0, model.width, model.height)
      return
    }

    if (!baseImage) return
    ctx.clearRect(0, 0, model.width, model.height)

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
    lockupImage,
    previewImage,
    loadState,
    isNameModel,
    isTeamModel,
    isColinhaModel,
    isStateDeputyModel,
    selectedDeputy,
    deputyImages,
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

  /** S30 — the swap keeps name and processed photo (only the art pair changes). */
  const handleSelectDeputy = (card: StateDeputyCatalogEntry) => {
    // Re-picking the same entry after a pair failure must retry the load.
    if (card.slug === selectedDeputySlug) setDeputyReloadToken((token) => token + 1)
    setSelectedDeputySlug(card.slug)
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
      panCardPhotoTransform(transform, size, window, dx, dy),
    )
  }

  const handlePointerEnd = () => {
    dragRef.current = null
  }

  const panBy = (dx: number, dy: number) => {
    withTransform((transform, size, window) =>
      panCardPhotoTransform(transform, size, window, dx, dy),
    )
  }

  const zoomTo = (zoom: number) => {
    withTransform((transform, size, window) =>
      zoomCardPhotoTransform(transform, size, window, zoom),
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
      // S32 — anonymous download count (fire-and-forget, never blocks/throws);
      // the state-deputy slug rides along on the models that have a picker.
      sendCardDownloadEvent(model.id, selectedDeputy?.slug ?? null)
    } catch {
      setDownloadError('Não foi possível gerar o arquivo agora. Tente de novo.')
    } finally {
      setIsDownloading(false)
    }
  }

  const nameCanAdvance = nameFit?.ok === true
  const canAdvance = isColinhaModel
    ? selectedDeputy !== null
    : isNameModel
      ? nameCanAdvance
      : isStateDeputyModel
        ? selectedDeputy !== null && deputyPairReady && teamReady !== null && nameCanAdvance
        : isTeamModel
          ? teamReady !== null && nameCanAdvance
          : photo !== null
  const nameError =
    (isNameModel || isTeamModel) && name.trim().length > 0 && nameFit !== null && !nameFit.ok
  const adjustable = isStateDeputyModel
    ? deputyPairReady && teamReady !== null
    : isTeamModel
      ? teamReady !== null
      : photo !== null
  const title = (() => {
    if (step === 'result') return 'Seu card está pronto para compartilhar.'
    if (isNameModel) return 'Personalize com seu nome'
    if (isColinhaModel) {
      if (!selectedDeputy) return 'Escolha seu estadual'
      return shell === 'dialog' ? 'Pronta para levar com você' : 'Pronta para baixar'
    }
    if (isStateDeputyModel && !selectedDeputy) return 'Escolha sua dobradinha'
    if (!isTeamModel) return 'Enquadre sua foto'
    if (teamProcessing) return 'Preparando sua foto'
    if (teamError) return 'Vamos tentar outra vez'
    if (nameError) return 'Encurte o nome'
    if (teamReady) return 'Confira seu card'
    if (isStateDeputyModel) return 'Agora coloque seu nome'
    return 'Entre para o time'
  })()
  const photoHeaderDescription =
    step === 'compose' && !isNameModel && !isTeamModel && !isColinhaModel
      ? 'Arraste para posicionar e use os controles para aproximar ou ajustar.'
      : null
  const stateDeputyHeaderDescription =
    isStateDeputyModel && step === 'compose' && !selectedDeputy
      ? 'Escolha seu estadual da dobradinha.'
      : null
  /**
   * S31 — the colinha description lives only in the dialog: the gate's mobile
   * drawer (scene 5) carries eyebrow + title only, so the compact preview keeps
   * the selector in the first viewport.
   */
  const colinhaHeaderDescription =
    isColinhaModel && step === 'compose' && shell === 'dialog'
      ? selectedDeputy
        ? 'Confira o estadual escolhido. As demais escolhas já vêm preenchidas no modelo oficial.'
        : 'A linha de deputado estadual será preenchida na hora.'
      : null
  const headerDescription =
    photoHeaderDescription ?? stateDeputyHeaderDescription ?? colinhaHeaderDescription
  const teamBodyNotice =
    isTeamModel && step === 'compose' && teamReady && !nameError
      ? 'O recorte já foi centralizado. Se precisar, arraste a foto ou use os controles.'
      : null
  const ShellDescription = shell === 'dialog' ? DialogDescription : DrawerDescription
  const eyebrow = isColinhaModel
    ? 'Minha colinha'
    : isTeamModel
      ? step === 'result'
        ? 'Tudo certo'
        : teamError
          ? 'Falha no recorte'
          : nameError
            ? 'Nome muito longo'
            : isStateDeputyModel
              ? selectedDeputy
                ? 'Estadual escolhido'
                : 'Time do estadual'
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
        {headerDescription ? <ShellDescription>{headerDescription}</ShellDescription> : null}
      </DialogHeader>
    ) : (
      <DrawerHeader className="min-w-0 flex-1 text-left!">
        {eyebrowNode}
        <DrawerTitle className="text-lg font-black tracking-[-0.01em] text-balance">
          {title}
        </DrawerTitle>
        {headerDescription ? <ShellDescription>{headerDescription}</ShellDescription> : null}
      </DrawerHeader>
    )

  const teamPreviewStage: TeamPreviewStage =
    step === 'result' ? 'result' : teamReady ? 'ready' : teamProcessing ? 'processing' : 'idle'
  const stateDeputyPreviewStage: StateDeputyPreviewStage =
    teamPreviewStage === 'idle' && selectedDeputy && !nameError ? 'selected' : teamPreviewStage
  const previewWidthClassName = isColinhaModel
    ? selectedDeputy
      ? COLINHA_PREVIEW_WIDTH.selected
      : COLINHA_PREVIEW_WIDTH.idle
    : isStateDeputyModel
      ? STATE_DEPUTY_PREVIEW_WIDTH[stateDeputyPreviewStage]
      : isTeamModel
        ? TEAM_PREVIEW_WIDTH[teamPreviewStage]
        : 'max-w-[22rem]'

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
          min={CARD_PHOTO_MIN_ZOOM}
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

  // S23 design gate (scene 02): the drawer body carries a scroll tail so the
  // team notice leaves the viewport by the end of the scroll.
  const bodyScrollClassName = `min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 ${
    teamBodyNotice && shell === 'drawer' ? 'pb-14' : 'pb-5'
  }`

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

      <div className={bodyScrollClassName}>
        <p className="sr-only" role="status" aria-live="polite">
          {loadState === 'loading' ? 'Carregando prévia…' : ''}
        </p>

        {teamBodyNotice ? (
          <ShellDescription
            className={`mx-auto text-sm leading-5 text-(--campaign-muted) ${
              shell === 'dialog' ? 'mb-4 max-w-[420px]' : 'mb-3 max-w-[350px]'
            }`}
          >
            {teamBodyNotice}
          </ShellDescription>
        ) : null}

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
            className={`mx-auto block h-auto w-auto max-w-full rounded-lg border border-(--campaign-line) shadow-sm transition-opacity ${
              isColinhaModel ? '' : 'max-h-[38dvh] '
            }${loadState === 'loading' ? 'opacity-60' : 'opacity-100'}`}
            onPointerDown={adjustable ? handlePointerDown : undefined}
            onPointerMove={adjustable ? handlePointerMove : undefined}
            onPointerUp={adjustable ? handlePointerEnd : undefined}
            onPointerCancel={adjustable ? handlePointerEnd : undefined}
          />
        </div>

        {loadState === 'error' ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-(--pt-red)">
            Não foi possível carregar o modelo. Recarregue a página e tente de novo.
          </p>
        ) : null}

        {step === 'compose' && isStateDeputyModel ? (
          <div>
            {!selectedDeputy ? (
              <p className="mt-3 text-center text-[11px] leading-4 text-(--campaign-muted)">
                A silhueta marca o lugar da sua foto. O card final usa a arte do estadual escolhido.
              </p>
            ) : null}
            <StateDeputySelect selected={selectedDeputy} onSelect={handleSelectDeputy} />
            {deputyAssetError ? (
              <p role="alert" className="mt-2 text-sm font-semibold text-(--pt-red)">
                Não foi possível carregar a arte deste estadual. Escolha outro e tente de novo.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 'compose' && isColinhaModel ? (
          <div>
            <StateDeputySelect selected={selectedDeputy} onSelect={handleSelectDeputy} />
            {selectedDeputy ? (
              <div className="mt-4 rounded-lg bg-white p-4 ring-1 ring-(--campaign-line)">
                <p className="text-sm font-bold text-(--campaign-ink)">Linha conferida</p>
                <p className="mt-1 text-sm text-(--campaign-muted)">
                  {estadualRow.officeLines.join(' ')} · {estadualRow.candidate} ·{' '}
                  {selectedDeputy.ballotNumber}
                </p>
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-(--campaign-cream) p-3 text-xs leading-5 text-(--campaign-muted)">
                <span className="block font-bold text-(--campaign-ink)">
                  Escolha um estadual para baixar.
                </span>
                A linha vazia será preenchida com o nome e os cinco dígitos.
              </p>
            )}
            <p className="mt-3 text-xs leading-5 text-(--campaign-muted)">
              {CARD_COLINHA_PRIVACY_NOTE}
            </p>
            {downloadError ? (
              <p role="alert" className="mt-2 text-sm font-semibold text-(--pt-red)">
                {downloadError}
              </p>
            ) : null}
          </div>
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
            {isStateDeputyModel && !selectedDeputy ? (
              <p className="mt-4 rounded-lg bg-(--campaign-cream) p-3 text-xs leading-5 text-(--campaign-muted)">
                <span className="block font-bold text-(--campaign-ink)">
                  Escolha um estadual para continuar.
                </span>
                A prévia e o download usam a arte oficial da dobradinha escolhida.
              </p>
            ) : (
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
            )}
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
                {teamError.reason === 'unsupported'
                  ? 'Seu navegador está bloqueando o recorte de fundo.'
                  : 'Não foi possível remover o fundo desta foto.'}
              </p>
              <p className="mt-1 text-sm leading-5 text-(--campaign-ink)">
                {teamError.reason === 'unsupported'
                  ? 'O recorte roda no seu aparelho e precisa de WebAssembly e WebGL, que navegadores com proteções avançadas (como IronFox e Tor) desligam por padrão. Ative essas opções para este site nas configurações do navegador — ou abra a página em outro navegador — e toque em “Tentar de novo”.'
                  : 'Tente de novo ou escolha outra foto.'}
              </p>
            </div>
            {teamError.reason === 'unsupported' ? null : (
              <p className="mt-4 text-sm leading-5 text-(--campaign-muted)">
                Fotos de busto, nítidas e com fundo simples costumam funcionar melhor.
              </p>
            )}
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
              <>
                {isStateDeputyModel && selectedDeputy ? (
                  <p className="mb-3 text-center text-xs font-bold text-(--campaign-muted)">
                    {selectedDeputy.name} · {selectedDeputy.ballotNumber}
                  </p>
                ) : null}
                <div className="flex items-start gap-3 rounded-lg bg-(--campaign-cream) p-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-green-700 text-white"
                  >
                    <CheckIcon className="size-3.5" aria-hidden="true" />
                  </span>
                  <p className="text-xs leading-5 text-(--campaign-muted)">{CARD_PRIVACY_NOTE}</p>
                </div>
              </>
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
            {isColinhaModel && shell === 'drawer' ? null : (
              <button type="button" onClick={onClose} className={secondaryButtonClassName}>
                Cancelar
              </button>
            )}
            <button
              type="button"
              disabled={!canAdvance || loadState !== 'ready' || (isColinhaModel && isDownloading)}
              onClick={isColinhaModel ? () => void handleDownload() : () => setStep('result')}
              className={primaryButtonClassName}
            >
              {isColinhaModel
                ? isDownloading
                  ? 'Gerando…'
                  : 'Baixar minha colinha'
                : teamProcessing
                  ? 'Processando…'
                  : 'Criar meu card'}
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
