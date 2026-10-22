import Link from 'next/link'

import {
  buildArchivePhotoAlbumHref,
  type ArchivePhotoPublicItem,
} from '@/lib/archivePhotoPublicCatalog'
import { PUBLIC_FOCUS, PUBLIC_PATHS } from '@/lib/publicSite'
import { cn } from '@/lib/utils'

const PHOTO_LINK = cn('group block overflow-hidden rounded-[9px] lg:rounded-[10px]', PUBLIC_FOCUS)

const PHOTO_IMAGE =
  'photo-tone h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100'

const AlbumPhoto = ({ item, className }: { item: ArchivePhotoPublicItem; className: string }) => (
  <Link href={buildArchivePhotoAlbumHref({ foto: item.id })} className={cn(PHOTO_LINK, className)}>
    {/* eslint-disable-next-line @next/next/no-img-element -- private proxy path with on-demand headers */}
    <img
      src={item.thumbnailPath}
      alt={item.alt}
      loading="lazy"
      decoding="async"
      className={PHOTO_IMAGE}
    />
  </Link>
)

const EmptyAlbum = () => (
  <div className="mt-7 flex min-h-[290px] flex-col items-center justify-center rounded-[10px] border border-white/15 px-8 text-center lg:mt-10">
    <svg
      aria-hidden="true"
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--pt-yellow)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
    <h3 className="mt-5 font-[family-name:var(--font-exo2)] text-2xl font-extrabold">
      O álbum está sendo preparado
    </h3>
    <p className="mt-3 max-w-sm text-sm leading-6 text-white/68">
      Novos registros do trabalho na Bahia serão publicados em breve.
    </p>
  </div>
)

/**
 * S47 — "Perto da Bahia" (design scene 01/02): two approved album photos plus
 * the red quote tile, all linking into the album's overlay (`?foto=<id>`). The
 * section reads the same approved list as the album, so it can never show a
 * photo the album would not; with no approved photo it renders the approved
 * empty state instead of disappearing.
 */
export const CampaignPhotoSection = ({ items }: { items: ArchivePhotoPublicItem[] }) => {
  const [first, second] = items

  return (
    <section
      aria-labelledby="photos-title"
      data-home-section="photos"
      className="bg-[#24100e] text-white"
    >
      <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 lg:px-16 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="m-0 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-yellow)">
              Perto da Bahia
            </p>
            <h2
              id="photos-title"
              className="mt-2 border-0 p-0 font-[family-name:var(--font-exo2)] text-[34px] leading-none font-black tracking-[-0.04em] lg:mt-3 lg:text-[46px] lg:tracking-[-0.045em]"
            >
              O mandato em fotos
            </h2>
          </div>
          <Link
            href={PUBLIC_PATHS.fotos}
            className={cn(
              'text-sm font-bold text-white underline decoration-white underline-offset-[5px] hover:text-white/85',
              PUBLIC_FOCUS,
            )}
          >
            Ver o álbum
          </Link>
        </div>

        {first ? (
          <div className="mt-7 grid grid-cols-2 gap-2 lg:mt-10 lg:h-[530px] lg:grid-cols-12 lg:grid-rows-2 lg:gap-3">
            <AlbumPhoto
              item={first}
              className="col-span-2 h-[300px] lg:col-span-7 lg:row-span-2 lg:h-auto"
            />
            {second ? (
              <AlbumPhoto item={second} className="h-[170px] lg:col-span-5 lg:h-auto" />
            ) : null}
            <div
              className={cn(
                'flex items-end rounded-[9px] bg-(--pt-red) p-5 lg:rounded-[10px] lg:p-8',
                second
                  ? 'h-[170px] lg:col-span-5 lg:h-auto'
                  : 'col-span-2 h-[170px] lg:col-span-5 lg:row-span-2 lg:h-auto',
              )}
            >
              <p className="max-w-[255px] font-[family-name:var(--font-exo2)] text-[19px] leading-[1.13] font-extrabold lg:text-[27px] lg:leading-[1.12]">
                Trabalho presente, memória viva.
              </p>
              <span aria-hidden="true" className="ml-auto text-(--pt-yellow)">
                ↗
              </span>
            </div>
          </div>
        ) : (
          <EmptyAlbum />
        )}
      </div>
    </section>
  )
}
