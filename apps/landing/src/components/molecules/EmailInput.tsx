"use client";

import { X } from "lucide-react";
import {
  useImperativeHandle,
  useRef,
  type MouseEventHandler,
  type PropsWithChildren,
  type Ref,
} from "react";

export const EmailInput = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<Modal>(null);

  const handleSubmit: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();

    console.log({
      value: inputRef.current?.value,
      valid: inputRef.current?.validity.valid,
    });

    if (!inputRef.current?.value || !inputRef.current.validity.valid) {
      inputRef.current?.focus();
      return;
    }

    fetch("/api/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: inputRef.current?.value }),
    }).then(() => {
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.blur();
      }

      modalRef.current?.open();
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="email"
        name="email"
        placeholder="Your best email"
        className="bg-white rounded-2xl px-4 py-3 text-black placeholder:text-gray-400 inset-shadow-sm inset-shadow-black/50 max-w-md"
      />
      <div className="flex-1" />
      <button
        onClick={handleSubmit}
        className="px-6 py-3 rounded-2xl bg-linear-150 from-blue-800 from-20% to-blue-900 to-95% w-fit active:opacity-80 active:scale-95"
      >
        <h5>JOIN WAITLIST</h5>
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
          <h5>Welcome</h5>
          <p>
            You are now part of the group that will experience Teqo firsthand.
          </p>
        </div>
      </Modal>
    </>
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
