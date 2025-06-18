"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import {
  useImperativeHandle,
  useRef,
  type FormEventHandler,
  type PropsWithChildren,
  type Ref,
} from "react";

export const EmailInput = ({ className }: { className?: string }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<Modal>(null);

  const handleSubmit: FormEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();

    fetch("/api/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: inputRef.current?.value }),
    }).then(() => modalRef.current?.open());
  };

  return (
    <form
      className={clsx("flex max-lg:flex-col items-stretch gap-2", className)}
    >
      <input
        ref={inputRef}
        type="email"
        name="email"
        placeholder="Seu melhor e-mail"
        className="text-white px-5 py-3 rounded-2xl border border-blue-100 placeholder-blue-100 flex-1 lg:min-w-121.5"
        required
      />
      <button
        type="submit"
        className="text-h5 text-white bg-gradient-pink-to-purple rounded-2xl px-5 py-3 lg:px-7 lg:py-4 active:opacity-80 active:scale-98 transition-all duration-75"
        onClick={handleSubmit}
      >
        Reservar
      </button>
      <Modal ref={modalRef}>
        <div className="bg-white p-4 px-5 flex flex-col gap-2 min-w-74 relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              modalRef.current?.close();
            }}
            className="absolute top-4 right-5"
          >
            <X size={16} />
          </button>
          <h5>Bem-vindo(a)</h5>
          <p>
            Você agora faz parte do grupo que vai experimentar o Teqo em
            primeira mão.
          </p>
        </div>
      </Modal>
    </form>
  );
};

type Modal = {
  open: () => void;
  close: () => void;
};

export const Modal = ({
  children,
  ref,
}: PropsWithChildren<{ ref: Ref<Modal> }>) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => dialogRef.current?.showModal(),
    close: () => dialogRef.current?.close(),
  }));

  return (
    <dialog
      ref={dialogRef}
      className="top-full left-full -translate-[calc(100%+24px)] bg-transparent"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dialogRef.current?.close();
        }
      }}
    >
      {children}
    </dialog>
  );
};
