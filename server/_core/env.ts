const decodeSecret = (b64: string) => {
  try { return Buffer.from(b64, "base64").toString("utf-8"); } catch { return ""; }
};

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "REDACTED",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openrouterApiUrl: process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1",
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? decodeSecret("REDACTED"),
  openrouterModel: process.env.OPENROUTER_MODEL ?? "openrouter/free",
  openrouterFallbackModels: (process.env.OPENROUTER_FALLBACK_MODELS ?? "nvidia/nemotron-3.5-lightning:free,liquid/lfm-2.5-2.6b:free,google/gemma-4-26b-a4b-it:free")
    .split(",")
    .map(model => model.trim())
    .filter(Boolean),
  groqApiKeys: (process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY ?? decodeSecret("REDACTED"))
    .split(",")
    .map(k => k.trim())
    .filter(Boolean),
  geminiApiKeys: (process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? decodeSecret("REDACTED"))
    .split(",")
    .map(k => k.trim())
    .filter(Boolean),
  serpApiKey: process.env.SERPAPI_KEY ?? decodeSecret("REDACTED"),
  youtubeApiKey: process.env.YOUTUBE_DATA_API_KEY ?? decodeSecret("REDACTED"),
};

