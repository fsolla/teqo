import Image from 'next/image'

const SUPPORT_URL = 'https://apoiar.me/jorgesolla'

const allyImages = [
  {
    src: '/RUI%20-%202-2.avif',
    width: 177,
    height: 265,
    className: 'left-[-22px] top-[144px] h-[265px] w-[177px] lg:left-[-35px] lg:top-[238px] lg:z-0',
  },
  {
    src: '/WAGNER%20-%202-9%20final.avif',
    width: 177,
    height: 265,
    className:
      'left-[-69px] top-[148px] h-[265px] w-[177px] lg:left-[-75px] lg:top-[278px] lg:z-[1]',
  },
  {
    src: '/Jeronimo.avif',
    width: 177,
    height: 265,
    className:
      'left-[224px] top-[140px] h-[265px] w-[177px] lg:left-[84px] lg:top-[249px] lg:z-[1]',
  },
  {
    src: '/Lula.avif',
    width: 216,
    height: 213,
    className:
      'left-[262px] top-[179px] h-[213px] w-[216px] lg:left-[-8px] lg:top-[308px] lg:z-[2] lg:h-[235px] lg:w-[238px]',
  },
]

export const CampaignHero = () => (
  <section
    aria-labelledby="campaign-title"
    data-home-section="hero"
    className="relative h-[745px] overflow-hidden bg-(--pt-red) text-white max-[383px]:h-[780px] lg:h-[543px]"
  >
    <div className="relative mx-auto h-full w-full max-w-[393px] lg:max-w-[1024px]">
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
            sizes="(min-width: 1024px) 238px, 216px"
            loading="eager"
            className={`absolute max-w-none object-contain ${image.className}`}
          />
        ))}
      </div>

      <div className="absolute top-[53px] left-1/2 z-20 h-[469px] w-[422px] -translate-x-1/2 overflow-hidden lg:top-[26px] lg:left-[153px] lg:h-[517px] lg:w-[465px] lg:translate-x-0">
        <Image
          src="/JOA00162.avif"
          alt="Jorge Solla, candidato a deputado federal pela Bahia"
          width={495}
          height={742}
          sizes="(min-width: 1024px) 495px, 449px"
          priority
          className="absolute -top-[17px] left-px h-[673px] w-[449px] max-w-none object-contain lg:-top-[19px] lg:h-[742px] lg:w-[495px]"
        />
      </div>

      <div
        data-mobile-hero-overlay
        className="absolute top-[300px] left-1/2 z-20 h-[245px] w-screen -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent_0%,rgba(162,28,28,0.5)_38%,#a21c1c_78%)] lg:hidden"
      />

      <div className="absolute top-[462px] left-0 z-30 w-full lg:top-[106px] lg:right-[47px] lg:left-auto lg:w-[392px]">
        <h1
          id="campaign-title"
          aria-label="UM MANDATO DO TAMANHO DA BAHIA"
          className="m-0 border-0 p-0 text-center font-[family-name:var(--font-exo2)] text-[32px] leading-[1.12] tracking-[-0.02em] text-balance uppercase lg:text-right lg:text-[36px] lg:leading-[1.2]"
        >
          <span className="block font-medium">Um mandato do</span>
          <span className="block font-black">tamanho da Bahia</span>
        </h1>
      </div>

      <div className="absolute top-[547px] left-0 z-30 w-full lg:static">
        <p className="m-0 ml-6 w-[calc(100%_-_66px)] text-left font-sans text-[14px] leading-[1.2] uppercase lg:absolute lg:top-[212px] lg:right-[47px] lg:z-30 lg:ml-0 lg:w-[418px] lg:text-right lg:text-[18px]">
          Médico sanitarista.{' '}
          <strong className="font-extrabold text-(--pt-yellow)">Criou o SAMU 192</strong> e o{' '}
          <strong className="font-extrabold">Brasil Sorridente</strong>. Já comandou a saúde em
          Vitória da Conquista, na Bahia e no Brasil — e leva o mandato aos 417 municípios, da saúde
          à educação.
        </p>

        <div className="mt-5 mr-[18px] flex items-stretch justify-end gap-2.5 lg:absolute lg:top-[349px] lg:right-[47px] lg:z-30 lg:mt-0 lg:mr-0 lg:justify-start lg:gap-6">
          <a
            href="#bandeiras"
            aria-label="Conhecer bandeiras"
            data-cta="secondary"
            className="campaign-action-feedback inline-flex min-h-11 w-[145px] flex-col items-center justify-center rounded-[10px] border-2 border-white/55 px-3 text-center font-[family-name:var(--font-exo2)] text-[17px] leading-[1.05] font-extrabold text-white no-underline hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-(--pt-red) focus-visible:outline-none lg:h-[60px] lg:w-[158px] lg:text-[18px]"
          >
            Conhecer
            <small className="hidden text-[12px] leading-none font-semibold lg:block">
              bandeiras
            </small>
          </a>
          <a
            href={SUPPORT_URL}
            aria-label="Quero apoiar — é rápido, 30 segundos"
            target="_blank"
            rel="noopener"
            data-cta="primary"
            className="campaign-action-feedback inline-flex min-h-11 w-[112px] flex-col items-center justify-center rounded-[10px] bg-(--pt-yellow) px-2 text-center font-[family-name:var(--font-exo2)] text-[17px] leading-[1.05] font-black text-(--pt-yellow-ink) no-underline hover:brightness-95 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-(--pt-red) focus-visible:outline-none lg:h-[60px] lg:w-[158px] lg:text-[18px]"
          >
            <span className="lg:hidden">Apoiar</span>
            <span className="hidden lg:inline">Quero apoiar</span>
            <small className="hidden text-[12px] leading-none font-semibold lg:block">
              é rápido, 30 segundos
            </small>
          </a>
        </div>
      </div>

      <div className="absolute right-[18px] bottom-3 z-30 flex flex-col items-end gap-0.5 text-right font-sans text-[10px] leading-3 text-white/80 lg:top-[494px] lg:right-auto lg:bottom-auto lg:left-[559px] lg:items-start lg:gap-2 lg:text-left lg:text-[12px] lg:leading-[15px]">
        <span aria-label="DIAP entre os 40 melhores da Câmara">
          <strong className="font-extrabold text-white">DIAP</strong> entre os 40 melhores da Câmara
        </span>
        <span aria-label="Mais votado do PT-BA em 2022">
          <strong className="font-extrabold text-white">Mais votado</strong> do PT-BA em 2022
        </span>
      </div>
    </div>
  </section>
)
