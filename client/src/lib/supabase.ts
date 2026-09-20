import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient> | null = null;
let accessToken: string | null = null;

const DEFAULT_SUPABASE_URL = "https://cfboullooogzodvrqevy.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmYm91bGxvb29nem9kdnJxZXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDcwNjEsImV4cCI6MjEwMjIyMzA2MX0.-S1AWtxFoTDB_9pMTHrjD0XnlCSpveZxQZroMjLbBZM";

export function setSupabaseAccessToken(token: string | null) {
  accessToken = token;
}

export function getSupabaseAccessToken() {
  return accessToken;
}

export function getSupabaseBrowserClient() {
  if (!clientPromise) {
    const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

    const client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    clientPromise = Promise.resolve(client);
  }
  return clientPromise;
}
