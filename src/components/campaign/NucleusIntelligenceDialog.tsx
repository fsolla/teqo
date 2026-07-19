'use client'

import { useActionState, useEffect, useState } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  updateNucleusIntelligenceFormAction,
  type NucleusIntelligenceFormState,
} from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/nucleusIntelligenceFormActions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { PrimaryContactCombobox } from '@/components/campaign/PrimaryContactCombobox'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import type {
  NucleusPrimaryContactPageData,
  PrimaryContactOption,
} from '@/utilities/primaryContactPageData'
import type { StaffNucleusTabsViewModel } from '@/utilities/nucleusViewModels'
import { fieldError } from '@/utilities/campaignFormFields'

type EditableProfile = StaffNucleusTabsViewModel['voterProfiles'][number]

type NucleusIntelligenceDialogProps = {
  action?: typeof updateNucleusIntelligenceFormAction
  nucleusId: number
  intelligence: Pick<
    StaffNucleusTabsViewModel,
    'strengths' | 'risks' | 'voterProfiles' | 'ticketAlliance'
  >
  primaryContact: PrimaryContactOption | null
  searchPrimaryContacts: (query: string) => Promise<NucleusPrimaryContactPageData>
  onClose?: () => void
  onPendingChange?: (pending: boolean) => void
}

const emptyProfile = (): EditableProfile => ({
  label: '',
  ageRange: null,
  incomeBand: null,
  occupation: null,
  localTraits: null,
  notes: null,
})

const normalizedInsights = (values: string[]) =>
  values.map((text) => ({ text: text.trim() })).filter(({ text }) => Boolean(text))

const normalizedProfiles = (profiles: EditableProfile[]) =>
  profiles
    .map((profile) => ({
      label: profile.label.trim(),
      ageRange: profile.ageRange?.trim() || undefined,
      incomeBand: profile.incomeBand?.trim() || undefined,
      occupation: profile.occupation?.trim() || undefined,
      localTraits: profile.localTraits?.trim() || undefined,
      notes: profile.notes?.trim() || undefined,
    }))
    .filter(({ label }) => Boolean(label))

const FormFeedback = ({ state }: { state: NucleusIntelligenceFormState }) => {
  if (!state.message || state.status === 'success') return null

  return (
    <Alert variant="destructive" aria-live="polite">
      <AlertTitle>Não foi possível salvar</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  )
}

