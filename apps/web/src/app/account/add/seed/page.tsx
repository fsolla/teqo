"use client";
import { Forward } from "lucide-react";

export default function Page() {
  return (
    <main>
      <h2>Recovery phrase</h2>
      <p className="text-teko-400">
        Import an existing wallet with 12 or 24-word recovery phrase.
      </p>
      <input type="text" placeholder="Enter your recovery phrase" autoFocus />
      <Forward href="/account/add/name" className="self-end mr-4" />
    </main>
  );
}
