import { ShieldCheck } from "@/components/atoms/ShieldCheck";
import clsx from "clsx";
import type { ReactNode } from "react";

export const HowItWorks = () => (
  <section className="px-5 flex flex-col gap-4">
    <h2 className="mb-2">
      Como{" "}
      <h1 className="bg-gradient-cyan-to-purple bg-clip-text text-transparent inline-block">
        Teqo
      </h1>{" "}
      funciona?
    </h2>
    <Item
      title="Crie sua conta"
      description="Sua chave privada é protegida automaticamente."
      className="text-green-400"
    />
    <Item
      title="Gerencie com clareza"
      description={
        <>
          Veja todos seus ativos digitais organizados de forma simples.
          <br />
          Tokens, NFTs, domínios.
        </>
      }
      className="text-purple-400"
    />
    <Item
      title="Transacione sem medo"
      description="Cada ação é explicada antes de acontecer. Acompanhe o progresso em tempo real."
      className="text-blue-400"
    />
    <div className="flex flex-col gap-3">
      <div className="pt-5 px-3 pb-2.5 bg-gradient-pink-to-purple rounded-2xl">
        <div className="flex flex-col gap-1 bg-white rounded-2xl py-6 px-7.5 items-center">
          <h4 className="bg-gradient-pink-to-purple bg-clip-text text-transparent inline-block">
            Recuperação assistida por padrão
          </h4>
          <p className="text-gray-500">
            Diferente de outras carteiras, você não precisa se preocupar em
            perder suas chaves. Protegemos tudo de forma segura para que você
            sempre tenha acesso.
          </p>
          <ShieldCheck className="mt-2" />
        </div>
      </div>
      <h6 className="px-10">
        <strong className="font-bold">Para usuários avançados:</strong> Você
        pode desativar essa proteção e usar de forma completamente
        auto-custodial quando quiser.
      </h6>
    </div>
  </section>
);

const Item = ({
  title,
  description,
  className,
}: {
  title: string;
  description: ReactNode;
  className: string;
}) => (
  <div className={clsx("px-10 py-6 border rounded-2xl", className)}>
    <h4>{title}</h4>
    <p className="text-gray-500">{description}</p>
  </div>
);
