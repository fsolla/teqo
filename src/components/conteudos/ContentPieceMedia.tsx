import { contentPieceMediaKind, type ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import { cn } from '@/lib/utils'
import { useCallback, useState } from 'react'

/**
 * The media states read this subset of the public item, so the S39 home
 * projection (leaner, no search haystack) renders through the same component.
 */
type ContentPieceMediaItem = Pick<
  ContentPiecePublicItem,
  | 'isLink'
  | 'file'
  | 'framePath'
  | 'type'
  | 'origin'
  | 'originLabel'
  | 'title'
  | 'excerpt'
  | 'durationLabel'
  | 'typeLabel'
>

/**
 * S27 — the piece asset (artefato: cenas 01/02/03/07): a photo previews, a
 * text shows its opening, a video/audio only mounts the media element after
 * the voter taps play (`preload="none"`, nothing is fetched before the
 * gesture) and a link piece shows where it lives. The owner of the play state
 * is the host (catalogue keeps one at a time; the piece page keeps its own).
 */

const PlayIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-current stroke-current">
    <path d="m8 5 11 7-11 7z" />
  </svg>
)

const PlayButton = ({
  label,
  onToggle,
  compact = false,
}: {
  label: string
  onToggle: () => void
  /** C226 — the 124px home thumb (artefato cena 05) has room for a 44px play only. */
  compact?: boolean
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={label}
    className={cn(
      'absolute grid place-items-center rounded-full bg-(--pt-yellow) text-(--pt-yellow-ink) shadow-[0_6px_0_#cfb900,0_10px_22px_rgb(0_0_0/15%)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-[0_3px_0_#cfb900] motion-reduce:transition-none',
      compact ? 'size-11 sm:size-16' : 'size-14 sm:size-16',
    )}
  >
    <PlayIcon />
  </button>
)

const DurationBadge = ({ label, compact = false }: { label: string | null; compact?: boolean }) =>
  label ? (
    <span
      className={cn(
        'absolute rounded bg-black/70 text-white',
        compact
          ? 'right-1.5 bottom-1.5 px-1.5 py-0.5 text-[10px] sm:right-3 sm:bottom-3 sm:px-2 sm:py-1 sm:text-xs'
          : 'right-3 bottom-3 px-2 py-1 text-xs',
      )}
    >
      {label}
    </span>
  ) : null

/**
 * C226 — the neutral marker of a piece with no still (artefato cena 04). The
 * piece type keeps reading on the card body tag, so nothing is lost.
 */
/**
 * C226 — the honest marker of a piece with no still (artefato cenas 04/05). The
 * `compact` form is the 124px home thumb, where the neutral surface itself is
 * the message and the marker would crowd the play; from `sm` up, where that
 * card becomes a full block, the complete marker returns (cena 05).
 */
const FrameUnavailableMarker = ({
  detail = false,
  compact = false,
}: {
  detail?: boolean
  compact?: boolean
}) => (
  <span
    className={cn(
      'absolute top-3 left-3 z-10 items-center gap-2 text-[10px] font-black tracking-[0.1em] text-(--campaign-muted) uppercase',
      compact ? 'hidden sm:flex' : 'flex',
    )}
  >
    <span
      aria-hidden="true"
      className={cn(
        'grid place-items-center rounded-full border border-black/10 bg-white',
        detail ? 'size-7' : 'size-6',
      )}
    >
      ×
    </span>
    Frame indisponível
  </span>
)

export const ContentPieceMedia = ({
  item,
  playing,
  onToggle,
  onEnded,
  variant = 'card',
  className,
}: {
  item: ContentPieceMediaItem
  playing: boolean
  onToggle: () => void
  onEnded: () => void
  variant?: 'card' | 'thumb' | 'detail' | 'home-thumb'
  className?: string
}) => {
  const kind = contentPieceMediaKind(item)
  const base = cn('relative overflow-hidden bg-(--campaign-band)', className)
  // C226 — the still lives in the slot the play state shares, so the knowledge
  // that this piece has no frame is held by the host, not by the layer that
  // remounts on every play: `failed` is terminal for the card, never retried (a
  // broken image would be a lie and the retry would hammer the route).
  const [frameState, setFrameState] = useState<'loading' | 'ready' | 'failed'>('loading')
  // A still whose load settled BEFORE React attached the handlers (a warm
  // cache, an SSR page, a 404) fires NEITHER `load` nor `error` again — the
  // ref is the only place that can still tell a decoded image from a failed
  // one, and without it the fastest paths are exactly the broken ones.
  const settleLoadedFrame = useCallback((node: HTMLImageElement | null) => {
    if (!node?.complete) return
    setFrameState(node.naturalWidth > 0 ? 'ready' : 'failed')
  }, [])

  if (kind === null) {
    return (
      <div
        className={cn(
          base,
          'grid place-items-center bg-[linear-gradient(145deg,#fff4f5,#eef4fb)]',
          variant === 'detail' && 'rounded-2xl border border-[#184e92]/15',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute -right-10 -bottom-16 size-48 rounded-full border-[28px] border-[#e4102f]/10',
            item.origin === 'youtube' &&
              'right-auto bottom-auto -top-16 -left-10 border-[#184e92]/10',
          )}
        />
        <div className="relative px-3 text-center">
          <p className="text-[10px] font-black tracking-[0.18em] text-(--campaign-muted) uppercase">
            Peça no {item.originLabel}
          </p>
          <p
            className={cn(
              'mt-2 font-[family-name:var(--font-exo2)] font-black',
              item.origin === 'instagram' ? 'text-[#e4102f]' : 'text-[#184e92]',
              variant === 'detail' ? 'text-4xl' : 'text-2xl',
            )}
          >
            {item.originLabel}
          </p>
          <p className="mt-1 text-xs text-(--campaign-muted)">
            {variant === 'detail'
              ? 'A mídia permanece na plataforma original.'
              : 'Conteúdo hospedado na plataforma'}
          </p>
        </div>
      </div>
    )
  }

  if (kind === 'image') {
    return (
      <div className={cn(base, variant === 'detail' && 'rounded-2xl border border-black/10')}>
        {/* eslint-disable-next-line @next/next/no-img-element -- private proxy path with on-demand headers */}
        <img
          src={item.file?.path}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  if (kind === 'text') {
    return (
      <div
        className={cn(
          base,
          'grid place-items-center bg-(--campaign-cream) px-3 text-center',
          variant === 'detail' && 'rounded-2xl border border-black/10',
        )}
      >
        <p
          className={cn(
            'font-[family-name:var(--font-exo2)] font-black text-(--pt-red-dark)',
            variant === 'detail' ? 'text-xl leading-8 sm:text-2xl' : 'text-sm leading-5',
          )}
        >
          “{item.excerpt ?? item.title}”
        </p>
      </div>
    )
  }

  if (kind === 'video' || kind === 'audio') {
    if (playing) {
      return (
        <div
          className={cn(
            base,
            'bg-[#180a09]',
            variant === 'detail' && 'rounded-2xl border border-black/10',
          )}
        >
          {kind === 'video' ? (
            <video
              controls
              autoPlay
              playsInline
              preload="none"
              src={item.file?.path}
              onEnded={onEnded}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="grid h-full w-full place-items-center p-4">
              <audio
                controls
                autoPlay
                preload="none"
                src={item.file?.path}
                onEnded={onEnded}
                className="w-full"
              />
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        className={cn(
          base,
          'grid place-items-center bg-[linear-gradient(135deg,#e5e2df,#f7f5f3)]',
          variant === 'detail' && 'rounded-2xl border border-black/10',
        )}
      >
        {kind === 'video' && item.framePath && frameState !== 'failed' && (
          // eslint-disable-next-line @next/next/no-img-element -- private proxy path with on-demand headers
          <img
            src={item.framePath}
            // Decorative on purpose: the play button already names the slot
            // ("Reproduzir <título>") and the title sits right below it.
            alt=""
            loading="lazy"
            decoding="async"
            ref={settleLoadedFrame}
            onLoad={() => setFrameState('ready')}
            onError={() => setFrameState('failed')}
            // Invisible until it decodes: a failed image would otherwise paint
            // the browser's broken-image glyph over the slot for a moment, and
            // the design's honest state is the neutral surface, never a glyph.
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
              frameState !== 'ready' && 'opacity-0',
            )}
          />
        )}
        {/* A piece whose projection declares no frame, and one whose still the
            route could not produce: the same honest slot, no broken image. */}
        {kind === 'video' && (!item.framePath || frameState === 'failed') && (
          <FrameUnavailableMarker
            detail={variant === 'detail'}
            compact={variant === 'home-thumb'}
          />
        )}
        {kind === 'audio' && (
          <span className="absolute top-3 left-3 text-[10px] font-black tracking-[0.14em] text-(--campaign-muted) uppercase">
            {item.typeLabel}
          </span>
        )}
        <PlayButton
          label={`Reproduzir ${item.title}`}
          onToggle={onToggle}
          compact={variant === 'home-thumb'}
        />
        <DurationBadge label={item.durationLabel} compact={variant === 'home-thumb'} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        base,
        'grid place-items-center bg-[linear-gradient(135deg,#e5e2df,#f7f5f3)] px-3 text-center',
        variant === 'detail' && 'rounded-2xl border border-black/10',
      )}
    >
      <p className="text-xs font-bold text-(--campaign-muted)">
        {item.file ? 'Baixe a peça para ver o arquivo.' : 'Sem arquivo para pré-visualizar.'}
      </p>
    </div>
  )
}
