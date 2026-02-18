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
    <main>
      <section className="h-screen w-screen flex items-center justify-center">
        <h1>{petition.title}</h1>
        <h2>{petition.subtitle}</h2>
        <Link href="#formulario">Assinar</Link>
      </section>
      <article
        dangerouslySetInnerHTML={{ __html: convertLexicalToHTML({ data: petition.body }) }}
      />
      <PetitionForm id="formulario" petition={petition} />
    </main>
  )
}
