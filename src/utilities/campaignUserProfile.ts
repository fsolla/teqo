import type { CampaignUser, Media } from '@/payload-types'

export const CAMPAIGN_AVATAR_MAX_BYTES = 2 * 1024 * 1024

export const CAMPAIGN_AVATAR_UNSUPPORTED_MIME_MESSAGE = 'Envie uma imagem JPEG, PNG ou WebP.'
export const CAMPAIGN_AVATAR_MAX_SIZE_MESSAGE = 'A imagem deve ter no máximo 2 MB.'
export const CAMPAIGN_AVATAR_EMPTY_FILE_MESSAGE = 'O arquivo enviado está vazio.'

export const campaignRoleLabels: Record<CampaignUser['role'], string> = {
  geral: 'Coordenação geral',
  coordenador: 'Coordenador',
  lideranca: 'Liderança',
}

export type CampaignUserShellView = {
  name: string
  role: CampaignUser['role']
  avatarUrl: string | null
}

export const campaignUserShellView = (
  user: Pick<CampaignUser, 'name' | 'role' | 'avatar'>,
): CampaignUserShellView => ({
  name: user.name,
  role: user.role,
  avatarUrl: mediaDocumentUrl(user.avatar),
})

export const CAMPAIGN_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export const campaignUserInitials = (name: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) return '?'

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}

export const mediaDocumentUrl = (media: number | Media | null | undefined): string | null => {
  if (!media || typeof media === 'number') return null

  return media.url ?? null
}

export const assertCampaignAvatarFile = (file: File): void => {
  if (!CAMPAIGN_AVATAR_MIME_TYPES.has(file.type)) {
    throw new Error(CAMPAIGN_AVATAR_UNSUPPORTED_MIME_MESSAGE)
  }
  if (file.size > CAMPAIGN_AVATAR_MAX_BYTES) {
    throw new Error(CAMPAIGN_AVATAR_MAX_SIZE_MESSAGE)
  }
  if (file.size === 0) {
    throw new Error(CAMPAIGN_AVATAR_EMPTY_FILE_MESSAGE)
  }
}

export const CAMPAIGN_AVATAR_SAFE_ERROR_MESSAGES = [
  CAMPAIGN_AVATAR_UNSUPPORTED_MIME_MESSAGE,
  CAMPAIGN_AVATAR_MAX_SIZE_MESSAGE,
  CAMPAIGN_AVATAR_EMPTY_FILE_MESSAGE,
] as const
