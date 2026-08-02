'use client'

import { useState, type FormEvent } from 'react'

import { municipalitiesCollection } from '@/components/campaign/opsSync/opsMirrorClient'
import { enqueueMunicipalityUpdate } from '@/components/campaign/opsSync/opsMunicipalityOutbox'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  municipalitySignalTypeDescriptions,
  municipalitySignalTypeLabels,
  municipalitySignalTypes,
  municipalityUpdateKindLabels,
  municipalityUpdateKinds,
  parseMunicipalitySignalType,
  type MunicipalityUpdateKind,
} from '@/lib/schemas/municipalityUpdate'

type MunicipalityUpdateFormProps = {
  municipalityID: number
  /** Parent municipality `updatedAt` for CAS. */
  municipalityUpdatedAt?: string
}

export const MunicipalityUpdateForm = ({
  municipalityID,
  municipalityUpdatedAt,
}: MunicipalityUpdateFormProps) => {
  const [kind, setKind] = useState<MunicipalityUpdateKind>('semanal')
  const [hybridPending, setHybridPending] = useState(false)
  const [hybridMessage, setHybridMessage] = useState<string | null>(null)

  const onHybridSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const rawKind = data.get('kind')
    const nextKind =
      typeof rawKind === 'string' &&
      municipalityUpdateKinds.includes(rawKind as MunicipalityUpdateKind)
        ? (rawKind as MunicipalityUpdateKind)
        : 'semanal'
    const readText = (name: string) => {
      const raw = data.get(name)
      return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
    }
    const readCount = (name: string) => {
      const raw = data.get(name)
      if (typeof raw !== 'string' || raw.trim() === '') return undefined
      const value = Number(raw)
      return Number.isFinite(value) ? Math.trunc(value) : undefined
    }

    setHybridPending(true)
    setHybridMessage(null)
    const mirrorUpdatedAt = municipalitiesCollection.get(municipalityID)?.updatedAt
    void enqueueMunicipalityUpdate({
      clientId: crypto.randomUUID(),
      municipalityId: municipalityID,
      kind: nextKind,
      worked: readText('worked'),
      failed: readText('failed'),
      needs: readText('needs'),
      body: readText('body'),
      activeVolunteers: readCount('activeVolunteers'),
      newSupports: readCount('newSupports'),
      signalType: parseMunicipalitySignalType(readText('signalType')),
      baseUpdatedAt: mirrorUpdatedAt ?? municipalityUpdatedAt,
    }).then(
      () => {
        setHybridPending(false)
        setHybridMessage('Atualização enfileirada. Será enviada ao reconectar.')
        form.reset()
        setKind('semanal')
      },
      (error: unknown) => {
        setHybridPending(false)
        setHybridMessage(
          error instanceof Error ? error.message : 'Não foi possível enfileirar a atualização.',
        )
      },
    )
  }

  return (
    <form onSubmit={onHybridSubmit} className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-medium">Registrar atualização</h3>
        {hybridPending ? <Badge variant="estimate-pending">Pendente</Badge> : null}
      </div>
      <input type="hidden" name="municipalityId" value={municipalityID} />
      <Field>
        <FieldLabel htmlFor="municipality-update-kind">Tipo</FieldLabel>
        <NativeSelect
          id="municipality-update-kind"
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as MunicipalityUpdateKind)}
          className="min-h-11 w-full sm:w-56"
        >
          {municipalityUpdateKinds.map((entry) => (
            <NativeSelectOption key={entry} value={entry}>
              {municipalityUpdateKindLabels[entry]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {kind === 'semanal' ? (
        <>
          <Field>
            <FieldLabel htmlFor="municipality-update-worked">O que funcionou</FieldLabel>
            <Textarea id="municipality-update-worked" name="worked" rows={3} maxLength={3000} />
          </Field>
          <Field>
            <FieldLabel htmlFor="municipality-update-failed">O que não funcionou</FieldLabel>
            <Textarea id="municipality-update-failed" name="failed" rows={3} maxLength={3000} />
          </Field>
          <Field>
            <FieldLabel htmlFor="municipality-update-needs">O que preciso</FieldLabel>
            <Textarea id="municipality-update-needs" name="needs" rows={3} maxLength={3000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="municipality-update-volunteers">Voluntários ativos</FieldLabel>
              <Input
                id="municipality-update-volunteers"
                name="activeVolunteers"
                type="number"
                min={0}
                inputMode="numeric"
                className="min-h-11"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="municipality-update-supports">Novos apoios</FieldLabel>
              <Input
                id="municipality-update-supports"
                name="newSupports"
                type="number"
                min={0}
                inputMode="numeric"
                className="min-h-11"
              />
            </Field>
          </div>
        </>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor="municipality-update-body">Texto</FieldLabel>
            <Textarea
              id="municipality-update-body"
              name="body"
              rows={kind === 'sinal' ? 2 : 4}
              maxLength={5000}
            />
          </Field>
          {kind === 'sinal' ? (
            <Field>
              <FieldLabel htmlFor="municipality-update-signal-type">Tipo do sinal</FieldLabel>
              <NativeSelect
                id="municipality-update-signal-type"
                name="signalType"
                defaultValue=""
                required
                className="sm:w-72"
              >
                <NativeSelectOption value="">Selecione</NativeSelectOption>
                {municipalitySignalTypes.map((entry) => (
                  <NativeSelectOption key={entry} value={entry}>
                    {municipalitySignalTypeLabels[entry]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>Escolha o fato político observado:</FieldDescription>
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {municipalitySignalTypes.map((entry) => (
                  <li key={entry}>
                    <span className="font-medium text-foreground">
                      {municipalitySignalTypeLabels[entry]}:
                    </span>{' '}
                    {municipalitySignalTypeDescriptions[entry]}
                  </li>
                ))}
              </ul>
            </Field>
          ) : null}
        </>
      )}
      {hybridMessage ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {hybridMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={hybridPending} className="min-h-11 self-start">
        {hybridPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Registrar atualização
      </Button>
    </form>
  )
}
