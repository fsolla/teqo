import { getCachedGlobal } from '@/utilities/globalReads'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const getCachedPrivacyPolicy = getCachedGlobal('privacy-policy')

export async function generateMetadata(): Promise<Metadata> {
  const policy = await getCachedPrivacyPolicy()
  if (!policy.published) return {}

  return {
    title: 'Política de Privacidade | Jorge Solla',
    description:
      'Aviso de Privacidade e tratamento de dados pessoais da campanha Jorge Solla (plataforma Teqo).',
  }
}

export default async function PrivacyPolicyPage() {
  const policy = await getCachedPrivacyPolicy()

  if (!policy.published) {
    notFound()
  }

  const html = convertLexicalToHTML({ data: policy.body })

  return (
    <main className="w-full bg-background text-foreground">
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">
          Política de Privacidade
        </h1>
        <div
          className="prose prose-neutral max-w-none leading-relaxed [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:hover:underline [&_p]:mb-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </main>
  )
}
