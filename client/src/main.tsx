import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getSupabaseAccessToken, setSupabaseAccessToken, getSupabaseBrowserClient } from "./lib/supabase";
import "./index.css";
import "katex/dist/katex.min.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry(failureCount, error: any) {
        if (failureCount < 2 && (error?.data?.code === "UNAUTHORIZED" || error?.message?.includes("10001") || error?.message?.includes("Auth Error") || error?.message?.includes("expired"))) {
          getSupabaseBrowserClient().then(client => client.auth.refreshSession()).then(({ data }) => {
            if (data?.session?.access_token) setSupabaseAccessToken(data.session.access_token);
          }).catch(() => {});
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
      async headers() {
        let token = getSupabaseAccessToken();
        if (!token && typeof window !== "undefined") {
          try {
            const client = await getSupabaseBrowserClient();
            const { data } = await client.auth.getSession();
            if (data.session?.access_token) {
              token = data.session.access_token;
              setSupabaseAccessToken(token);
            }
          } catch {
            // session lookup failed
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
