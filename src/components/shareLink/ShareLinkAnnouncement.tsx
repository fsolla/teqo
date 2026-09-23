'use client'

import { CalendarIcon, ExternalLinkIcon, MapPinIcon, VideoIcon } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'

import { CampaignFooter } from '@/components/CampaignFooter'
import { CampaignPageHeader } from '@/components/CampaignPageHeader'
import { SAFE_FOCUS } from '@/components/shareLink/menuControls'
import { ShareLinkAgendaMenu } from '@/components/shareLink/ShareLinkAgendaMenu'
import { ShareLinkShareMenu } from '@/components/shareLink/ShareLinkShareMenu'
import type { ShareLinkLiveTarget } from '@/lib/shareLink'
import type { ShareLinkAnnouncementView } from '@/lib/shareLinkAnnouncement'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 30_000

const PRIMARY_ACTION = cn(
  'inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-[10px] bg-(--pt-yellow) px-4',
  'font-[family-name:var(--font-exo2)] text-lg font-black text-(--pt-yellow-ink) no-underline',
  'shadow-[0_5px_0_#cfb900,0_10px_22px_rgb(0_0_0/12%)]',
)

const PRIMARY_ACTION_DISABLED = cn(
  PRIMARY_ACTION,
  'cursor-not-allowed bg-[#e7e2d5] text-[rgb(0_0_0/48%)] shadow-[0_3px_0_#cfc9bb]',
)

/**
 * S29 — the public announcement page of a share link (design artefato cenas
 * 01–03): honest pre-broadcast state with a disabled "Entrar", date/location in
 * Bahia time, agenda and share options, and the live swap — the poll reads the
 * fresh "no ar" target every 30s (paused on hidden tabs) and flips the CTA
 * without a reload, so the place of the button never changes for whoever left
 * the page open. The link itself keeps redirecting after a reload; this page
 * only exists while nothing is on air.
 */
