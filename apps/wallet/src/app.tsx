import { Redirect, Route, Switch } from "wouter-preact";
import PWABadge from "./PWABadge.tsx";
import { QueryClientProvider } from "./lib/QueryClientProvider.tsx";
import { EmailConfirmation } from "./pages/EmailConfirmation.tsx";
import { EmailInput } from "./pages/EmailInput.tsx";
import { Home } from "./pages/Home.tsx";
import { NameInput } from "./pages/NameInput.tsx";
import { PinSetupRoutes } from "./pages/PinSetupRoutes.tsx";
import { SignIn } from "./pages/SignIn.tsx";
import { useAccountStore } from "./stores/useAccountStore.ts";

export function App() {
  const hasAccount = useAccountStore((state) => state.accounts.length !== 0);

  return (
    <QueryClientProvider>
      <>
        <Switch>
          {hasAccount ? (
            <>
              <Route path="/" component={Home} />
            </>
          ) : (
            <>
              <Route path="/" component={SignIn} />
              <Route path="/input/email" component={EmailInput} />
              <Route
                path="/input/email/confirmation"
                component={EmailConfirmation}
              />
              <Route path="/input/name" component={NameInput} />
              <PinSetupRoutes />
            </>
          )}
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
        <PWABadge />
      </>
    </QueryClientProvider>
  );
}
