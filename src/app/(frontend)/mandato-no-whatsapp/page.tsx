import { WhatsappForm } from '@/components/WhatsappForm'
import Image from 'next/image'

export default function Page() {
  return (
    <main className="h-screen w-screen bg-[url(/BG.jpg)] bg-cover bg-center overflow-y-scroll no-scrollbar flex">
      <div className="flex flex-col p-2 lg:grid lg:grid-cols-[55%_45%] max-w-300 m-auto">
        <h1 className="text-left mb-4 mt-8 text-3xl xs:text-4xl sm:text-center lg:text-left lg:text-6xl">
          FIQUE POR DENTRO
          <br />
          DO <span className="text-[#f9844e]">NOSSO MANDATO!</span>
        </h1>
        <h2 className="text-sm 2xs:text-base xs:text-lg sm:text-center lg:text-left lg:col-start-1 lg:text-2xl lg:mb-4">
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
        <Image
          className="-mb-10 sm:-mb-15 sm:max-w-120 lg:max-w-[140%] self-center sm:row-span-3 lg:row-start-1 lg:col-start-2 lg:-mx-5 lg:place-self-center lg:-translate-x-18 lg:translate-y-18"
          src="/LULA_E_SOLLA.png"
          width={956}
          height={948}
          alt=""
        />
        <WhatsappForm classname="flex-1 lg:max-w-[75%]" />
        <Image
          src="LOGO_SOLLA_BRANCO.svg"
          width={430}
          height={300}
          alt=""
          className="-my-20 self-center lg:col-span-2 lg:place-self-center"
        />
        <p className="text-center m-0 text-xs lg:col-span-2 md:text-sm lg:text-base">
          <strong>Seus dados estão seguros.</strong> Utilizamos suas informações apenas para contato
          e envio de conteúdos relacionados.
          <br />
          Não compartilhamos dados com terceiros. Ao preencher o formulário, você concorda com nossa
          política de uso de dados conforme a LGPD.
        </p>
      </div>
    </main>
  )
}
