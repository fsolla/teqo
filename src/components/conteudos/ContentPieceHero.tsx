import Image from 'next/image'

/**
 * S27 — the Central hero (artefato: `central-conteudos-hero-polimento-ui-design.html`
 * cenas 01/02): the campaign gradient band, the "Peça voto pra Solla 1313"
 * eyebrow, the 1313 mark and the pattern texture of the kit. The copy asks for
 * the vote — one goal for the whole screen. The 1313 mark no longer disappears
 * on mobile (it anchors the bottom-right corner there).
 */
export const ContentPieceHero = () => (
  <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_70%_5%,rgb(255_230_7/14%),transparent_25%),linear-gradient(116deg,#e4102f_0%,#c10b2b_49%,#6b2758_70%,#184e92_100%)] text-white">
    <div
      aria-hidden="true"
      className="absolute inset-y-0 right-0 -z-10 hidden w-[48%] bg-[url('/campaign-kit/pattern-shapes.png')] bg-[length:100%_auto] bg-[position:center_5%] bg-no-repeat opacity-[0.13] sm:block"
    />
    <div
      aria-hidden="true"
      className="absolute inset-y-0 right-0 -z-10 hidden w-[43%] bg-[linear-gradient(90deg,transparent,rgb(11_38_78/42%))] sm:block"
    />
    <div
      aria-hidden="true"
      className="absolute -right-20 bottom-0 -z-10 h-[210px] w-[330px] bg-[url('/campaign-kit/pattern-shapes.png')] bg-[length:100%_auto] bg-[position:center_top] bg-no-repeat opacity-[0.11] sm:hidden"
    />
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-[linear-gradient(0deg,rgb(10_43_94/72%),transparent)] sm:hidden"
    />
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-(--pt-yellow)" />

    <div className="relative mx-auto min-h-[318px] w-full max-w-6xl px-5 py-7 sm:grid sm:min-h-[316px] sm:grid-cols-[1fr_330px] sm:items-center sm:gap-14 sm:px-8 sm:py-10">
      <div>
        <p className="m-0 text-xs font-black tracking-[0.1em] text-(--pt-yellow) uppercase sm:text-sm">
          Peça voto pra Solla 1313
        </p>
        <h1 className="mt-3 max-w-2xl text-left font-[family-name:var(--font-exo2)] text-[34px] leading-[0.98] font-black tracking-[-0.025em] text-balance sm:text-[42px] sm:leading-[1.02]">
          <span className="sm:hidden">Mande uma peça. Peça mais um voto.</span>
          <span className="hidden sm:inline">Uma mensagem sua pode conquistar mais um voto.</span>
        </h1>
        <p className="mt-3 max-w-[335px] text-sm leading-5 text-white/90 sm:mt-4 sm:max-w-xl sm:text-base sm:leading-6">
          <span className="sm:hidden">Escolha alguém, compartilhe e peça o voto no 1313.</span>
          <span className="hidden sm:inline">
            Escolha uma peça, mande para alguém que você conhece e peça o voto no 1313.
          </span>
        </p>
        <div className="mt-6 hidden items-center gap-2 text-xs font-bold text-white/75 sm:flex">
          <span aria-hidden="true" className="h-px w-8 bg-(--pt-yellow)" />
          <span>Peças oficiais para baixar e compartilhar</span>
        </div>
      </div>

      <div className="absolute right-5 bottom-5 flex items-end gap-3 sm:hidden">
        <span aria-hidden="true" className="mb-2 h-px w-10 bg-white/45" />
        <Image
          src="/campaign-kit/numero-negativo.png"
          alt="1313 — Mais Saúde, Mais Futuro"
          width={1037}
          height={595}
          priority
          className="h-auto w-[154px] drop-shadow-[0_8px_18px_rgb(7_20_51/28%)]"
        />
      </div>

      <div className="relative hidden h-48 items-center justify-center sm:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0 rotate-[-3deg] rounded-[28px] border border-white/12 bg-[#0e3978]/42 shadow-[0_22px_45px_rgb(9_22_56/22%)]"
        />
        <Image
          src="/campaign-kit/numero-negativo.png"
          alt="1313 — Mais Saúde, Mais Futuro"
          width={1037}
          height={595}
          priority
          className="relative h-auto w-[272px] drop-shadow-[0_10px_22px_rgb(7_20_51/30%)]"
        />
      </div>
    </div>
  </section>
)
