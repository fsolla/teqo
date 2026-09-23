import { contentPieceMediaKind, type ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import { cn } from '@/lib/utils'

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

const PlayButton = ({ label, onToggle }: { label: string; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={label}
    className="absolute grid size-14 place-items-center rounded-full bg-(--pt-yellow) text-(--pt-yellow-ink) shadow-[0_6px_0_#cfb900,0_10px_22px_rgb(0_0_0/15%)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-[0_3px_0_#cfb900] motion-reduce:transition-none sm:size-16"
  >
    <PlayIcon />
  </button>
)

const DurationBadge = ({ label }: { label: string | null }) =>
  label ? (
    <span className="absolute right-3 bottom-3 rounded bg-black/70 px-2 py-1 text-xs text-white">
      {label}
    </span>
  ) : null

export const ContentPieceMedia = ({
  item,
  playing,
  onToggle,
  onEnded,
  variant = 'card',
  className,
}: {
  item: ContentPiecePublicItem
  playing: boolean
  onToggle: () => void
  onEnded: () => void
  variant?: 'card' | 'thumb' | 'detail'
  className?: string
}) => {
  const kind = contentPieceMediaKind(item)
  const base = cn('relative overflow-hidden bg-(--campaign-band)', className)

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
        <span className="absolute top-3 left-3 text-[10px] font-black tracking-[0.14em] text-(--campaign-muted) uppercase">
          {item.typeLabel}
        </span>
        <PlayButton label={`Reproduzir ${item.title}`} onToggle={onToggle} />
        <DurationBadge label={item.durationLabel} />
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
