import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient> | null = null;
let accessToken: string | null = null;

export function setSupabaseAccessToken(token: string | null) {
  accessToken = token;
}

export function getSupabaseAccessToken() {
  return accessToken;
}

export function getSupabaseBrowserClient() {
  if (!clientPromise) {
    const envUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
    const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

    if (envUrl && envAnonKey) {
      const client = createClient(envUrl, envAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      clientPromise = Promise.resolve(client);
    } else {
      clientPromise = fetch("/api/auth/supabase-config")
        .then(res => {
          if (!res.ok) throw new Error("Authentication server unavailable.");
          return res.json();
        })
        .then(config => {
          if (!config.url || !config.anonKey) {
            throw new Error("StudentGPT authentication is unavailable (Missing env vars).");
          }
          return createClient(config.url, config.anonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          });
        })
        .catch(err => {
          clientPromise = null;
          throw err;
        });
    }
  }
  return clientPromise;
}
