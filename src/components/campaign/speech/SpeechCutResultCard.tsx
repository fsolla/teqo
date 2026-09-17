'use client'

import { CheckCircle2Icon, ExternalLinkIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { SpeechCutShareActions } from '@/components/SpeechCutShareActions'
import type { SpeechCutViewModel } from '@/lib/speechCut'
import { youtubeThumbnailUrl } from '@/lib/speechVod'

/**
 * C167 — the acervo result of a published cut: the public link with the share
 * kit (copy/WhatsApp/download), an Open Graph preview and the pointer to the
 * cut library (C168). Lives in session: after a reload the cut is reached
 * through its public link or, later, the library.
 */
export const SpeechCutResultCard = ({ cut }: { cut: SpeechCutViewModel }) => {
  const [absoluteUrl, setAbsoluteUrl] = useState('')

  useEffect(() => {
    setAbsoluteUrl(new URL(cut.publicPath, window.location.origin).toString())
  }, [cut.publicPath])

  const host = absoluteUrl ? new URL(absoluteUrl).host : null

  return (
    <section
      data-slot="speech-cut-result"
      className="mt-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5"
    >
      <div className="flex items-center gap-3">
        <CheckCircle2Icon className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">Corte publicado</p>
          <p className="text-xs text-muted-foreground">
            O arquivo do trecho está salvo e a página pública já está no ar.
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs tracking-wide text-muted-foreground uppercase">
        Link público (funciona no WhatsApp)
      </p>
      <div className="mt-1.5 flex items-stretch gap-2">
        <div className="flex min-h-10 min-w-0 flex-1 items-center rounded-lg border bg-muted/40 px-3 font-mono text-xs sm:text-sm">
          <span className="truncate">{absoluteUrl || cut.publicPath}</span>
        </div>
      </div>

      <SpeechCutShareActions
        className="mt-3"
        url={absoluteUrl || cut.publicPath}
        title={cut.title}
        downloadUrl={cut.mediaUrl}
        downloadFilename={cut.mediaFilename}
      />

      <Link
        href={cut.publicPath}
        target="_blank"
        className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4"
      >
        Abrir página do corte
        <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
      </Link>

      <div className="mt-4 flex flex-wrap items-start gap-4 border-t pt-3">
        {cut.youtubeVideoId ? (
          // eslint-disable-next-line @next/next/no-img-element -- YouTube cover is an external OG image.
          <img
            src={youtubeThumbnailUrl(cut.youtubeVideoId) ?? undefined}
            alt=""
            className="h-20 w-32 rounded-lg border object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{cut.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{cut.description}</p>
          {host ? (
            <p className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">{host}</p>
          ) : null}
        </div>
      </div>

      <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        O arquivo também fica disponível na biblioteca de cortes — é lá que se despublica o corte.
      </p>
    </section>
  )
}
