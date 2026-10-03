import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getSupabaseAccessToken, setSupabaseAccessToken, getSupabaseBrowserClient } from "./lib/supabase";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      async retry(failureCount, error: any) {
        if (failureCount < 2 && (error?.data?.code === "UNAUTHORIZED" || error?.message?.includes("10001") || error?.message?.includes("Auth Error") || error?.message?.includes("expired"))) {
          try {
            const client = await getSupabaseBrowserClient();
            const { data } = await client.auth.refreshSession();
            if (data.session?.access_token) {
              setSupabaseAccessToken(data.session.access_token);
              return true;
            }
          } catch {
            // refresh failed
          }
          return true;
        }
        return false;
      },
      refetchOnWindowFocus: false,
    },
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
        let token = getSupabaseAccessToken();
        if (!token && typeof window !== "undefined") {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.startsWith("sb-") || key.includes("auth-token") || key.includes("supabase"))) {
                const raw = localStorage.getItem(key);
                if (raw && raw.includes("access_token")) {
                  const parsed = JSON.parse(raw);
                  const found = parsed?.access_token || parsed?.currentSession?.access_token;
                  if (found && typeof found === "string") {
                    token = found;
                    setSupabaseAccessToken(found);
                    break;
                  }
                }
              }
            }
          } catch {
            // localStorage unavailable or parse error
          }
        }
        return token ? { Authorization: `Bearer ${token}` } : {};
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

if (typeof window !== "undefined") {
  window.addEventListener("supabase-token-ready", () => {
    queryClient.invalidateQueries();
  });
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
