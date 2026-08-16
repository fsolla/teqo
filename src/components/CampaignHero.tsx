import Image from 'next/image'

const SUPPORT_URL = 'https://apoiar.me/jorgesolla'

const allyImages = [
  {
    id: 'rui',
    src: '/RUI%20-%202-2.avif',
    width: 177,
    height: 265,
    sizes: '(min-width: 1366px) calc(6.14vw + 93px), 177px',
  },
  {
    id: 'wagner',
    src: '/WAGNER%20-%202-9%20final.avif',
    width: 177,
    height: 265,
    sizes: '(min-width: 1366px) calc(6.14vw + 93px), 177px',
  },
  {
    id: 'jeronimo',
    src: '/Jeronimo.avif',
    width: 177,
    height: 265,
    sizes: '(min-width: 1366px) calc(6.14vw + 93px), 177px',
  },
  {
    id: 'lula',
    src: '/Lula.avif',
    width: 216,
    height: 213,
    sizes: '(min-width: 1366px) calc(8.3vw + 125px), (min-width: 1024px) 238px, 216px',
  },
]

export const CampaignHero = () => (
  <section
    aria-labelledby="campaign-title"
    data-home-section="hero"
    className="campaign-hero relative overflow-hidden bg-(--pt-red) text-white"
  >
    <div className="campaign-hero-stage relative mx-auto h-full w-full">
      <div
        role="img"
        aria-label="Jorge Solla 1313 — candidato a deputado federal"
        className="campaign-home-logo absolute z-30"
      />

      <div
        role="img"
        aria-label="Jorge Solla com Lula, Jerônimo Rodrigues, Jaques Wagner e Rui Costa"
        className="absolute inset-0 z-10"
      >
        {allyImages.map((image) => (
          <Image
            key={image.src}
            src={image.src}
            alt=""
            width={image.width}
            height={image.height}
            sizes={image.sizes}
            loading="eager"
            className={`campaign-hero-ally campaign-hero-ally--${image.id} absolute max-w-none object-contain`}
          />
        ))}
      </div>

      <div className="campaign-hero-portrait absolute z-20 overflow-hidden">
        <Image
          src="/JOA00162.avif"
          alt="Jorge Solla, candidato a deputado federal pela Bahia"
          width={495}
          height={742}
          sizes="(min-width: 1720px) 747px, (min-width: 1280px) 595px, (min-width: 1024px) 495px, 449px"
          priority
          className="campaign-hero-portrait-image absolute h-auto max-w-none object-contain"
        />
      </div>

      <div
        data-mobile-hero-overlay
        className="campaign-hero-overlay absolute z-20 bg-[linear-gradient(to_bottom,transparent_0%,rgba(162,28,28,0.5)_38%,#a21c1c_78%)]"
      />

      <div className="campaign-hero-content relative z-30">
        <h1
          id="campaign-title"
          aria-label="UM MANDATO DO TAMANHO DA BAHIA"
          className="campaign-hero-title m-0 border-0 p-0 font-[family-name:var(--font-exo2)] leading-[1.12] tracking-[-0.02em] text-balance uppercase"
        >
          <span className="block font-medium">Um mandato do</span>
          <span className="block font-black">tamanho da Bahia</span>
        </h1>

        <p className="campaign-hero-copy m-0 text-left font-sans leading-[1.2] uppercase">
          Médico sanitarista.{' '}
          <strong className="font-extrabold text-(--pt-yellow)">Criou o SAMU 192</strong> e o{' '}
          <strong className="font-extrabold">Brasil Sorridente</strong>. Já comandou a saúde em
          Vitória da Conquista, na Bahia e no Brasil — e leva o mandato aos 417 municípios, da saúde
          à educação.
        </p>

        <div className="campaign-hero-actions flex items-stretch justify-start">
          <a
            href="#bandeiras"
            aria-label="Conhecer bandeiras"
            data-cta="secondary"
            className="campaign-action-feedback campaign-hero-action campaign-hero-action--secondary inline-flex min-h-11 flex-col items-center justify-center rounded-[10px] border-2 border-white/55 px-3 text-center font-[family-name:var(--font-exo2)] leading-[1.05] font-extrabold text-white no-underline hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-(--pt-red) focus-visible:outline-none"
          >
            Conhecer
            <small className="campaign-hero-action-detail text-[12px] leading-none font-semibold">
              bandeiras
            </small>
          </a>
          <a
            href={SUPPORT_URL}
            aria-label="Quero apoiar — é rápido, 30 segundos"
            target="_blank"
            rel="noopener"
            data-cta="primary"
            className="campaign-action-feedback campaign-hero-action campaign-hero-action--primary inline-flex min-h-11 flex-col items-center justify-center rounded-[10px] bg-(--pt-yellow) px-2 text-center font-[family-name:var(--font-exo2)] leading-[1.05] font-black text-(--pt-yellow-ink) no-underline hover:brightness-95 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-(--pt-red) focus-visible:outline-none"
          >
            <span className="campaign-hero-action-short">Apoiar</span>
            <span className="campaign-hero-action-long">Quero apoiar</span>
            <small className="campaign-hero-action-detail text-[12px] leading-none font-semibold">
              é rápido, 30 segundos
            </small>
          </a>
        </div>

        <div className="campaign-hero-accolades flex flex-col font-sans text-white/80">
          <span aria-label="DIAP entre os 40 melhores da Câmara">
            <strong className="font-extrabold text-white">DIAP</strong> entre os 40 melhores da
            Câmara
          </span>
          <span
            aria-label="Mais votado do PT-BA em 2022"
            className="campaign-hero-accolade-secondary"
          >
            <strong className="font-extrabold text-white">Mais votado</strong> do PT-BA em 2022
          </span>
        </div>
      </div>
    </div>
  </section>
)
