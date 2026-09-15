import { SiteHeader } from '@/components/SiteHeader'
import Link from 'next/link'

/**
 * C167 — the same friendly screen for an unpublished cut and an unknown id:
 * the link is gone, and the page does not reveal whether the cut existed.
 */
export default function SpeechCutNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex w-full items-center justify-center px-4 py-24">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Este corte não está disponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O link pode ter sido despublicado ou o endereço está incorreto.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg border px-4 text-sm"
          >
            Ir para jorgesolla1313.com.br
          </Link>
        </div>
      </main>
    </>
  )
}
