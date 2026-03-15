import { SocialLinks } from '@/components/socialLinks'
import { WhatsappForm } from '@/components/WhatsappForm'
import Image from 'next/image'

export default function Page() {
  const basePath = process.env.NEXT_BASE_PATH || ''

  return (
    <main
      className="w-screen h-screen bg-center bg-cover flex flex-col items-center justify-center"
      style={{ backgroundImage: `url(${basePath}/BG.jpg)` }}
    >
      <div className="flex flex-col max-w-300 gap-12">
        <div className="relative flex flex-col gap-5">
          <h1 className="text-5xl text-left">
            FIQUE POR DENTRO
            <br />
            DO <span className="text-[#f9844e]">NOSSO MANDATO!</span>
          </h1>
          <h2 className="text-2xl font-light">
            PARTICIPE DA NOSSA{' '}
            <strong className="font-bold">
              COMUNIDADE EXCLUSIVA
              <br />
              NO WHATSAPP
            </strong>{' '}
            E FIQUE POR DENTRO DE TODAS
            <br />
            AS VOTAÇÕES, PROJETOS E BASTIDORES.
          </h2>
          <WhatsappForm classname="flex-1 w-[40%]" />
          <Image
            className="flex-[1.8] -mx-10 absolute top-1/2 -translate-y-[50%] right-0 w-[67%]"
            src={`${basePath}/LULA_E_SOLLA.png`}
            width={956}
            height={948}
            alt=""
          />
        </div>
        <div className="relative flex flex-col items-center gap-0">
          <Image
            src={`${basePath}/LOGO_SOLLA_BRANCO.svg`}
            width={430}
            height={300}
            alt=""
            className="-my-30"
          />
          <p className="text-center">
            <strong>Seus dados estão seguros.</strong> Utilizamos suas informações apenas para
            contato e envio de conteúdos relacionados.
            <br />
            Não compartilhamos dados com terceiros. Ao preencher o formulário, você concorda com
            nossa política de uso de dados conforme a LGPD.
          </p>
        </div>
      </div>
    </main>
  )
}