export const ShareLinkAnnouncement = ({
  view,
  showJingles = false,
}: {
  view: ShareLinkAnnouncementView
  showJingles?: boolean
}) => {
  const [live, setLive] = useState<ShareLinkLiveTarget | null>(null)
  const isLive = live !== null
  const hasImage = Boolean(view.imageUrl)
  const hasEventDetails = Boolean(view.eventLabel || view.location)

  useEffect(() => {
    let cancelled = false

    const refetch = async () => {
      try {
        const response = await fetch(`/api/share-link/${encodeURIComponent(view.slug)}/live`, {
          cache: 'no-store',
        })
        if (!response.ok) return
        const { target } = (await response.json()) as { target: ShareLinkLiveTarget | null }
        if (cancelled || !target) return
        setLive((current) =>
          current?.href === target.href && current?.label === target.label ? current : target,
        )
      } catch {
        // A transient failure is a lost tick: the next poll retries.
      }
    }

    // Read immediately: the server render may be a cached pre-broadcast page
    // that is already out of date.
    void refetch()

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refetch()
    }, POLL_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refetch()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [view.slug])

  return (
    <div data-theme="campaign-site" className="flex min-h-full flex-col bg-(--campaign-cream)">
      <CampaignPageHeader badge={isLive ? 'Ao vivo' : 'Atividade online'} />

      <main className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_88%_15%,rgb(255_230_7/30%)_0_120px,transparent_121px),radial-gradient(circle_at_4%_84%,rgb(24_78_146/8%)_0_170px,transparent_171px)] px-4 py-5 sm:px-8 sm:py-12">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-[-40px] bottom-[-76px] h-[260px] w-[350px] bg-[url('/campaign-kit/pattern-shapes.png')] bg-[center_15%] bg-[length:350px_auto] bg-no-repeat opacity-[0.055]"
        />

        <article
          className={cn(
            'relative z-1 mx-auto grid max-w-6xl overflow-hidden rounded-[18px] border border-(--campaign-line) bg-white',
            'shadow-[0_18px_50px_rgb(71_19_14/10%)]',
            hasImage && 'lg:grid-cols-[0.95fr_1.05fr]',
          )}
        >
          {hasImage ? (
            <div className="relative aspect-[1.91/1] w-full overflow-hidden bg-[#184e92] lg:aspect-auto lg:min-h-[535px]">
              <Image
                src={view.imageUrl as string}
                alt={view.imageAlt}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="flex flex-col p-5 sm:p-10">
            <p className="m-0 flex items-center gap-2 text-[10px] font-bold tracking-[0.1em] text-(--pt-red) uppercase sm:text-xs sm:tracking-[0.09em]">
              {isLive ? (
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--pt-red) opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-(--pt-red)" />
                </span>
              ) : (
                <span className="size-1.5 rounded-full bg-(--pt-red) sm:size-2" />
              )}
              {isLive ? 'Ao vivo agora' : 'Transmissão'}
            </p>

            <h1 className="mt-2 text-left font-[family-name:var(--font-exo2)] text-[31px] leading-none font-black tracking-[-0.035em] sm:mt-4 sm:text-[44px] sm:leading-[0.98] sm:tracking-[-0.04em]">
              {view.title}
            </h1>

            {isLive ? (
              <p className="mt-3 text-sm leading-6 text-black/60">A transmissão começou.</p>
            ) : (
              <p className="mt-3 max-w-xl text-sm leading-5 text-black/65 sm:mt-5 sm:text-base sm:leading-7">
                {view.description}
              </p>
            )}

            {!isLive && hasEventDetails ? (
              <dl className="mt-4 grid gap-3 border-y border-black/10 py-4 text-sm sm:mt-7 sm:gap-4 sm:py-5">
                {view.eventLabel ? (
                  <div className="flex items-start gap-3">
                    <CalendarIcon
                      className="mt-0.5 size-5 flex-none text-(--pt-red)"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="font-bold text-black">{view.eventLabel}</dt>
                      <dd className="mt-0.5 text-[11px] text-black/50 sm:text-xs">
                        Horário da Bahia
                      </dd>
                    </div>
                  </div>
                ) : null}
                {view.location ? (
                  <div className="flex items-center gap-3">
                    <MapPinIcon
                      className="size-5 flex-none text-(--pt-red)"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <dt className="font-bold text-black">{view.location}</dt>
                  </div>
                ) : null}
              </dl>
            ) : null}

            <div className="mt-auto pt-5 sm:pt-7" aria-live="polite">
              {isLive && live ? (
                <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-black/55">
                  <span>Destino no ar</span>
                  <span className="rounded-full bg-(--campaign-band) px-2.5 py-1 text-black">
                    {live.label || 'Destino'}
                  </span>
                </div>
              ) : null}

              {isLive && live ? (
                <a
                  href={live.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(PRIMARY_ACTION, SAFE_FOCUS)}
                >
                  Entrar
                  <ExternalLinkIcon className="size-5" strokeWidth={2} aria-hidden="true" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className={PRIMARY_ACTION_DISABLED}
                >
                  <VideoIcon className="size-5" strokeWidth={2} aria-hidden="true" />
                  Entrar
                </button>
              )}

              {!isLive ? (
                <p className="mt-3 text-center text-xs font-medium text-black/55 sm:text-sm">
                  A transmissão ainda não começou.
                </p>
              ) : null}

              <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3">
                {view.startsAt ? (
                  <ShareLinkAgendaMenu
                    slug={view.slug}
                    title={view.title}
                    description={view.description}
                    location={view.location}
                    startsAt={view.startsAt}
                    endsAt={view.endsAt}
                  />
                ) : null}
                <ShareLinkShareMenu
                  slug={view.slug}
                  title={view.title}
                  className={view.startsAt ? undefined : 'sm:col-start-2'}
                />
              </div>
            </div>
          </div>
        </article>
      </main>

      <CampaignFooter showJingles={showJingles} />
    </div>
  )
}
