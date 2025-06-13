import { Route } from "@/components/molecules/Route";

export default function Page() {
  return (
    <main className="h-full grid grid-cols-2 grid-rows-[auto_min-content_min-content_min-content_min-content] gap-4 px-4 pb-17.5 pt-42">
      <h1 className="text-center col-span-2">Teqo</h1>
      <Route
        variant="terciary"
        href="/import-private-key/network"
        label="Import private key"
      />
      <Route
        variant="terciary"
        href="/connect-wallet/choose"
        label="Connect wallet"
      />
      <Route
        variant="secondary"
        href="/connect-hardware-wallet"
        label="Connect hardware wallet"
        icon="hard-drive-upload"
        className="col-span-2"
      />
      <Route
        href="/create-account/email-input"
        label="Enter with Teqo"
        icon="chevron-right"
        className="col-span-2"
      />
      <Route
        variant="secondary"
        href="/welcome/import-recovery-phrase"
        label="Import recovery phrase"
        icon="file-text"
        className="col-span-2"
      />
    </main>
  );
}
