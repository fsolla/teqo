'use client'

import { submitCampaignNewsletter } from '@/app/(frontend)/actions/submitCampaignNewsletter'
import { CitySelect } from '@/components/CitySelect'
import { EmailInput } from '@/components/EmailInput'
import { NameInput } from '@/components/NameInput'
import { PhoneInput } from '@/components/PhoneInput'
import { StateSelect } from '@/components/StateSelect'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldDescription, FieldError, FieldGroup } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { trackMetaLead } from '@/lib/facebookPixel'
import { CampaignNewsletterInput, campaignNewsletterSchema } from '@/lib/schemas/campaignNewsletter'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckIcon } from 'lucide-react'
import { useState, useTransition } from 'react'
import { FormProvider, SubmitHandler, useForm, useWatch } from 'react-hook-form'

/** S10 — stable `content_name` for the `Lead` fired on a successful capture. */
const NEWSLETTER_LEAD_CONTENT_NAME = 'novidades-da-campanha'

interface CampaignNewsletterFormProps {
  pixelId?: string
  onSubmit: () => void
}

/**
 * S9 — public capture of campaign "novidades" on the home: name + WhatsApp
 * required, email/state/city/comment optional, engagement-level toggle
 * pre-selected ("Quero fazer parte do time"). Success swaps the form for an
 * in-place confirmation (the seam where S10 fires `Lead`).
 */
const CampaignNewsletterForm = ({ pixelId, onSubmit }: CampaignNewsletterFormProps) => {
  const methods = useForm<CampaignNewsletterInput>({
    resolver: zodResolver(campaignNewsletterSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      state: undefined,
      city: '',
      comment: '',
      campaignLevel: 'time',
    },
  })

  const [isSubmitting, startTransition] = useTransition()

  const handleSubmit: SubmitHandler<CampaignNewsletterInput> = (input) => {
    startTransition(async () => {
      try {
        await submitCampaignNewsletter(input)
        // S10 — exactly one `Lead` per successful capture, never on page load
        // (petition precedent). The inner guard keeps a tracking hiccup (e.g.
        // `crypto.randomUUID` on a non-secure context) from turning an
        // already-committed capture into the error UI; `trackMetaLead`
        // no-ops safely without fbq.
        if (pixelId) {
          try {
            trackMetaLead(pixelId, NEWSLETTER_LEAD_CONTENT_NAME, crypto.randomUUID())
          } catch {
            // tracking is invisible to the visitor
          }
        }
        methods.reset()
        onSubmit()
      } catch (error) {
        console.log(error)
        methods.setError('root', {
          message: 'Falha ao enviar. Tente novamente.',
        })
      }
    })
  }

  const campaignLevel = useWatch({ control: methods.control, name: 'campaignLevel' })

  return (
    <FormProvider {...methods}>
      <form
        id="campanha-novidades"
        onSubmit={methods.handleSubmit(handleSubmit)}
        className="mx-auto max-w-3xl"
      >
        <FieldGroup>
          <Field>
            <NameInput placeholder="Nome completo*" />
            <FieldError errors={[methods.formState.errors.name]} />
          </Field>
          <Field>
            <PhoneInput placeholder="WhatsApp (com DDD)*" />
            <FieldError errors={[methods.formState.errors.phone]} />
          </Field>
          <Field>
            <EmailInput required={false} placeholder="E-mail (opcional)" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <StateSelect required={false} placeholder="Estado (opcional)" />
            </Field>
            <Field>
              <CitySelect required={false} placeholder="Cidade (opcional)" />
            </Field>
          </div>
          <Field>
            <Textarea
              id="comment"
              {...methods.register('comment')}
              placeholder="Comentário (opcional)"
              className="min-h-22"
            />
          </Field>
          <Field>
            <div className="rounded-lg border border-(--campaign-line) bg-white p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="campaign-level"
                  checked={campaignLevel === 'time'}
                  onCheckedChange={(checked) =>
                    methods.setValue('campaignLevel', checked ? 'time' : 'esporadico')
                  }
                  aria-describedby="campaign-level-help"
                  className="mt-0.5 size-5 rounded border-(--pt-red) text-white data-[state=checked]:border-(--pt-red) data-[state=checked]:bg-(--pt-red)"
                />
                <label
                  htmlFor="campaign-level"
                  className="cursor-pointer text-sm leading-snug text-(--campaign-ink)"
                >
                  <strong>Quero fazer parte do time:</strong> receber novidades com frequência, ser
                  adicionado(a) aos grupos de WhatsApp da campanha e participar das ações.
                </label>
              </div>
              <p
                id="campaign-level-help"
                className="m-0 mt-2 text-xs leading-snug text-(--campaign-muted)"
              >
                Sem marcar, você recebe apenas comunicações esporádicas da campanha — sem grupos e
                sem envios frequentes.
              </p>
            </div>
          </Field>
          <Field>
            {methods.formState.errors.root?.message ? (
              <FieldDescription className="text-destructive">
                {methods.formState.errors.root.message}
              </FieldDescription>
            ) : null}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-lg bg-(--pt-red) text-sm font-extrabold text-white hover:brightness-95"
            >
              {isSubmitting ? 'ENVIANDO...' : 'QUERO RECEBER NOVIDADES'}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-relaxed text-(--campaign-muted)">
        Ao enviar, você demonstra apoio à campanha e escolhe como quer acompanhar: comunicações
        frequentes e grupos de WhatsApp (marcando a opção acima) ou comunicações esporádicas —
        conforme a Política de Privacidade (LGPD).
      </p>
    </FormProvider>
  )
}

/** S9 — in-place success shown after the capture is recorded. */
const CampaignNewsletterSuccess = () => (
  <div className="mx-auto max-w-3xl rounded-xl border border-(--campaign-line) bg-white px-6 py-12 text-center">
    <div className="mx-auto flex size-10 items-center justify-center rounded-full border-2 border-(--pt-red) text-(--pt-red)">
      <CheckIcon className="size-5" />
    </div>
    <h3 className="mt-5 font-[family-name:var(--font-exo2)] text-2xl font-black tracking-[-0.02em] text-(--campaign-ink)">
      Inscrição confirmada
    </h3>
    <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-(--campaign-muted)">
      Você vai receber as novidades da campanha. Enquanto isso, conheça as bandeiras da campanha.
    </p>
    <a
      href="#bandeiras"
      className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border-2 border-(--campaign-line) bg-white px-6 text-sm font-extrabold text-(--pt-red) no-underline transition-colors hover:bg-(--campaign-band) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      Ver bandeiras
    </a>
  </div>
)

/** S9 — wrapper owning the form ↔ success swap on the home section. */
export const CampaignNewsletterCapture = ({ pixelId }: { pixelId?: string }) => {
  const [submitted, setSubmitted] = useState(false)

  return submitted ? (
    <CampaignNewsletterSuccess />
  ) : (
    <CampaignNewsletterForm pixelId={pixelId} onSubmit={() => setSubmitted(true)} />
  )
}
