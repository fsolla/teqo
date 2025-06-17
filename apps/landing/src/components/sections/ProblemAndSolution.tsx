import clsx from "clsx";

export const ProblemAndSolution = () => (
  <section className="px-5 flex max-md:flex-col gap-12 md:gap-4.5 justify-center">
    <div className="flex flex-col max-md:gap-6 md:gap-y-7.5 md:gap-x-[max-content] md:grid grid-cols-2 grid-rows-[auto_auto_auto_auto] grid-flow-col lg:w-236.75">
      <h2 className="flex flex-col justify-end text-gray-500">Web3 hoje</h2>
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
      <h2 className="text-gray-500">
        <span className="bg-gradient-cyan-to-purple bg-clip-text text-transparent text-h1">
          Teqo
        </span>{" "}
        é a solução
      </h2>
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
    </div>
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
    className={clsx(
      "pl-6 py-1.5 flex flex-col gap-1 border-l-3 md:max-w-85.25 lg:max-w-105.5 text-gray-500 justify-center",
      className
    )}
  >
    <h4>{title}</h4>
    <p className="text-gray-500">{description}</p>
  </div>
);
