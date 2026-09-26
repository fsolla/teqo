/**
 * C233 — the album hero (artefato: cenas 01/02): the campaign gradient band
 * with the kit texture, no CTA — the search right below is the primary action
 * and duplicating it would not add a destination (the selfie CTA belonged to
 * C234, out of this slice). Copy closes on the two levels the album offers:
 * the agenda/município/pessoa search and the real context of each record.
 */
export const ArchivePhotoHero = () => (
  <section className="relative isolate overflow-hidden border-b-4 border-(--pt-yellow) bg-[radial-gradient(circle_at_78%_0%,rgb(255_230_7/13%),transparent_28%),linear-gradient(112deg,#e4102f_0%,#b8102a_58%,#184e92_100%)] text-white">
    <div
      aria-hidden="true"
      className="absolute inset-y-0 right-0 -z-10 w-[38%] bg-[url('/campaign-kit/pattern-shapes.png')] bg-[length:100%_auto] bg-[position:center_5%] bg-no-repeat opacity-[0.1]"
    />
    <div className="relative mx-auto flex min-h-[196px] w-full max-w-6xl items-center px-5 py-8 sm:min-h-[230px] sm:px-8 sm:py-10">
      <div className="max-w-2xl">
        <p className="m-0 text-xs font-black tracking-[0.12em] text-(--pt-yellow) uppercase">
          <span className="sm:hidden">Nossa caminhada</span>
          <span className="hidden sm:inline">Memória da nossa caminhada</span>
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-exo2)] text-[30px] leading-[0.98] font-black tracking-[-0.03em] text-balance sm:text-[42px] sm:leading-[1]">
          <span className="sm:hidden">Encontre um momento.</span>
          <span className="hidden sm:inline">Fotos que contam onde a gente esteve.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-5 text-white/90 sm:mt-4 sm:text-base sm:leading-6">
          <span className="sm:hidden">Busque pela agenda, pelo lugar ou por quem apareceu.</span>
          <span className="hidden sm:inline">
            Procure uma agenda, um município ou uma pessoa pública e abra cada registro com data e
            contexto.
          </span>
        </p>
      </div>
    </div>
  </section>
)