export const NucleusIntelligenceDialog = ({
  action: updateAction = updateNucleusIntelligenceFormAction,
  nucleusId,
  intelligence,
  primaryContact,
  searchPrimaryContacts,
  onClose,
  onPendingChange,
}: NucleusIntelligenceDialogProps) => {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateAction, {})
  const [strengths, setStrengths] = useState(
    intelligence.strengths.length ? intelligence.strengths.map(({ text }) => text) : [''],
  )
  const [risks, setRisks] = useState(
    intelligence.risks.length ? intelligence.risks.map(({ text }) => text) : [''],
  )
  const [profiles, setProfiles] = useState<EditableProfile[]>(
    intelligence.voterProfiles.length ? intelligence.voterProfiles : [emptyProfile()],
  )

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    router.refresh()
    onClose?.()
  }, [onClose, router, state])

  useEffect(() => {
    onPendingChange?.(pending)
  }, [onPendingChange, pending])

  const primaryContactError = fieldError(state.fieldErrors, 'primaryContact')

  const updateProfile = (index: number, field: keyof EditableProfile, value: string) => {
    setProfiles((current) =>
      current.map((profile, profileIndex) =>
        profileIndex === index ? { ...profile, [field]: value || null } : profile,
      ),
    )
  }

  return (
    <DialogContent
      className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
      showCloseButton={!pending}
      onEscapeKeyDown={(event) => {
        if (pending) event.preventDefault()
      }}
      onPointerDownOutside={(event) => {
        if (pending) event.preventDefault()
      }}
    >
      <DialogHeader>
        <DialogTitle>Editar inteligência do núcleo</DialogTitle>
        <DialogDescription>
          Registre a leitura política e o contato de referência deste território.
        </DialogDescription>
      </DialogHeader>

      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="nucleus" value={nucleusId} />
        <input
          type="hidden"
          name="strengths"
          value={JSON.stringify(normalizedInsights(strengths))}
        />
        <input type="hidden" name="risks" value={JSON.stringify(normalizedInsights(risks))} />
        <input
          type="hidden"
          name="voterProfiles"
          value={JSON.stringify(normalizedProfiles(profiles))}
        />
        <FormFeedback state={state} />

        <FieldGroup>
          <FieldSet>
            <FieldLegend>Pontos fortes</FieldLegend>
            <FieldDescription>Capacidades que ajudam a mobilização no núcleo.</FieldDescription>
            {strengths.map((strength, index) => (
              <Field key={`strength-${index}`} orientation="horizontal">
                <FieldLabel className="sr-only" htmlFor={`strength-${index}`}>
                  Ponto forte {index + 1}
                </FieldLabel>
                <Input
                  id={`strength-${index}`}
                  value={strength}
                  maxLength={1000}
                  onChange={(event) =>
                    setStrengths((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={`Remover ponto forte ${index + 1}`}
                  onClick={() =>
                    setStrengths((current) =>
                      current.length === 1
                        ? ['']
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </Field>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 self-start"
              onClick={() => setStrengths((current) => [...current, ''])}
            >
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Adicionar ponto forte
            </Button>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Riscos</FieldLegend>
            <FieldDescription>Gargalos que podem comprometer a mobilização.</FieldDescription>
            {risks.map((risk, index) => (
              <Field key={`risk-${index}`} orientation="horizontal">
                <FieldLabel className="sr-only" htmlFor={`risk-${index}`}>
                  Risco {index + 1}
                </FieldLabel>
                <Input
                  id={`risk-${index}`}
                  value={risk}
                  maxLength={1000}
                  onChange={(event) =>
                    setRisks((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={`Remover risco ${index + 1}`}
                  onClick={() =>
                    setRisks((current) =>
                      current.length === 1
                        ? ['']
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </Field>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 self-start"
              onClick={() => setRisks((current) => [...current, ''])}
            >
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Adicionar risco
            </Button>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Perfis do eleitorado</FieldLegend>
            {profiles.map((profile, index) => (
              <div key={`profile-${index}`} className="grid gap-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <strong>Perfil {index + 1}</strong>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11"
                    aria-label={`Remover perfil ${index + 1}`}
                    onClick={() =>
                      setProfiles((current) =>
                        current.length === 1
                          ? [emptyProfile()]
                          : current.filter((_, profileIndex) => profileIndex !== index),
                      )
                    }
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
                <Field>
                  <FieldLabel htmlFor={`profile-${index}-label`}>Nome do perfil *</FieldLabel>
                  <Input
                    id={`profile-${index}-label`}
                    value={profile.label}
                    maxLength={120}
                    onChange={(event) => updateProfile(index, 'label', event.target.value)}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor={`profile-${index}-age`}>Faixa etária</FieldLabel>
                    <Input
                      id={`profile-${index}-age`}
                      value={profile.ageRange ?? ''}
                      maxLength={80}
                      onChange={(event) => updateProfile(index, 'ageRange', event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`profile-${index}-income`}>Faixa de renda</FieldLabel>
                    <Input
                      id={`profile-${index}-income`}
                      value={profile.incomeBand ?? ''}
                      maxLength={80}
                      onChange={(event) => updateProfile(index, 'incomeBand', event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`profile-${index}-occupation`}>Ocupação</FieldLabel>
                    <Input
                      id={`profile-${index}-occupation`}
                      value={profile.occupation ?? ''}
                      maxLength={120}
                      onChange={(event) => updateProfile(index, 'occupation', event.target.value)}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor={`profile-${index}-traits`}>
                    Características locais
                  </FieldLabel>
                  <Textarea
                    id={`profile-${index}-traits`}
                    value={profile.localTraits ?? ''}
                    maxLength={500}
                    onChange={(event) => updateProfile(index, 'localTraits', event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`profile-${index}-notes`}>Observações</FieldLabel>
                  <Textarea
                    id={`profile-${index}-notes`}
                    value={profile.notes ?? ''}
                    maxLength={1000}
                    onChange={(event) => updateProfile(index, 'notes', event.target.value)}
                  />
                </Field>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 self-start"
              onClick={() => setProfiles((current) => [...current, emptyProfile()])}
            >
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Adicionar perfil
            </Button>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Dobrada</FieldLegend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="alliance-partner">Nome da parceria</FieldLabel>
                <Input
                  id="alliance-partner"
                  name="partnerName"
                  maxLength={120}
                  defaultValue={intelligence.ticketAlliance?.partnerName ?? ''}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="alliance-office">Cargo</FieldLabel>
                <Input
                  id="alliance-office"
                  name="office"
                  maxLength={120}
                  defaultValue={intelligence.ticketAlliance?.office ?? ''}
                />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="alliance-partner-status"
                name="isCampaignPartner"
                defaultChecked={intelligence.ticketAlliance?.isCampaignPartner}
              />
              <FieldLabel htmlFor="alliance-partner-status">Parceiro da campanha</FieldLabel>
            </Field>
            <Field>
              <FieldLabel htmlFor="alliance-notes">Observações da dobrada</FieldLabel>
              <Textarea
                id="alliance-notes"
                name="allianceNotes"
                maxLength={1000}
                defaultValue={intelligence.ticketAlliance?.notes ?? ''}
              />
            </Field>
          </FieldSet>

          <Field>
            <FieldLabel>Contato principal</FieldLabel>
            <PrimaryContactCombobox
              name="primaryContact"
              current={primaryContact}
              search={searchPrimaryContacts}
            />
            <FieldDescription>Apenas lideranças engajadas podem ser escolhidas.</FieldDescription>
            {primaryContactError ? <FieldError>{primaryContactError}</FieldError> : null}
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? 'Salvando…' : 'Salvar inteligência'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
