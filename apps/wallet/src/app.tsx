import { Route, Switch } from "wouter-preact";
import PWABadge from "./PWABadge.tsx";
import { Home } from "./pages/Home.tsx";
import { NotFound } from "./pages/NotFound.tsx";

export function App() {
  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
      <PWABadge />
    </>
  );
}
