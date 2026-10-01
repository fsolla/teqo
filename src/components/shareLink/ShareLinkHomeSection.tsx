'use client'

import { ArrowRightIcon, CalendarIcon, ClockIcon, VideoIcon } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'

import { ShareLinkAgendaMenu } from '@/components/shareLink/ShareLinkAgendaMenu'
import { SHARE_LINK_HOME_PRIMARY_ACTION } from '@/components/shareLink/menuControls'
import { useShareLinkLiveTarget } from '@/components/shareLink/useShareLinkLiveTarget'
import { formatBahiaEventDayLabel, formatBahiaEventTimeLabel } from '@/lib/campaignTime'
import { shareLinkPath, type ShareLinkLiveTarget } from '@/lib/shareLink'
import {
  resolveShareLinkLiveActionLabel,
  type ShareLinkHomeSectionView,
} from '@/lib/shareLinkHomeSection'
import { cn } from '@/lib/utils'

const META_ITEM =
  'flex min-w-0 items-center gap-[11px] py-2.5 text-sm leading-[1.2] font-extrabold text-[#211b19] lg:py-0'
const META_ICON =
  'grid size-9 flex-none place-items-center rounded-[10px] bg-[rgb(162_28_28/9%)] text-(--pt-red)'

// `setTimeout` clamps delays above this (Node/browser) and fires immediately;
// a far-future `endsAt` re-arms instead of hiding the section on mount.
const MAX_TIMER_MS = 2_147_483_647

/** The single live entry action (the desktop/mobile variants differ only in placement). */
const LiveEntryAction = ({
  slug,
  label,
  className,
}: {
  slug: string
  label: string
  className: string
}) => (
  <a href={shareLinkPath(slug)} className={cn(SHARE_LINK_HOME_PRIMARY_ACTION, className)}>
    {label}
    <ArrowRightIcon className="size-[19px]" strokeWidth={2.25} aria-hidden="true" />
  </a>
)

/**
 * S44 — the home section that announces the Plenária da Vitória (design
 * artefato `secao-home-plenaria-da-vitoria-ui-design.html`, cenas 01–06).
 * Before the broadcast it shows the invitation (image, Bahia date/time and the
 * S29 agenda, never an entry button); once a destination is on air the image
 * gives way to the official YouTube player and the entry CTA takes the agenda's
 * place, always pointing to the link's canonical path. The section hides
 * itself the moment the event window closes (open tabs), on top of the
 * server-side fail-closed gate (unpublished or expired → absent from the HTML).
 */
