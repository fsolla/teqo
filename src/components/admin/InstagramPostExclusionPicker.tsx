'use client'

import { useAllFormFields, useField } from '@payloadcms/ui'
import type { FieldClientComponent } from 'payload'

type InstagramSnapshotPost = {
  id: string
  caption: string | null
  mediaType: string
  permalink: string
  thumbnailUrl?: string
  timestamp: string
}

type InstagramSnapshot = {
  username?: string
  posts: InstagramSnapshotPost[]
}

type ExcludedItem = {
  platform?: string
  itemId?: string
  reason?: string | null
}

const isInstagramSnapshot = (value: unknown): value is InstagramSnapshot =>
  typeof value === 'object' && value !== null && Array.isArray((value as { posts?: unknown }).posts)

/**
 * Instagram exclusion picker (S3) — the board's "requisito nº 1": the
 * assessoria sees the latest posts of the profile (thumbnail + caption + date,
 * from the persisted feed snapshot) and marks the ones that must NOT appear on
 * the campaign home (e.g. grid mosaics). Each toggle writes/removes an entry
 * in the shared `excludedItems` array (platform `instagram`) — the same
 * mechanism YouTube uses, no migration needed. The posts appear here after the
 * first successful feed sync (cache of 5 min); while the API is down the
 * snapshot keeps the list alive.
 */
export const InstagramPostExclusionPicker: FieldClientComponent = () => {
  const [fields] = useAllFormFields()
  const { value: excludedItemsValue, setValue } = useField<ExcludedItem[]>({
    path: 'excludedItems',
  })
  const snapshot = fields.instagramFeedSnapshot?.value as unknown
  const posts = isInstagramSnapshot(snapshot) ? snapshot.posts : []
  const current = Array.isArray(excludedItemsValue) ? excludedItemsValue : []

  const isExcluded = (postId: string) =>
    current.some((item) => item.platform === 'instagram' && item.itemId === postId)
  const reasonOf = (postId: string) =>
    current.find((item) => item.platform === 'instagram' && item.itemId === postId)?.reason ?? ''

  const toggle = (post: InstagramSnapshotPost) => {
    const next = isExcluded(post.id)
      ? current.filter((item) => !(item.platform === 'instagram' && item.itemId === post.id))
      : [...current, { platform: 'instagram', itemId: post.id }]
    setValue(next)
  }

  const setReason = (postId: string, reason: string) => {
    const next = current.map((item) =>
      item.platform === 'instagram' && item.itemId === postId ? { ...item, reason } : item,
    )
    setValue(next)
  }

  if (posts.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nenhum post recente ainda. Com o token e o ID do usuário configurados, os posts aparecem
        aqui após a primeira sincronização (a cada 5 minutos).
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-500">
        Posts recentes do perfil (da última sincronização). Marque &quot;Não exibir&quot; nos que
        não são conteúdo real de campanha (ex.: grade do feed) — eles somem do board.
      </p>
      {posts.map((post) => {
        const excluded = isExcluded(post.id)
        return (
          <div
            key={post.id}
            className={`flex items-center gap-3 rounded-lg border p-2 ${
              excluded ? 'border-zinc-300 bg-zinc-100' : 'border-zinc-200'
            }`}
          >
            {post.thumbnailUrl ? (
              // Plain img: the admin panel renders media outside next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.thumbnailUrl}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-zinc-200 text-xs text-zinc-500">
                sem capa
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-900">
                {post.caption ?? 'Publicação no Instagram'}
              </p>
              <p className="text-xs text-zinc-500">
                {new Date(post.timestamp).toLocaleDateString('pt-BR')} · {post.id}
              </p>
              {excluded ? (
                <input
                  defaultValue={reasonOf(post.id)}
                  onChange={(event) => setReason(post.id, event.target.value)}
                  placeholder="Motivo (opcional)"
                  aria-label={`Motivo da exclusão de ${post.caption ?? 'publicação'}`}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                />
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => toggle(post)}
              className={`shrink-0 rounded px-3 py-1.5 text-xs font-bold transition-colors ${
                excluded
                  ? 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                  : 'bg-zinc-900 text-white hover:bg-zinc-700'
              }`}
            >
              {excluded ? 'Reexibir' : 'Não exibir'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
