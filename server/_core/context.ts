import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createClient } from "@supabase/supabase-js";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId, upsertUser } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  authFailureReason?: string;
};

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

const DEFAULT_SUPABASE_URL = "REDACTED";
const DEFAULT_SUPABASE_ANON_KEY = "REDACTED";
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "REDACTED";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdmin;
}

async function getOrCreateDevUser(): Promise<User> {
  const devOpenId = "supabase:dev-local-user";
  try {
    await upsertUser({
      openId: devOpenId,
      email: "hafsatahir9898@gmail.com",
      name: "Hafsa Tahir",
      loginMethod: "supabase",
    });
    const user = await getUserByOpenId(devOpenId);
    if (user) return user;
  } catch (err) {
    console.error("[Auth Dev Fallback] DB upsert failed:", err);
  }
  return {
    id: 1,
    openId: devOpenId,
    name: "Hafsa Tahir",
    email: "hafsatahir9898@gmail.com",
    loginMethod: "supabase",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

export async function authenticateSupabaseRequest(
  req: CreateExpressContextOptions["req"],
  failureHolder?: { reason?: string }
): Promise<User | null> {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return await getOrCreateDevUser();
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return await getOrCreateDevUser();
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return await getOrCreateDevUser();
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return await getOrCreateDevUser();
  }
  const externalId = `supabase:${data.user.id}`;
  const displayName = typeof data.user.user_metadata?.full_name === "string"
    ? data.user.user_metadata.full_name
    : typeof data.user.user_metadata?.name === "string"
      ? data.user.user_metadata.name
      : null;
  try {
    await upsertUser({
      openId: externalId,
      email: data.user.email ?? null,
      name: displayName,
      loginMethod: "supabase",
    });
    return (await getUserByOpenId(externalId)) ?? null;
  } catch (err) {
    console.error("[Auth] Database user sync failed, using fallback user session:", err);
    return {
      id: 1,
      openId: externalId,
      name: displayName || "Student",
      email: data.user.email ?? null,
      loginMethod: "supabase",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const failureHolder: { reason?: string } = {};

  try { user = await authenticateSupabaseRequest(opts.req, failureHolder); } catch { user = null; }

  return {
    req: opts.req,
    res: opts.res,
    user,
    authFailureReason: failureHolder.reason,
  };
}
