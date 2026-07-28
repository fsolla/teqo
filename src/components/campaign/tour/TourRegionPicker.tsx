'use client'

import { useRouter } from 'next/navigation'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Each option arrives with its href already serialized by the RSC: the canonical
 * serializer imports the identity-territory tables, and pulling those into the
 * client bundle for one query param is exactly what B14 measured and rejected.
 */
type TourRegionOption = {
  region: string
  municipalityCount: number
  href: string
}

/**
 * Interaction 1 of 3: which identity territory the giro travels in. The list is
 * the actor's own scope, so an advisor is never offered a território where they
 * have nothing to open — and the count says why each option is there.
 */
export const TourRegionPicker = ({
  regions,
  selectedRegion,
  clearHref,
}: {
  regions: TourRegionOption[]
  selectedRegion: string | null
  clearHref: string
}) => {
  const router = useRouter()
  const { isPending, startTransition } = useCampaignListTransition()

  return (
    <Field className="max-w-md">
      <FieldLabel htmlFor="tour-region">Território de Identidade</FieldLabel>
      <NativeSelect
        id="tour-region"
        value={selectedRegion ?? ''}
        disabled={isPending}
        onChange={(event) => {
          const { value } = event.target
          const href = regions.find((option) => option.region === value)?.href ?? clearHref
          // The result renders below the picker, so the viewport stays put.
          startTransition(() => router.push(href, { scroll: false }))
        }}
        className="min-h-11 w-full"
      >
        <NativeSelectOption value="">Selecione um território</NativeSelectOption>
        {regions.map((option) => (
          <NativeSelectOption key={option.region} value={option.region}>
            {option.region} ({option.municipalityCount})
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldDescription>
        {isPending ? (
          <span className="flex items-center gap-2">
            <Spinner aria-hidden="true" />
            Montando a proposta de giro…
          </span>
        ) : (
          'Um giro acontece dentro de um território. O número é quantos municípios dele você acompanha.'
        )}
      </FieldDescription>
    </Field>
  )
}
