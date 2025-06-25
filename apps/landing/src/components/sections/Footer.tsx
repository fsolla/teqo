import Image from "next/image";

export const Footer = () => (
  <footer className="snap-start flex flex-col bg-blue-950 text-white px-5 py-6 gap-3 w-full">
    <span className="text-2xl font-bold">
      <Image
        src="/logo.svg"
        width={133.64}
        height={90}
        alt="Teqo Logo"
        className="inline-block w-7 mr-2"
      />
      Teqo
    </span>
    <h6>
      Your digital wallet that makes Web3 simple, secure, and accessible.
      <br />
      Digital ownership with clarity and intention
    </h6>
    <div className="h-0.25 bg-white opacity-20 mt-3" />
    <div className="flex">
      <h6 className="flex-1">
        © 2025 Teqo.
        <br />
        All rights reserved.
      </h6>
      <h6 className="text-right">Built with intention.</h6>
    </div>
  </footer>
);
