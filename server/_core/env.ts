const decodeSecret = (b64: string) => {
  try { return Buffer.from(b64, "base64").toString("utf-8"); } catch { return ""; }
};

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "696969",
  databaseUrl: process.env.DATABASE_URL ?? "mysql://2jCE8HXQf4ZE9KZ.root:I7O2JBmlGuHlHzQH@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?ssl=true",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openrouterApiUrl: process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1",
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? decodeSecret("c2stb3ItdjEtNDkxZTFiYjFjMTMwMjM4MmNiMzcyNTMwYTI0ZDI5YmM4MjhhNDY1YTM1YTg3MTQ5MWVlMTkyYzZlZDg0Y2YxOA=="),
  openrouterModel: process.env.OPENROUTER_MODEL ?? "openrouter/free",
  openrouterFallbackModels: (process.env.OPENROUTER_FALLBACK_MODELS ?? "nvidia/nemotron-3.5-lightning:free,liquid/lfm-2.5-2.6b:free,google/gemma-4-26b-a4b-it:free")
    .split(",")
    .map(model => model.trim())
    .filter(Boolean),
  groqApiKeys: (process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY ?? decodeSecret("Z3NrX2xaWFVlNTFOQ2RmOE02d1ZGR3lFV0dkeWJyRlluVWVCYVpIZDRwTUYwdGpTNERSTFZDQncsZ3NrXzVaYXdwaUFwNEdzbTQyT0NOcGoyV0dkeWJyRll5dmlNYmw1V3NOdW5vWUpZbWtHeTAzOW0="))
    .split(",")
    .map(k => k.trim())
    .filter(Boolean),
  geminiApiKeys: (process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? decodeSecret("QVEuQWI4Uk42SmtyczRiLWNJUlZRRTBzbkZGZ21oVWg0aG9yRDhNQnpuOXlGME1IX1k4QSxBUS5BYjhSTjZJOTB4TjprNVlnRVM2ZFRiTDZIVUVjV29oZ29OM05lNVRidTVEQk14WXh0Zw=="))
    .split(",")
    .map(k => k.trim())
    .filter(Boolean),
  serpApiKey: process.env.SERPAPI_KEY ?? decodeSecret("NDlhODRiZDNlYmY1YzIzOGQ2NmE2YTMxYWE2NDVkMTI2YjFlMTQ2MjkwNmIzNjdlYTQwM2YyZGM0MjhjODQ3Mg=="),
  youtubeApiKey: process.env.YOUTUBE_DATA_API_KEY ?? decodeSecret("QUl6YVN5RDRKMWQ4cUFhb2tnTnZqMXQ0V0tjczJLYkllVEhHQUVz"),
};

