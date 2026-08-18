import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { REVALIDATE_SOCIAL_FEED_TAG } from '@/utilities/revalidateRequest'
import { revalidateTag } from 'next/cache'
import type { GlobalConfig } from 'payload'

const slug = 'social-feed-settings'

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

const revalidateFeed = async () => revalidateTag(REVALIDATE_SOCIAL_FEED_TAG)

/**
 * Configuration of the campaign home content board's external feeds (plano-site
 * §4.2): YouTube now, Instagram in S3. The board's read path is the public home
 * render, so the global's `read` is admin-only — the YouTube API key and the
 * excluded-item list never leak through the REST API (the public render reads
 * via the Local API, which bypasses access control by design).
 */
export const SocialFeedSettings: GlobalConfig = {
  slug,
  label: 'Feed de redes sociais',
  admin: {
    group: 'Configurações',
    description:
      'Fonte automática do board "Acompanhe de perto" da home de campanha. Sem chave configurada, os cards da plataforma não aparecem.',
  },
  access: {
    read: payloadAdminOnly,
    update: payloadAdminOnly,
  },
  hooks: {
    afterChange: [revalidateFeed],
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Feed ativo',
      defaultValue: true,
      admin: {
        description:
          'Desligado, as fontes externas (YouTube, Instagram) somem do board sem mexer nos artigos do site.',
      },
    },
    {
      name: 'youtubeEnabled',
      type: 'checkbox',
      label: 'YouTube ativo',
      defaultValue: true,
      admin: {
        description: 'Desliga só os cards de vídeo do YouTube.',
      },
    },
    {
      name: 'youtubeApiKey',
      type: 'text',
      label: 'Chave da API (YouTube Data API v3)',
      admin: {
        description:
          'Chave de API do Google Cloud com a YouTube Data API v3 habilitada. Restrinja por IP se possível.',
      },
    },
    {
      name: 'youtubeChannelId',
      type: 'text',
      label: 'ID do canal',
      admin: {
        description: 'Ex.: UCyqT2nMLnwQn2Bh7mB7y3dA (o canal oficial é @JorgeSollaDep).',
      },
    },
    {
      name: 'youtubeMaxItems',
      type: 'number',
      label: 'Máximo de vídeos',
      defaultValue: 3,
      min: 1,
      max: 5,
      admin: {
        description: 'Quantos vídeos entram no bento (1 grande + os próximos).',
      },
    },
    {
      name: 'excludedItems',
      type: 'array',
      label: 'Itens excluídos',
      labels: {
        singular: 'Item excluído',
        plural: 'Itens excluídos',
      },
      admin: {
        description:
          'Conteúdo marcado para NÃO aparecer no board (vídeo errado, transmissão incompleta, post de grade). O board pula para o próximo elegível.',
      },
      fields: [
        {
          name: 'platform',
          type: 'select',
          label: 'Plataforma',
          required: true,
          options: [
            { label: 'YouTube', value: 'youtube' },
            { label: 'Instagram', value: 'instagram' },
          ],
        },
        {
          name: 'itemId',
          type: 'text',
          label: 'ID do item',
          required: true,
          validate: (
            value: string | null | undefined,
            { data }: { data: { platform?: string } },
          ) => {
            if (data.platform === 'youtube' && value && !YOUTUBE_VIDEO_ID_PATTERN.test(value)) {
              return 'Informe o ID do vídeo (11 caracteres)'
            }
            return true
          },
        },
        {
          name: 'reason',
          type: 'text',
          label: 'Motivo (opcional)',
        },
      ],
    },
    {
      name: 'youtubeFeedSnapshot',
      type: 'json',
      admin: {
        hidden: true,
      },
    },
  ],
}
