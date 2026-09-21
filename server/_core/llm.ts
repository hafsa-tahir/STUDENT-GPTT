import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const hasOpenRouter = () => ENV.openrouterApiKey.trim().length > 0;

const resolveApiUrl = () => {
  if (hasOpenRouter()) {
    return `${ENV.openrouterApiUrl.replace(/\/$/, "")}/chat/completions`;
  }
  return ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";
};

const resolveApiKey = () => (hasOpenRouter() ? ENV.openrouterApiKey : ENV.forgeApiKey);



const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema") {
      return { type: "json_object" };
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  return { type: "json_object" };
};

const RETRY_MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;

const shouldRetryProviderStatus = (status: number) =>
  status === 408 ||
  status === 409 ||
  status === 425 ||
  status === 429 ||
  status === 500 ||
  status === 502 ||
  status === 503 ||
  status === 504;

const shouldFallbackModelStatus = (status: number) =>
  status === 403 || shouldRetryProviderStatus(status);

const openRouterModelCandidates = (requestedModel?: string) => {
  if (!hasOpenRouter()) return requestedModel ? [requestedModel] : [undefined];
  const candidates = requestedModel
    ? [requestedModel]
    : [ENV.openrouterModel, ...ENV.openrouterFallbackModels];
  return Array.from(new Set(candidates.filter(Boolean)));
};

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

// Equal-jitter exponential backoff. The cap/2 floor guarantees a minimum
// delay so a misbehaving caller loop slows down instead of hammering the
// upstream while it keeps returning errors.
const computeBackoffDelay = (
  attempt: number,
  retryAfterMs?: number
): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

// Retries non-2xx responses and network errors with exponential backoff, then
// returns the final Response so callers keep their existing error handling.
const fetchWithBackoff = async (
  url: string,
  init: FetchInit,
  retryProviderErrors = true
): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (
        response.ok ||
        attempt === RETRY_MAX_RETRIES ||
        !retryProviderErrors ||
        !shouldRetryProviderStatus(response.status)
      ) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM request failed after exhausting retries");
};

type ProviderCandidate = {
  name: string;
  url: string;
  key: string;
  model: string;
};

function getProviderCandidates(requestedModel?: string): ProviderCandidate[] {
  const candidates: ProviderCandidate[] = [];

  // 1. Groq Keys
  if (ENV.groqApiKeys.length > 0) {
    for (let index = 0; index < ENV.groqApiKeys.length; index++) {
      const key = ENV.groqApiKeys[index];
      candidates.push({
        name: `Groq (Key #${index + 1} - openai/gpt-oss-120b)`,
        url: "https://api.groq.com/openai/v1/chat/completions",
        key,
        model: "openai/gpt-oss-120b",
      });
      candidates.push({
        name: `Groq (Key #${index + 1} - openai/gpt-oss-20b)`,
        url: "https://api.groq.com/openai/v1/chat/completions",
        key,
        model: "openai/gpt-oss-20b",
      });
    }
  }

  // 2. Gemini Keys
  if (ENV.geminiApiKeys.length > 0) {
    for (let index = 0; index < ENV.geminiApiKeys.length; index++) {
      const key = ENV.geminiApiKeys[index];
      candidates.push({
        name: `Gemini (Key #${index + 1} - gemini-3.6-flash)`,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key,
        model: "gemini-3.6-flash",
      });
      candidates.push({
        name: `Gemini (Key #${index + 1} - gemini-flash-latest)`,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key,
        model: "gemini-flash-latest",
      });
    }
  }

  // 3. OpenRouter Key & Models
  if (ENV.openrouterApiKey) {
    const models = openRouterModelCandidates(requestedModel);
    for (const m of models) {
      if (m) {
        candidates.push({
          name: `OpenRouter (${m})`,
          url: resolveApiUrl(),
          key: ENV.openrouterApiKey,
          model: m,
        });
      }
    }
  }

  // 4. Default Forge URL fallback if configured
  if (candidates.length === 0 && ENV.forgeApiKey) {
    candidates.push({
      name: "Manus Forge",
      url: resolveApiUrl(),
      key: ENV.forgeApiKey,
      model: requestedModel || "gpt-4o",
    });
  }

  return candidates;
}

