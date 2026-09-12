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
    const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
    
    if (!url || !anonKey) {
      console.error("Missing Supabase environment variables. Please check your .env file.");
      clientPromise = Promise.reject(new Error("StudentGPT authentication is unavailable (Missing env vars)."));
    } else {
      const client = createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      clientPromise = Promise.resolve(client);
    }
  }
  return clientPromise;
}
