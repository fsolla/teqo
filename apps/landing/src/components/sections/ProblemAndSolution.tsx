import clsx from "clsx";

export const ProblemAndSolution = () => (
  <section className="px-5 flex max-md:flex-col gap-12 md:gap-4.5 justify-center">
    <div className="flex flex-col max-md:gap-6 md:gap-y-7.5 md:gap-x-[max-content] md:grid grid-cols-2 grid-rows-[auto_auto_auto_auto] grid-flow-col lg:w-236.75">
      <h2 className="flex flex-col justify-end text-gray-500">Web3 today</h2>
      <Item
        title="Fear of losing everything"
        description="Private keys, seed phrases, contracts. Total responsibility is in your hands, with no safety net."
      />
      <Item
        title="Fragmented experience"
        description="Transactions that cause anxiety, confusing interfaces, technical jargon that alienates normal people."
      />
      <Item
        title="Lack of clarity"
        description="You never know exactly what is happening, how much it will cost, or if it worked."
      />
      <h2 className="text-gray-500">
        <span className="bg-gradient-cyan-to-purple bg-clip-text text-transparent text-h1">
          Teqo
        </span>{" "}
        is the solution
      </h2>
      <Item
        title="Assisted recovery"
        description="We protect your encrypted key in our vault. You will always have access to your account, now and always."
        className="text-green-400"
      />
      <Item
        title="Fluid experience"
        description="Microinteractions designed to guide each transaction, easing your anxiety from start to finish."
        className="text-purple-400"
      />
      <Item
        title="Total transparency"
        description="We always know what's happening, how much it costs, and we provide clear feedback for every action."
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
