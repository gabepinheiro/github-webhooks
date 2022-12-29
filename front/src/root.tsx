import { App } from "./App";

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from './lib/query-client'

export function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
