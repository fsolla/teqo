import type { ReelDetailViewModel } from '@/lib/reel'

/**
 * C194 — the 9:16 player. The source prefers the rough cut with narration
 * (`video-audio`) and falls back to the silent primary video; while the reel is
 * unpublished there is no source at all and the player states why (C193 kill
 * switch withholds every file).
 */
export const ReelPlayer = ({ reel }: { reel: ReelDetailViewModel }) => {
  if (!reel.videoSourceUrl) {
    return (
      <div className="mx-auto flex aspect-[9/16] w-full max-w-[226px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-muted/40 p-4 text-center lg:max-w-[330px]">
        <span className="text-sm font-medium">Player indisponível</span>
        <p className="text-xs text-muted-foreground">{reel.mediaBlockedLabel}</p>
      </div>
    )
  }

  return (
    <video
      controls
      playsInline
      preload="metadata"
      poster={reel.videoPosterUrl}
      src={reel.videoSourceUrl}
      className="mx-auto aspect-[9/16] w-full max-w-[226px] rounded-xl border bg-black lg:max-w-[330px]"
    />
  )
}
