import { getCachedDocumentById, getDocuments } from '@/utilities/documents'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field'
import z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

export async function generateStaticParams() {
  const payload = await getDocuments('petition')

  return payload.docs.map((doc) => ({
    id: doc.id,
  }))
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const petition = await getCachedDocumentById('petition', (await params).id)()

  const methods = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      state: '',
      city: '',
      postalCode: '',
      comment: '',
    },
  })

  if (!petition || !petition.enabled) {
    return notFound()
  }

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data)
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
      <form id="formulario" onSubmit={methods.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldLegend>{petition.formTitle}</FieldLegend>
          <FieldDescription>{petition.formDescription}</FieldDescription>
        </FieldSet>
      </form>
    </main>
  )
}

const STATES = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
]

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(120, 'Nome deve ter no máximo 100 caracteres')
    .regex(
      /^(?=.* )[\p{L}\p{M}]+(?:[- ][\p{L}\p{M}]+)*$/u,
      'Informe nome e sobrenome. Use apenas letras, no máximo um espaço ou hífen entre termos, e sem espaço no início ou no fim.',
    ),
  email: z.email('Email inválido'),
  phone: z
    .string()
    .trim()
    .length(11, 'Telefone celular inválido')
    .regex(/^\d{11}$/, 'Telefone celular inválido'),
  state: z.literal(STATES, 'Estado inválido'),
  city: z.string().trim().min(3, 'Cidade inválida').max(100, 'Cidade muito longa'),
  postalCode: z
    .string()
    .trim()
    .regex(/^(?:\d{8})?$/, 'CEP inválido')
    .optional(),
  comment: z
    .string()
    .trim()
    .max(1000, 'Comentário muito longo')
    .refine((v) => !/<\/?[a-z][\s\S]*>/i.test(v), 'O comentário não pode conter HTML')
    .optional(),
})
