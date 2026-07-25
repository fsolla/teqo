import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/card'
import type { Post } from '@/payload-types'
import { formatPostDate, getCategoryName, getPostCanonicalPath } from '@/utilities/posts'
import Image from 'next/image'
import Link from 'next/link'

export const PostCard = ({ post }: { post: Post }) => {
  const href = getPostCanonicalPath(post)
  if (!href) return null

  const cover =
    typeof post.coverImage === 'object' && post.coverImage !== null ? post.coverImage : null
  const categoryName = getCategoryName(post)
  const publishedDate = formatPostDate(post.publishedDate)

  return (
    <Card className="gap-0 border border-border bg-card py-0 shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={href}
        className="group/link flex h-full flex-col focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {cover?.url ? (
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            <Image
              src={cover.url}
              alt={cover.alt ?? post.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover/link:scale-[1.03]"
            />
          </div>
        ) : null}
        <div className="flex flex-1 flex-col gap-2 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {categoryName ? <Badge variant="secondary">{categoryName}</Badge> : null}
            {publishedDate ? (
              <time dateTime={post.publishedDate ?? undefined}>{publishedDate}</time>
            ) : null}
          </div>
          <h3 className="text-lg font-semibold leading-snug text-foreground group-hover/link:text-primary">
            {post.title}
          </h3>
          {post.subtitle ? (
            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{post.subtitle}</p>
          ) : null}
        </div>
      </Link>
    </Card>
  )
}
