import Image from 'next/image'
import Link from 'next/link'

import {
  CONTENT_PIECE_CARD,
  CONTENT_PIECE_OUTLINE_BUTTON,
  CONTENT_PIECE_TAG,
} from './contentPieceClasses'

/**
 * S27 — the personalized-card invite as a piece of the catalogue (artefato:
 * cena 01; D6): a synthetic tile, not a published row, so the way to `/cards`
 * never depends on someone remembering to publish it — and it only appears
 * while no filter is active (a filtered board shows matching pieces only).
 */
export const ContentPieceCardInvite = () => (
  <article
    data-content-piece-invite
    className={`${CONTENT_PIECE_CARD} border-[#184e92]/25 bg-(--campaign-cream)`}
  >
    <div className="relative grid aspect-video place-items-center bg-[linear-gradient(135deg,#e4102f,#184e92)] text-white">
      <div className="text-center">
        <Image
          src="/campaign-kit/numero-negativo.png"
          alt="1313 Deputado Federal"
          width={1037}
          height={595}
          className="mx-auto h-16 w-auto object-contain"
        />
        <p className="mt-2 text-[10px] font-black tracking-[0.14em]">SEU NOME + SUA FOTO</p>
      </div>
    </div>
    <div className="p-4">
      <span className={CONTENT_PIECE_TAG}>Card personalizado</span>
      <h3 className="mt-2 font-[family-name:var(--font-exo2)] text-base font-extrabold">
        Faça seu card com Solla 1313
      </h3>
      <p className="mt-1 text-xs text-(--campaign-muted)">Criado no seu aparelho.</p>
      <Link href="/cards" className={`${CONTENT_PIECE_OUTLINE_BUTTON} mt-4 w-full`}>
        Fazer meu card
      </Link>
    </div>
  </article>
)