const assertApiKey = () => {
  const candidates = getProviderCandidates();
  if (candidates.length === 0) {
    throw new Error("No LLM API keys configured. Please add OPENROUTER_API_KEY, GROQ_API_KEYS, or GEMINI_API_KEYS to .env.");
  }
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const candidates = getProviderCandidates(model);
  let lastError = "LLM invoke failed";

  for (const candidate of candidates) {
    payload.model = candidate.model;
    try {
      const response = await fetchWithBackoff(
        candidate.url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${candidate.key}`,
          },
          body: JSON.stringify(payload),
        },
        true
      );

      if (response.ok) return (await response.json()) as InvokeResult;

      const errorText = await response.text();
      lastError = `[${candidate.name}] failed: ${response.status} ${response.statusText} – ${errorText}`;
      console.warn(`Provider ${candidate.name} failed with ${response.status}; trying next provider candidate...`);
    } catch (err) {
      lastError = `[${candidate.name}] error: ${(err as Error).message}`;
      console.warn(`Provider ${candidate.name} encountered error; trying next candidate...`);
    }
  }

  throw new Error(lastError);
}

export async function streamLLM(params: InvokeParams): Promise<Response> {
  assertApiKey();
  const payload: Record<string, unknown> = {
    messages: params.messages.map(normalizeMessage),
    stream: true,
  };
  if (params.max_tokens ?? params.maxTokens) payload.max_tokens = params.max_tokens ?? params.maxTokens;
  if (params.tools?.length) payload.tools = params.tools;
  const normalizedToolChoice = normalizeToolChoice(params.toolChoice || params.tool_choice, params.tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;

  const candidates = getProviderCandidates(params.model);
  let lastError = "LLM stream failed";

  for (const candidate of candidates) {
    payload.model = candidate.model;
    try {
      const response = await fetchWithBackoff(
        candidate.url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${candidate.key}`,
          },
          body: JSON.stringify(payload),
        },
        true
      );
      if (response.ok) return response;

      const errorText = await response.text();
      lastError = `[${candidate.name}] stream failed: ${response.status} ${response.statusText} – ${errorText}`;
      console.warn(`Stream provider ${candidate.name} failed with ${response.status}; trying next provider candidate...`);
    } catch (err) {
      lastError = `[${candidate.name}] stream error: ${(err as Error).message}`;
      console.warn(`Stream provider ${candidate.name} error; trying next candidate...`);
    }
  }
  throw new Error(lastError);
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  assertApiKey();

  const url = hasOpenRouter()
    ? `${ENV.openrouterApiUrl.replace(/\/$/, "")}/models`
    : ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
      ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/models`
      : "https://forge.manus.im/v1/models";

  const response = await fetchWithBackoff(url, {
    headers: {
      authorization: `Bearer ${resolveApiKey()}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `List LLM models failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as ModelsResponse;
}

export function repairTruncatedJSON(jsonStr: string): string | null {
  let str = jsonStr.trim();
  if (!str.startsWith("{") && !str.startsWith("[")) return null;

  let inString = false;
  let isEscaped = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "\\" && !isEscaped) {
      isEscaped = true;
    } else {
      if (char === '"' && !isEscaped) {
        inString = !inString;
      }
      isEscaped = false;
    }
  }

  if (inString) {
    str += '"';
  }

  str = str.replace(/,\s*$/, "");
  str = str.replace(/:\s*$/, ': ""');
  str = str.replace(/,\s*("[^"]*")?\s*$/, "");

  const stack: string[] = [];
  inString = false;
  isEscaped = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "\\" && !isEscaped) {
      isEscaped = true;
    } else {
      if (char === '"' && !isEscaped) {
        inString = !inString;
      } else if (!inString) {
        if (char === "{" || char === "[") {
          stack.push(char === "{" ? "}" : "]");
        } else if (char === "}" || char === "]") {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
      isEscaped = false;
    }
  }

  while (stack.length > 0) {
    str += stack.pop();
  }

  return str;
}

export function safeParseJSON<T>(raw: string, fallback?: Partial<T>): T {
  if (!raw || typeof raw !== "string") {
    if (fallback) return fallback as T;
    throw new Error("Empty LLM response content");
  }

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        // Fallthrough to repair
      }
    }

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1)) as T;
      } catch {
        // Fallthrough to repair
      }
    }

    if (firstBrace !== -1) {
      const fragment = cleaned.slice(firstBrace);
      const repaired = repairTruncatedJSON(fragment);
      if (repaired) {
        try {
          return JSON.parse(repaired) as T;
        } catch {
          // Fallthrough to fallback
        }
      }
    }

    if (fallback) return fallback as T;
    throw new Error(`Invalid JSON output from AI provider.`);
  }
}