export const ShareLinkHomeSection = ({
  view,
  initialLive,
}: {
  view: ShareLinkHomeSectionView
  initialLive: ShareLinkLiveTarget | null
}) => {
  const live = useShareLinkLiveTarget(view.slug, initialLive)
  const [expired, setExpired] = useState(false)
  const isLive = live !== null

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const schedule = () => {
      const remaining = view.expiresAt - Date.now()
      if (remaining <= 0) {
        timer = setTimeout(() => setExpired(true), 0)
        return
      }
      timer = setTimeout(schedule, Math.min(remaining, MAX_TIMER_MS))
    }

    schedule()
    return () => clearTimeout(timer)
  }, [view.expiresAt])

  if (expired) return null

  const dayLabel = view.startsAt ? formatBahiaEventDayLabel(view.startsAt) : ''
  const timeLabel = view.startsAt ? formatBahiaEventTimeLabel(view.startsAt) : ''
  const entryLabel = live ? resolveShareLinkLiveActionLabel(live) : null

  const figure =
    isLive && view.youtubeVideoId ? (
      <figure className="m-0 mt-6 lg:col-start-2 lg:mt-0">
        <div className="relative aspect-video w-full overflow-hidden rounded-[18px] border border-black/10 bg-black shadow-[0_18px_46px_rgb(71_19_14/18%)]">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${view.youtubeVideoId}?playsinline=1&rel=0`}
            title={`Ao vivo: ${view.title}`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </figure>
    ) : view.imageUrl ? (
      <figure className="m-0 mt-7 lg:col-start-2 lg:mt-0">
        <div className="relative aspect-square w-full overflow-hidden rounded-[18px] border border-[rgb(71_19_14/18%)] bg-[#eee9e4] shadow-[0_18px_46px_rgb(71_19_14/10%)]">
          <Image
            src={view.imageUrl}
            alt={view.imageAlt}
            fill
            sizes="(min-width: 1024px) 390px, 100vw"
            className="object-cover"
          />
        </div>
      </figure>
    ) : null

  return (
    <section
      aria-labelledby="plenaria-title"
      data-home-section="plenaria"
      className="relative isolate overflow-hidden border-b border-(--campaign-line) bg-(--campaign-cream) px-5 py-9 sm:px-8 lg:px-16 lg:py-14"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[170px] -right-[108px] -z-10 size-[420px] rounded-full bg-(--pt-yellow) opacity-30"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[230px] -left-[190px] -z-10 size-[390px] rounded-full bg-[#184e92] opacity-[0.055]"
      />

      <div
        className={cn(
          'mx-auto grid max-w-[1152px] gap-0 lg:items-center',
          isLive
            ? 'lg:grid-cols-[minmax(0,1fr)_470px] lg:gap-14'
            : 'lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-16',
        )}
      >
        <div className={cn(isLive ? undefined : 'lg:max-w-[610px]')}>
          <p
            aria-live="polite"
            className={cn(
              'm-0 flex items-center gap-[9px] font-[family-name:var(--font-exo2)] font-black text-(--pt-red) uppercase',
              isLive
                ? 'text-[10px] tracking-[0.08em] lg:text-[11px]'
                : 'text-[10px] tracking-[0.11em] lg:text-[12px]',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex-none rounded-full bg-(--pt-red) shadow-[0_0_0_5px_rgb(162_28_28/10%)]',
                isLive ? 'size-2' : 'size-[9px]',
              )}
            />
            {isLive ? 'Ao vivo agora' : 'Encontro online'}
          </p>

          <h2
            id="plenaria-title"
            className={cn(
              'border-0 pb-0 font-[family-name:var(--font-exo2)] font-black tracking-[-0.04em] text-(--campaign-ink)',
              isLive
                ? 'mt-3 text-[34px] leading-none lg:mt-4 lg:text-[43px]'
                : 'mt-3 text-[36px] leading-[0.98] lg:mt-4 lg:text-[48px]',
            )}
          >
            {view.title}
          </h2>

          <p
            className={cn(
              'text-black/72',
              isLive
                ? 'mt-4 text-[14px] leading-6 lg:max-w-[560px] lg:text-[17px] lg:leading-[1.55]'
                : 'mt-4 text-[15px] leading-6 lg:mt-5 lg:max-w-[590px] lg:text-[18px] lg:leading-[1.55]',
            )}
          >
            {view.description}
          </p>

          {isLive ? (
            <>
              <div className="mt-5 grid gap-1 border-y border-(--campaign-line) py-3 text-xs font-extrabold lg:hidden">
                <span>
                  {dayLabel} · {timeLabel}
                </span>
                <span>
                  {view.location ? `horário da Bahia · ${view.location}` : 'horário da Bahia'}
                </span>
              </div>
              <div className="mt-6 hidden flex-wrap gap-x-5 gap-y-2 border-y border-(--campaign-line) py-4 text-sm font-extrabold lg:flex">
                <span>{dayLabel}</span>
                <span>{timeLabel} (horário da Bahia)</span>
                {view.location ? <span>{view.location}</span> : null}
              </div>
              {entryLabel ? (
                <LiveEntryAction
                  slug={view.slug}
                  label={entryLabel}
                  className="mt-6 hidden lg:mt-7 lg:inline-flex"
                />
              ) : null}
            </>
          ) : (
            <>
              <div className="mt-6 grid border-y border-(--campaign-line) py-2 lg:mt-7 lg:grid-cols-3 lg:py-4">
                <div className={cn(META_ITEM, 'lg:border-r lg:border-black/10 lg:pr-4')}>
                  <span className={META_ICON} aria-hidden="true">
                    <CalendarIcon className="size-5" strokeWidth={2} />
                  </span>
                  <span>{dayLabel}</span>
                </div>
                <div className={cn(META_ITEM, 'lg:border-r lg:border-black/10 lg:px-4')}>
                  <span className={META_ICON} aria-hidden="true">
                    <ClockIcon className="size-5" strokeWidth={2} />
                  </span>
                  <span>
                    {timeLabel}
                    <small className="mt-0.5 hidden text-[10px] font-semibold text-black/55 lg:block">
                      horário da Bahia
                    </small>
                    <span className="lg:hidden"> (horário da Bahia)</span>
                  </span>
                </div>
                {view.location ? (
                  <div className={cn(META_ITEM, 'lg:pl-4')}>
                    <span className={META_ICON} aria-hidden="true">
                      <VideoIcon className="size-5" strokeWidth={2} />
                    </span>
                    <span>{view.location}</span>
                  </div>
                ) : null}
              </div>
              <div className="mt-6 w-full lg:mt-7 lg:w-[270px]">
                <ShareLinkAgendaMenu
                  slug={view.slug}
                  title={view.title}
                  description={view.description}
                  location={view.location}
                  canonicalUrl={view.canonicalUrl}
                  startsAt={view.startsAt}
                  endsAt={view.endsAt}
                  triggerClassName={cn(SHARE_LINK_HOME_PRIMARY_ACTION, 'w-full')}
                />
              </div>
            </>
          )}
        </div>

        {figure}

        {/* Mobile keeps the artifact order (player before the entry CTA); the
            desktop CTA lives inside the left column, right after the meta. */}
        {entryLabel ? (
          <LiveEntryAction slug={view.slug} label={entryLabel} className="mt-6 w-full lg:hidden" />
        ) : null}
      </div>
    </section>
  )
}
