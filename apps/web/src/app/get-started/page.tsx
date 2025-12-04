import { Route } from "@/components/molecules/Route";
import Link from "next/link";

export default function Page() {
  return (
    <main className="flex flex-col h-full px-4 pb-28 pt-42 gap-2">
      <h1 className="flex-1 text-center">Teqo</h1>
      <Route
        href="/create-account/email-input"
        label="Create new wallet"
        icon="chevron-right"
      />
      <Link href="/import-account" className="pl-9 pr-5 py-6.5">
        <h5 className="flex-1 text-center">I already have a wallet</h5>
      </Link>
    </main>
  );
}
