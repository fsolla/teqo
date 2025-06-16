import clsx from "clsx";

export const EmailInput = ({ className }: { className?: string }) => (
  <div className={clsx("flex flex-col items-stretch gap-2", className)}>
    <input
      placeholder="Seu melhor e-mail"
      className="text-white px-5 py-3 rounded-2xl border border-blue-100 placeholder-blue-100"
    />
    <button className="text-h5 text-white bg-gradient-pink-to-purple rounded-2xl p-3">
      Reservar
    </button>
  </div>
);
