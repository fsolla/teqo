'use client'

import { useRef } from 'react'

/**
 * S8 — campaign home "Nossa história" section: the story video of Jorge
 * Solla's trajectory embedded from the campaign's YouTube channel (the video
 * lives there as a Short; every embed play counts as a channel view).
 * `youtube-nocookie` keeps the embed LGPD-friendly; `loading="lazy"` defers
 * the fetch until the frame nears the viewport.
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
      <div className="mx-auto w-full max-w-[1160px] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="max-w-md">
            <p className="campaign-section-eyebrow m-0 font-black tracking-[0.1em] text-(--pt-red) uppercase">
              Nossa história
            </p>
            <h2
              id="story-title"
              className="campaign-section-title m-0 mt-1 border-0 p-0 font-black tracking-[-0.02em] text-balance"
            >
              Conheça a trajetória de Jorge Solla
            </h2>
            <p className="campaign-section-copy m-0 mt-2 text-(--campaign-muted)">
              A história de quem já fez saúde pública na Bahia e no Brasil, em um minuto e meio: da
              gestão no SUS ao mandato na Câmara.
            </p>
            <button
              type="button"
              onClick={handleCtaPlay}
              className="mt-6 text-sm font-bold text-(--pt-red) underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none"
            >
              Assistir à história
            </button>
          </div>

          <div
            ref={frameRef}
            className="relative aspect-[9/16] w-full max-w-[420px] shrink-0 self-center overflow-hidden rounded-2xl bg-(--campaign-band) lg:max-w-[300px] lg:self-auto"
          >
            <iframe
              src="https://www.youtube-nocookie.com/embed/i_fbclWWC5o?playsinline=1&rel=0"
              title="Vídeo: Conheça a trajetória de Jorge Solla"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
