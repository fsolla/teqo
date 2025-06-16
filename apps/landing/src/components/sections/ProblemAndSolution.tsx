import clsx from "clsx";
import type { PropsWithChildren, ReactNode } from "react";

export const ProblemAndSolution = () => (
  <section className="px-5 flex flex-col gap-12">
    <Group title="Web3 hoje" className="text-gray-500">
      <Item
        title="Medo de perder tudo"
        description="Chaves privadas, seeds phrases, contratos. A responsabilidade toda está em suas mãos, sem rede de segurança."
      />
      <Item
        title="Experiência fragmentada"
        description="Transações que geram ansiedade, interfaces confusas, jargões técnicos que afastam pessoas normais."
      />
      <Item
        title="Falta de clareza"
        description="Você nunca sabe exatamente o que está acontecendo, quanto vai custar, ou se deu certo."
      />
    </Group>
    <Group
      title={
        <>
          <h1 className="bg-gradient-cyan-to-purple bg-clip-text text-transparent inline-block">
            Teqo
          </h1>{" "}
          é a solução
        </>
      }
    >
      <Item
        title="Recuperação assistida"
        description="Protegemos sua chave cripiografada em nosso cofre. Você sempre terá acesso à sua conta, hoje e sempre."
        className="text-green-400"
      />
      <Item
        title="Experiência fluida"
        description="Microinterações pensadas para acompanhar cada transação, controlando sua ansiedade do início ao fim."
        className="text-purple-400"
      />
      <Item
        title="Transparência total"
        description="Sempre sabemos o que está acontecendo, quanto custa, e damos feedback claro sobre cada ação."
        className="text-blue-400"
      />
    </Group>
  </section>
);

const Item = ({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) => (
  <div
    className={clsx("pl-6 px-1.5 flex flex-col gap-1 border-l-3", className)}
  >
    <h4>{title}</h4>
    <p className={clsx(className && "text-gray-500")}>{description}</p>
  </div>
);

const Group = ({
  title,
  children,
  className,
}: PropsWithChildren<{ title: ReactNode; className?: string }>) => (
  <div className={clsx("flex flex-col gap-6", className)}>
    <h2>{title}</h2>
    {children}
  </div>
);
