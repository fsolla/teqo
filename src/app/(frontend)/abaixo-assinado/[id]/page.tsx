import { PetitionForm } from '@/components/PetitionForm'
import { getCachedDocumentById, getDocuments } from '@/utilities/documents'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  const payload = await getDocuments('petition')

  return payload.docs.map((doc) => ({
    id: doc.id,
  }))
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const petition = await getCachedDocumentById('petition', (await params).id)

  if (!petition || !petition.enabled) {
    return notFound()
  }

  return (
    <main className="bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,oklch(var(--primary)/0.2),transparent_40%),radial-gradient(circle_at_bottom_left,oklch(var(--accent)/0.18),transparent_45%)]" />
        <div className="relative mx-auto flex min-h-[75vh] w-full max-w-4xl items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center space-y-6 text-center">
            <span className="inline-flex w-fit rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Abaixo-assinado
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {petition.title}
            </h1>
            <h2 className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {petition.subtitle}
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="#formulario"
                className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Assinar agora
              </Link>
              <Link
                href="#detalhes"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Ler detalhes
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="detalhes"
        className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16"
      >
        <article
          className="space-y-5 leading-relaxed text-foreground/90 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-base [&_strong]:text-foreground"
          dangerouslySetInnerHTML={{ __html: convertLexicalToHTML({ data: petition.body }) }}
        />
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <PetitionForm id="formulario" petition={petition} />
          </div>
        </div>
      </section>
    </main>
  )
}
