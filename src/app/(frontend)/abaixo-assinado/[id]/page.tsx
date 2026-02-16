import { getCachedDocumentById, getDocuments } from '@/utilities/documents'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { notFound } from 'next/navigation'
import { headers as nextHeaders } from 'next/headers'

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

  return (
    <div>
      <h1>{petition.title}</h1>
      <h2>{petition.subtitle}</h2>
      <article
        dangerouslySetInnerHTML={{ __html: convertLexicalToHTML({ data: petition.body }) }}
      />
    </div>
  )
}
