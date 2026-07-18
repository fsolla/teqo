import type { CampaignUser, NucleusUpdate } from '@/payload-types'
import {
  nucleusUpdateCreateSchema,
  type NucleusUpdateCreateInput,
} from '@/lib/schemas/nucleusUpdate'
import {
  optionalFormText,
  optionalIntegerFormValue,
  requiredRelationshipFormValue,
} from '@/lib/formData'

export const nucleusUpdatePageSize = 10

export type NucleusUpdateListState = {
  kind?: NucleusUpdate['kind']
  page: number
}

type RawSearchParams = Record<string, string | string[] | undefined>

export const nucleusUpdateSelect = {
  author: true,
  kind: true,
  worked: true,
  failed: true,
  needs: true,
  activeVolunteers: true,
  newSupports: true,
  body: true,
  createdAt: true,
} as const

export type NucleusUpdateAuthorViewModel = {
  id: number
  name: string
  role: CampaignUser['role']
}

export type NucleusUpdateViewModel = {
  id: number
  authorName: string
  authorRole: CampaignUser['role']
  kind: NucleusUpdate['kind']
  worked: string | null
  failed: string | null
  needs: string | null
  activeVolunteers: number | null
  newSupports: number | null
  body: string | null
  createdAt: string
}

type NucleusUpdateRecord = Pick<
  NucleusUpdate,
  | 'id'
  | 'author'
  | 'kind'
  | 'worked'
  | 'failed'
  | 'needs'
  | 'activeVolunteers'
  | 'newSupports'
  | 'body'
  | 'createdAt'
>

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

export const parseNucleusUpdateListState = (params: RawSearchParams): NucleusUpdateListState => {
  const rawKind = firstValue(params.updateKind)
  const rawPage = Number(firstValue(params.updatePage))
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 10_000 ? rawPage : 1
  return {
    page,
    ...(rawKind === 'semanal' || rawKind === 'urgente' || rawKind === 'nota'
      ? { kind: rawKind }
      : {}),
  }
}

export const buildNucleusUpdateHref = (
  nucleusSlug: string,
  rawParams: RawSearchParams,
  state: NucleusUpdateListState,
): string => {
  const params = new URLSearchParams()
  for (const [key, rawValue] of Object.entries(rawParams)) {
    if (key === 'updateKind' || key === 'updatePage' || key === 'newUpdate') continue
    for (const value of Array.isArray(rawValue) ? rawValue : [rawValue]) {
      if (value !== undefined) params.append(key, value)
    }
  }
  params.set('tab', 'updates')
  if (state.kind) params.set('updateKind', state.kind)
  if (state.page > 1) params.set('updatePage', String(state.page))
  return `/campanha/nucleos/${nucleusSlug}?${params.toString()}`
}

export const parseNucleusUpdateFormData = (formData: FormData): NucleusUpdateCreateInput =>
  nucleusUpdateCreateSchema.parse({
    nucleus: requiredRelationshipFormValue(formData, 'nucleus'),
    kind: optionalFormText(formData, 'kind'),
    worked: optionalFormText(formData, 'worked'),
    failed: optionalFormText(formData, 'failed'),
    needs: optionalFormText(formData, 'needs'),
    activeVolunteers: optionalIntegerFormValue(formData, 'activeVolunteers', {
      maximum: 100_000_000,
    }),
    newSupports: optionalIntegerFormValue(formData, 'newSupports', {
      maximum: 100_000_000,
    }),
    body: optionalFormText(formData, 'body'),
  })

export const toNucleusUpdateViewModel = (
  update: NucleusUpdateRecord,
  author: NucleusUpdateAuthorViewModel,
): NucleusUpdateViewModel => ({
  id: update.id,
  authorName: author.name,
  authorRole: author.role,
  kind: update.kind,
  worked: update.worked ?? null,
  failed: update.failed ?? null,
  needs: update.needs ?? null,
  activeVolunteers: update.activeVolunteers ?? null,
  newSupports: update.newSupports ?? null,
  body: update.body ?? null,
  createdAt: update.createdAt,
})
