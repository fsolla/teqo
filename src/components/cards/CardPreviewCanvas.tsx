import type { HTMLAttributes, RefObject } from 'react'

/**
 * S13 — the canvas element of the card studio. Presentational only: the
 * composer owns the ref, the draw effect and the pointer/keyboard controls.
 */
export const CardPreviewCanvas = ({
  model,
  canvasRef,
  className,
  ...props
}: {
  model: { width: number; height: number; label: string }
  canvasRef: RefObject<HTMLCanvasElement | null>
  className?: string
} & HTMLAttributes<HTMLCanvasElement>) => (
  <canvas
    ref={canvasRef}
    width={model.width}
    height={model.height}
    role="img"
    aria-label={`Prévia do card: ${model.label}`}
    className={className}
    {...props}
  />
)
