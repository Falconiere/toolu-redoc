/** App-wide providers — one component, mounted once from src/main.tsx. */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { BandThemeProvider } from "@/providers/band-theme-provider";

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BandThemeProvider>{children}</BandThemeProvider>
    </QueryClientProvider>
  );
}
