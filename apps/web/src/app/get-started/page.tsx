import { Route } from "@/components/molecules/Route";
import Link from "next/link";

export default function Page() {
  return (
    <main className="flex flex-col h-full px-4 pb-28 pt-42 gap-2">
      <h1 className="flex-1 text-center">Teqo</h1>
      <Route
        href="/create-account/email-input"
        label="Enter with Teqo"
        icon="chevron-right"
      />
      <Link href="/import-account" className="pl-9 pr-5 py-6.5">
        <h5 className="flex-1 text-center">Import existing wallet</h5>
      </Link>
    </main>
  );
}
