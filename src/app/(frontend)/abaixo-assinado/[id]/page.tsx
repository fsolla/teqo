import { PetitionForm } from '@/components/PetitionForm'
import { SignatureCounter } from '@/components/SignatureCounter'
import { getSignatureCount } from '@/app/(frontend)/actions/getSignatureCount'
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
  const petition = await getCachedDocumentById('petition', (await params).id)()

  if (!petition || !petition.enabled) {
    return notFound()
  }

  const consentHTML =
    typeof petition.form.consent !== 'number'
      ? convertLexicalToHTML({ data: petition.form.consent.text })
      : ''

  const signatureCount = await getSignatureCount(petition.id)

  return (
    <main
      data-theme="petition"
      className="h-screen w-screen overflow-y-auto bg-background text-foreground"
    >
      <section className="relative overflow-hidden border-b border-border bg-[var(--petition-hero)] text-[var(--petition-hero-foreground)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--petition-hero-glow),transparent_40%),radial-gradient(circle_at_bottom_left,var(--petition-hero-depth),transparent_46%)]" />
        <div className="relative mx-auto flex min-h-[72vh] w-full max-w-5xl items-center justify-center px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center space-y-6 text-center">
            <span className="inline-flex w-fit rounded-full border border-white/20 bg-[var(--petition-hero-chip)] px-3 py-1 text-xs font-medium uppercase tracking-wider text-[var(--petition-hero-chip-foreground)]">
              Abaixo-assinado
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {petition.title}
            </h1>
            <h2 className="max-w-2xl border-none text-lg leading-relaxed text-[var(--petition-hero-muted)] sm:text-xl">
              {petition.subtitle}
            </h2>
            <SignatureCounter
              petitionId={petition.id}
              initialCount={signatureCount}
              variant="hero"
            />
            <div className="flex flex-wrap justify-center gap-3 border-t border-white/15 pt-6">
              <Link
                href="#formulario"
                className="inline-flex items-center justify-center rounded-md bg-[var(--petition-hero-cta)] px-5 py-2.5 text-sm font-semibold text-[var(--petition-hero-cta-foreground)] transition-colors hover:bg-[color-mix(in_oklab,var(--petition-hero-cta)_90%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Assinar agora
              </Link>
              <Link
                href="#detalhes"
                className="inline-flex items-center justify-center rounded-md border border-white/30 bg-transparent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Ler detalhes
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="detalhes"
        className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16"
      >
        <article
          className="space-y-6 text-lg leading-8 text-foreground/90 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:border-none [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-primary [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-lg [&_strong]:font-semibold [&_strong]:text-foreground"
          dangerouslySetInnerHTML={{ __html: convertLexicalToHTML({ data: petition.body }) }}
        />
      </section>

      <section className="border-t border-border bg-[var(--petition-form-section)]">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-16">
          <div className="space-y-4 self-start">
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Participe da mobilização
            </span>
            <h2 className="border-none text-left text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              Sua assinatura fortalece a pressão pela jornada 5x2.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              Preencha o formulário para somar apoio público à proposta. Os dados serão usados
              apenas para registrar sua participação nesta campanha.
            </p>
            <SignatureCounter
              petitionId={petition.id}
              initialCount={signatureCount}
              variant="card"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-[0_24px_60px_rgb(122_25_18/0.12)] sm:p-7">
            <PetitionForm id="formulario" petition={petition} consentHTML={consentHTML} />
          </div>
        </div>
      </section>
    </main>
  )
}
