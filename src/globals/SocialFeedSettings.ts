import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { REVALIDATE_SOCIAL_FEED_TAG } from '@/utilities/revalidateRequest'
import {
  INSTAGRAM_SYNC_HOOK_TIMEOUT_MS,
  instagramCredentialsChanged,
  syncInstagramFeed,
} from '@/utilities/socialFeed/instagramSync'
import { revalidateTag } from 'next/cache'
import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

const slug = 'social-feed-settings'

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

const revalidateFeed = async () => revalidateTag(REVALIDATE_SOCIAL_FEED_TAG)

/**
 * Re-syncs Instagram when a save changes the IG credentials (the primary
 * flow: the assessoria fills token + ID, saves, and the reload of the global
 * already shows the sync state WITH the new credentials — the status panel
 * would otherwise keep showing the last failure of the old token). Awaited
 * with a bounded deadline so a hanging Graph API never stalls the save; any
 * failure is swallowed — the sync's own status IS the result, and a broken
 * sync must never break the save.
 *
 * The hook runs inside the save's transaction, so its deadline is the
 * shorter hook-specific one (S11-FOLLOWUP): the fetch must not stretch the
 * row lock the render path's persists block on (the retry button has no
 * transaction and keeps the longer deadline).
 *
 * The sync modules must not import `@payload-config` (they do not), so the
 * static import here closes no cycle: `payload.config → this global →
 * instagramSync → instagramFeed` ends at `instagramFeed`, which is pure.
 */
const syncInstagramAfterChange: GlobalAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (!instagramCredentialsChanged(doc, previousDoc)) return
  try {
    // `req` lets the sync write inside this very transaction (same row lock
    // held by the save) instead of blocking a second pool connection.
    await syncInstagramFeed(req.payload, {
      signal: AbortSignal.timeout(INSTAGRAM_SYNC_HOOK_TIMEOUT_MS),
      req,
    })
  } catch {
    // the status panel reflects the failure; the save itself stays green
  }
}

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
    afterChange: [revalidateFeed, syncInstagramAfterChange],
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
      name: 'instagramEnabled',
      type: 'checkbox',
      label: 'Instagram ativo',
      defaultValue: true,
      admin: {
        description: 'Desliga só os cards de post do Instagram.',
      },
    },
    {
      name: 'instagramSyncStatusPanel',
      type: 'ui',
      label: 'Instagram — estado da sincronização',
      admin: {
        components: {
          Field: './components/admin/InstagramSyncStatusPanel#InstagramSyncStatusPanel',
        },
      },
    },
    {
      name: 'instagramAccessToken',
      type: 'text',
      label: 'Token de acesso (Instagram Graph API)',
      admin: {
        description:
          'Token long-lived da conta Business/Creator vinculada à página do Facebook. Tokens emitidos via Instagram Login são renovados automaticamente; para page tokens, o refresh falha e o token precisa ser trocado aqui manualmente.',
      },
    },
    {
      name: 'instagramUserId',
      type: 'text',
      label: 'ID do usuário (conta Business/Creator)',
      admin: {
        description: 'ID numérico da conta de negócios do Instagram.',
      },
    },
    {
      name: 'instagramMaxItems',
      type: 'number',
      label: 'Máximo de posts',
      defaultValue: 3,
      min: 1,
      max: 5,
      admin: {
        description: 'Quantos posts entram no bento (1 grande + os próximos).',
      },
    },
    {
      name: 'instagramExclusionPicker',
      type: 'ui',
      label: 'Instagram — posts recentes',
      admin: {
        components: {
          Field: './components/admin/InstagramPostExclusionPicker#InstagramPostExclusionPicker',
        },
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
    {
      name: 'instagramFeedSnapshot',
      type: 'json',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'instagramSyncStatus',
      type: 'json',
      admin: {
        hidden: true,
      },
    },
  ],
}
