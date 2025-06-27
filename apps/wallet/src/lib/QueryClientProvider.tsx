import {
  QueryClientProvider as OgQueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";
import type { PropsWithChildren } from "preact/compat";

const queryClient = new QueryClient();

export const QueryClientProvider = ({ children }: PropsWithChildren) => (
  <OgQueryClientProvider client={queryClient}>
    {children as React.ReactNode}
  </OgQueryClientProvider>
);
