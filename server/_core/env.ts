export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openrouterApiUrl: process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1",
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openrouterModel: process.env.OPENROUTER_MODEL ?? "google/gemma-4-31b-it:free",
  openrouterFallbackModels: (process.env.OPENROUTER_FALLBACK_MODELS ?? "nvidia/nemotron-3.5-lightning:free,liquid/lfm-2.5-2.6b:free")
    .split(",")
    .map(model => model.trim())
    .filter(Boolean),
  groqApiKeys: (process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY ?? "")
    .split(",")
    .map(k => k.trim())
    .filter(Boolean),
  geminiApiKeys: (process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? "")
    .split(",")
    .map(k => k.trim())
    .filter(Boolean),
};

