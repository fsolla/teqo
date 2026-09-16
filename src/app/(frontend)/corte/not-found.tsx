import { SiteHeader } from '@/components/SiteHeader'
import { XCircleIcon } from 'lucide-react'
import Link from 'next/link'

/**
 * C167/C176 — the same friendly screen for an unpublished cut and an unknown
 * id: the link is gone, and the page does not reveal whether the cut existed.
 */
export default function SpeechCutNotFound() {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <main className="flex w-full flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-lg text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <XCircleIcon className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            Este corte não está disponível
          </h1>
          <p className="mx-auto mt-3 max-w-[48ch] text-base leading-7 text-muted-foreground">
            O conteúdo pode ter sido removido ou o endereço não está correto.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            Voltar ao início
          </Link>
        </div>
      </main>
    </div>
  )
}
