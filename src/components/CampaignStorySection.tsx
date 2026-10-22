'use client'

import { useRef } from 'react'

import { PUBLIC_FOCUS } from '@/lib/publicSite'

/**
 * S8/S47 — the "Nossa história" section of the mandate home: the story video
 * of Jorge Solla's trajectory embedded from the official YouTube channel (the
 * video lives there as a Short; every embed play counts as a channel view).
 * `youtube-nocookie` keeps the embed LGPD-friendly; `loading="lazy"` defers
 * the fetch until the frame nears the viewport. S47 brought the editorial copy
 * and the two-column composition of the approved design.
 */
export const CampaignStorySection = () => {
  const frameRef = useRef<HTMLDivElement>(null)

  const handleCtaPlay = () => {
    frameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <section
      aria-labelledby="story-title"
      data-home-section="story"
      className="border-y border-(--campaign-line) bg-white"
    >
      <div className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.83fr_1.17fr] lg:gap-20 lg:px-16 lg:py-24">
        <div>
          <p className="m-0 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-red)">
            Nossa história
          </p>
          <h2
            id="story-title"
            className="mt-3 border-0 p-0 font-[family-name:var(--font-exo2)] text-[34px] leading-[1.03] font-black tracking-[-0.04em] text-balance lg:text-[46px] lg:leading-[1.02] lg:tracking-[-0.045em]"
          >
            Saúde pública como escolha de vida
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-(--campaign-muted) lg:mt-6 lg:text-[17px] lg:leading-7">
            Da gestão do SUS ao Congresso Nacional, uma trajetória feita ao lado de quem defende
            saúde, democracia e direitos para todos.
          </p>
          <button
            type="button"
            onClick={handleCtaPlay}
            className={`mt-5 rounded-sm text-sm font-bold text-(--pt-red) underline decoration-(--pt-red) underline-offset-[5px] hover:text-(--pt-red-dark) lg:mt-7 ${PUBLIC_FOCUS}`}
          >
            Assistir à trajetória
          </button>
        </div>

        <div
          ref={frameRef}
          className="relative aspect-[9/16] w-full max-w-[360px] justify-self-center overflow-hidden rounded-xl bg-(--pt-red-dark) lg:max-w-[380px] lg:justify-self-end"
        >
          <iframe
            src="https://www.youtube-nocookie.com/embed/i_fbclWWC5o?playsinline=1&rel=0"
            title="Vídeo: Saúde pública como escolha de vida — a trajetória de Jorge Solla"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    </section>
  )
}
