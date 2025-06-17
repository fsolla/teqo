"use client";

import clsx from "clsx";
import { useRef, type MouseEventHandler } from "react";

export const EmailInput = ({ className }: { className?: string }) => {
  const ref = useRef<HTMLInputElement>(null);

  const handleSubmit: MouseEventHandler<HTMLButtonElement> = () => {
    fetch("/api/subscribe", {
      method: "POST",
      body: JSON.stringify({ email: ref.current?.value }),
    });
  };

  return (
    <div
      className={clsx("flex max-lg:flex-col items-stretch gap-2", className)}
    >
      <input
        ref={ref}
        type="email"
        name="email"
        placeholder="Seu melhor e-mail"
        className="text-white px-5 py-3 rounded-2xl border border-blue-100 placeholder-blue-100 flex-1 lg:min-w-121.5"
        required
      />
      <button
        type="submit"
        className="text-h5 text-white bg-gradient-pink-to-purple rounded-2xl px-5 py-3 lg:px-7 lg:py-4"
        onClick={handleSubmit}
      >
        Reservar
      </button>
    </div>
  );
};
