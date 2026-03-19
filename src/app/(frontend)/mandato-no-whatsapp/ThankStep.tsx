import { WhatsAppIcon } from '@/components/socialIcons'
import { Button } from '@payloadcms/ui'
import Image from 'next/image'
import Link from 'next/link'

export const ThankStep = () => (
  <main className="h-screen w-screen bg-[url(/BG.jpg)] bg-cover bg-bottom-right overflow-y-scroll no-scrollbar flex">
    <div className="flex flex-col p-2 lg:grid lg:grid-cols-[45%_55%] max-w-300 m-auto">
      <div className="max-lg:h-70 flex flex-col items-center justify-center lg:row-span-5 lg:row-start-1">
        <Image src="/SOLLA.png" width={851} height={812} alt="" priority />
      </div>
      <h1 className="text-left mb-2 mt-8 text-3xl xs:text-4xl sm:text-center lg:text-left lg:text-5xl lg:row-start-2">
        CADASTRO REALIZADO <br /> <span className="text-[#f9844e]">COM SUCESSO!</span>
      </h1>
      <h2 className="text-xs xs:text-sm sm:text-center lg:text-left lg:text-xl lg:mb-4 lg:row-start-3">
        VOCÊ SERÁ REDIRECIONADO A COMUNIDADE EXCLUSIVA
        <br />
        DO DEPUTADO JORGE SOLLA NO WHATSAPP.
        <br />
        CLIQUE NO BOTÃO ABAIXO E EM SEGUIDA CLIQUE
        <br />
        EM 'ENTRAR' PARA CONFIRMAR.
      </h2>
      <Button className="bg-[#99c343] font-bold text-base py-3 rounded-full mx-2 lg:max-w-100 lg:mx-0 lg:row-start-4">
        <Link href="https://whatsapp.com/channel/0029Vb5cJcT30LKLFkdN5P25" target="_blank">
          <WhatsAppIcon className="text-white w-5 inline mr-2 mb-1" />
          <span>ENTRAR NA COMUNIDADE AGORA</span>
        </Link>
      </Button>
      <div className="h-30 flex flex-col items-center justify-center overflow-hidden lg:col-span-2 lg:place-self-center lg:mt-8">
        <Image src="LOGO_SOLLA_BRANCO.svg" width={430} height={300} alt="" />
      </div>
    </div>
  </main>
)
