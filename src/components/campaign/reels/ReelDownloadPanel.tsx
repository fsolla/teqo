import {
  CaptionsIcon,
  DownloadIcon,
  FileTextIcon,
  MusicIcon,
  SquarePlayIcon,
  type LucideIcon,
} from 'lucide-react'

import type { ReelDetailViewModel, ReelDownloadItemViewModel, ReelDownloadKind } from '@/lib/reel'

const iconByKind: Record<ReelDownloadKind, LucideIcon> = {
  video: DownloadIcon,
  'video-audio': SquarePlayIcon,
  narration: MusicIcon,
  captions: CaptionsIcon,
}

/**
 * C194 — the downloads of one reel. The silent video is the primary CTA; the
 * optional artifacts are grouped below with the honest reason when they were
 * never produced. While the reel is unpublished every row states that the
 * files return on republication (no dead links — C193 decision B).
 */
export const ReelDownloadPanel = ({ reel }: { reel: ReelDetailViewModel }) => {
  const primary = reel.downloads.find((item) => item.primary)
  const secondary = reel.downloads.filter((item) => !item.primary)

  return (
    <section className="flex flex-col rounded-xl border border-border p-4">
      <div className="order-2 mt-4 lg:order-1 lg:mt-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="hidden text-sm font-semibold lg:block">Downloads</h2>
            <h2 className="text-sm font-semibold lg:hidden">Outros arquivos</h2>
            <p className="mt-1 hidden text-xs leading-5 text-muted-foreground lg:block">
              Arquivos deste reel para finalizar e publicar fora do Teqo.
            </p>
          </div>
          <DownloadIcon
            className="hidden size-5 shrink-0 text-muted-foreground lg:block"
            aria-hidden="true"
          />
        </div>
      </div>

      {primary ? (
        <div className="order-1 lg:order-2">
          <PrimaryDownload item={primary} />
        </div>
      ) : null}

      <div className="order-3 mt-3 divide-y divide-border rounded-lg border border-border">
        {secondary.map((item) => (
          <DownloadRow key={item.kind} item={item} />
        ))}
        {reel.transcript ? (
          <a href="#transcricao" className="flex min-h-12 items-center gap-3 px-3">
            <FileTextIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Transcrição / roteiro</p>
              <p className="text-xs text-muted-foreground">Texto simples</p>
            </div>
            <span className="text-xs underline underline-offset-4">Ler</span>
          </a>
        ) : null}
      </div>
    </section>
  )
}

const PrimaryDownload = ({ item }: { item: ReelDownloadItemViewModel }) => {
  if (!item.href) {
    return (
      <div className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/35 px-4 text-sm">
        <span className="font-medium">{item.label}</span>
        <span className="text-xs text-muted-foreground">{item.unavailableLabel}</span>
      </div>
    )
  }

  return (
    <a
      href={item.href}
      className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
    >
      <DownloadIcon className="size-4" aria-hidden="true" />
      Baixar {item.label.toLowerCase()}
    </a>
  )
}

const DownloadRow = ({ item }: { item: ReelDownloadItemViewModel }) => {
  const Icon = iconByKind[item.kind]

  if (!item.href) {
    return (
      <div className="flex min-h-12 items-center gap-3 bg-muted/35 px-3 opacity-65">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{item.label}</p>
          <p className="text-xs text-muted-foreground">{item.unavailableLabel}</p>
        </div>
        <span className="text-xs text-muted-foreground">Indisponível</span>
      </div>
    )
  }

  return (
    <a href={item.href} className="flex min-h-12 items-center gap-3 px-3">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </div>
      <span className="text-xs underline underline-offset-4">Baixar</span>
    </a>
  )
}
