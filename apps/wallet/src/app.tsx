import { Redirect, Route, Switch } from "wouter-preact";
import PWABadge from "./PWABadge.tsx";
import { Home } from "./pages/Home.tsx";
import { useAccountStore } from "./stores/useAccountStore.ts";

export function App() {
  const hasAccount = useAccountStore((state) => state.accounts.length !== 0);

  return (
    <>
      <Switch>
        {hasAccount ? (
          <>
            <Route path="/" component={Home} />
            <Route>
              <Redirect to="/" />
            </Route>
          </>
        ) : null}
      </Switch>
      <PWABadge />
    </>
  );
}
