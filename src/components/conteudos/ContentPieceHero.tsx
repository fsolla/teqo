import Image from 'next/image'

/**
 * S27 — the Central hero (artefato: cena 01 desktop / cena 02 mobile): the
 * campaign gradient band, the "Peça voto pra Solla 1313" eyebrow and the
 * 1313 mark. The copy asks for the vote — one goal for the whole screen.
 */
export const ContentPieceHero = () => (
  <section className="bg-[linear-gradient(120deg,#e4102f,#b60825_60%,#184e92)] text-white">
    <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-7 sm:px-8 sm:py-12">
      <div>
        <p className="m-0 text-xs font-bold tracking-[0.08em] text-[#ffeb00] uppercase sm:text-sm">
          Peça voto pra Solla 1313
        </p>
        <h1 className="mt-2 max-w-2xl text-left font-[family-name:var(--font-exo2)] text-3xl leading-[1.05] font-black tracking-[-0.02em] text-balance sm:text-4xl">
          <span className="sm:hidden">Mande uma peça. Peça mais um voto.</span>
          <span className="hidden sm:inline">Uma mensagem sua pode conquistar mais um voto.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-5 text-white/85 sm:text-base sm:leading-6">
          <span className="sm:hidden">Escolha alguém, compartilhe e peça o voto no 1313.</span>
          <span className="hidden sm:inline">
            Escolha uma peça, mande para alguém que você conhece e peça o voto no 1313.
          </span>
        </p>
      </div>
      <Image
        src="/campaign-kit/numero-negativo.png"
        alt="1313 Deputado Federal"
        width={1037}
        height={595}
        priority
        className="hidden h-24 w-auto object-contain sm:block"
      />
    </div>
  </section>
)
