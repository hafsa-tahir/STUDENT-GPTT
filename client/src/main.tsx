import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getSupabaseAccessToken, setSupabaseAccessToken } from "./lib/supabase";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

const getTrpcUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/trpc`;
  }
  return "/api/trpc";
};

const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: getTrpcUrl(),
      transformer: superjson,
      headers() {
        // First try the in-memory token set by SupabaseAuthContext
        const supabaseToken = getSupabaseAccessToken();
        if (supabaseToken) return { Authorization: `Bearer ${supabaseToken}` };

        // Fallback: read directly from Supabase's localStorage key
        // (handles race where query fires before SupabaseAuthContext sets the token)
        try {
          const SUPABASE_URL = "https://cfboullooogzodvrqevy.supabase.co";
          const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] ?? "";
          const storageKey = `sb-${projectRef}-auth-token`;
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            const token = parsed?.access_token;
            if (token) {
              setSupabaseAccessToken(token);
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // localStorage unavailable or parse error
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
