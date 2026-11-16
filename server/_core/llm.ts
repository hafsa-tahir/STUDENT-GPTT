import fs from "node:fs";
import path from "node:path";
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
  temperature?: number;
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

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: init.signal || AbortSignal.timeout(180000),
      });
      if (
        response.ok ||
        attempt === 2 ||
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
        `LLM request retry ${attempt + 1}/2 after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      // Immediately fail fast on timeouts to try next provider candidate
      if (
        (error as Error).name === "TimeoutError" ||
        (error as Error).name === "AbortError" ||
        attempt >= 1
      ) {
        throw error;
      }
      console.warn(
        `LLM request retry ${attempt + 1}/2 after network error: ${(error as Error).message}`
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

let deadCustomUrl = "";

function resolveCustomModelUrl(): string {
  try {
    const endpointFile = path.resolve(process.cwd(), "model-training", "active_endpoint.txt");
    if (fs.existsSync(endpointFile)) {
      const url = fs.readFileSync(endpointFile, "utf-8").trim();
      if (url.startsWith("http")) {
        const clean = url.replace(/\/$/, "");
        const resolved = clean.endsWith("/v1/chat/completions") ? clean : `${clean}/v1/chat/completions`;
        if (resolved !== deadCustomUrl) return resolved;
      }
    }
  } catch {
    // ignore file read error
  }
  if (ENV.customModelApiUrl && ENV.customModelApiUrl.trim().startsWith("http")) {
    const clean = ENV.customModelApiUrl.trim().replace(/\/$/, "");
    const resolved = clean.endsWith("/v1/chat/completions") ? clean : `${clean}/v1/chat/completions`;
    if (resolved !== deadCustomUrl) return resolved;
  }
  return "";
}

function getProviderCandidates(requestedModel?: string, _isStructuredJson = false): ProviderCandidate[] {
  const candidates: ProviderCandidate[] = [];

  // 0. Custom Fine-Tuned StudentGPT-7B LoRA Model (Primary #1 Priority when active_endpoint.txt is set!)
  const customUrl = resolveCustomModelUrl();
  if (customUrl) {
    candidates.push({
      name: "StudentGPT-7B-Academic-Tutor (Custom LoRA)",
      url: customUrl,
      key: ENV.customModelApiKey || "studentgpt-custom-lora",
      model: "StudentGPT-7B-Academic-Tutor",
    });
  }

  // 1. Groq Keys & Models (Blazing fast 0.6s response, 128K context window)
  if (ENV.groqApiKeys.length > 0) {
    const groqModels = requestedModel && (requestedModel.includes("qwen") || requestedModel.includes("gpt-oss") || requestedModel.includes("llama"))
      ? [requestedModel]
      : ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"];
    for (const key of ENV.groqApiKeys) {
      for (const m of groqModels) {
        candidates.push({
          name: `Groq (${m})`,
          url: "https://api.groq.com/openai/v1/chat/completions",
          key,
          model: m,
        });
      }
    }
  }

  // 2. Gemini Keys (Google AI Studio - gemini-3-flash-preview, gemini-3.1-flash-lite-preview, gemma-4-31b-it)
  if (ENV.geminiApiKeys.length > 0) {
    const geminiModels = requestedModel && (requestedModel.includes("gemini") || requestedModel.includes("gemma"))
      ? [requestedModel]
      : ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", "gemma-4-31b-it", "gemma-4-26b-a4b-it"];
    for (let index = 0; index < ENV.geminiApiKeys.length; index++) {
      const key = ENV.geminiApiKeys[index];
      for (const gm of geminiModels) {
        candidates.push({
          name: `Gemini (Key #${index + 1} - ${gm})`,
          url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          key,
          model: gm,
        });
      }
    }
  }

  // 3. OpenRouter Key & Models
  if (ENV.openrouterApiKey) {
    const openrouterModels = requestedModel && !requestedModel.includes("gemini") && !requestedModel.includes("qwen") && !requestedModel.includes("gpt-oss")
      ? [requestedModel]
      : [
          ENV.openrouterModel || "openrouter/free",
          ...ENV.openrouterFallbackModels
        ];
    for (const m of Array.from(new Set(openrouterModels.filter(Boolean)))) {
      candidates.push({
        name: `OpenRouter (${m})`,
        url: resolveApiUrl(),
        key: ENV.openrouterApiKey,
        model: m,
      });
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

let customGpuLock: Promise<void> = Promise.resolve();

async function withCustomGpuLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = customGpuLock;
  let release!: () => void;
  customGpuLock = new Promise<void>(resolve => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function callGradioZeroGpuSpace(
  rawUrl: string,
  messages: unknown,
  maxTokens: number,
  temperature: number
): Promise<InvokeResult | null> {
  const baseUrl = rawUrl.replace(/\/v1\/chat\/completions$/, "").replace(/\/$/, "");
  const prefix = "/gradio_api/call/predict";
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.HF_TOKEN) {
      headers["authorization"] = `Bearer ${process.env.HF_TOKEN.trim()}`;
    }
    const postResp = await fetch(`${baseUrl}${prefix}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: [JSON.stringify(messages), maxTokens, temperature],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!postResp.ok) {
      return null;
    }
    const postJson = (await postResp.json()) as { event_id?: string };
    if (!postJson?.event_id) return null;

    const streamResp = await fetch(`${baseUrl}${prefix}/${postJson.event_id}`, {
      headers: process.env.HF_TOKEN ? { authorization: `Bearer ${process.env.HF_TOKEN.trim()}` } : undefined,
      signal: AbortSignal.timeout(75000),
    });
    if (!streamResp.ok) return null;
    const sseText = await streamResp.text();
    const lines = sseText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("event: complete") && lines[i + 1]?.startsWith("data:")) {
        const dataArr = JSON.parse(lines[i + 1].slice(5).trim());
        const replyText = Array.isArray(dataArr) && typeof dataArr[0] === "string" ? dataArr[0] : "";
        if (replyText) {
          console.log(`[Custom ZeroGPU Model] Answered via ${baseUrl} (${replyText.length} chars)`);
          return {
            id: `hf-zerogpu-${Date.now()}`,
            created: Math.floor(Date.now() / 1000),
            model: "StudentGPT-7B-ZeroGPU",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: replyText },
                finish_reason: "stop",
              },
            ],
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[Custom ZeroGPU Model] Unreachable or timed out: ${(err as Error).message}`);
  }
  return null;
}

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

  if (typeof params.temperature === "number") {
    payload.temperature = params.temperature;
  }

  if (thinking) {
    payload.thinking = thinking;
  }
  payload.reasoning = reasoning || { max_tokens: 0 };

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const isStructuredJson = Boolean(
    normalizedResponseFormat &&
      (normalizedResponseFormat.type === "json_object" ||
        normalizedResponseFormat.type === "json_schema")
  );

  const candidates = getProviderCandidates(model, isStructuredJson);
  let lastError = "LLM invoke failed";

  for (const candidate of candidates) {
    const requestPayload: Record<string, unknown> = {
      ...payload,
      model: candidate.model,
    };
    if (!candidate.name.startsWith("OpenRouter")) {
      delete requestPayload.reasoning;
      delete requestPayload.thinking;
    }
    if (candidate.name.startsWith("Groq") || candidate.model.includes("gpt-oss") || candidate.model.includes("gemma-4")) {
      delete requestPayload.response_format;
      const requestedMax = typeof requestPayload.max_tokens === "number" ? requestPayload.max_tokens : 4096;
      requestPayload.max_tokens = Math.max(requestedMax, 4096);
    }
    if (candidate.model.includes("StudentGPT")) {
      const requestedMax = typeof requestPayload.max_tokens === "number" ? requestPayload.max_tokens : 1200;
      requestPayload.max_tokens = Math.min(requestedMax, 1250);
    }

    try {
      if (candidate.url.includes(".hf.space")) {
        const gradioData = await withCustomGpuLock(() =>
          callGradioZeroGpuSpace(
            candidate.url,
            requestPayload.messages,
            typeof requestPayload.max_tokens === "number" ? requestPayload.max_tokens : 1500,
            typeof requestPayload.temperature === "number" ? requestPayload.temperature : 0.3
          )
        );
        if (gradioData && gradioData.choices?.[0]?.message) {
          if (isStructuredJson) {
            const rawStr = typeof gradioData.choices[0].message.content === "string" ? gradioData.choices[0].message.content : "";
            const parsedCheck = safeParseJSON<Record<string, unknown>>(rawStr, {});
            if (parsedCheck && typeof parsedCheck === "object" && Object.keys(parsedCheck).length > 0) {
              gradioData.choices[0].message.content = JSON.stringify(parsedCheck);
              return gradioData;
            }
          } else {
            return gradioData;
          }
        }
        continue;
      }

      const doFetch = () =>
        fetchWithBackoff(
          candidate.url,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${candidate.key}`,
            },
            body: JSON.stringify(requestPayload),
          },
          !candidate.model.includes("StudentGPT")
        );

      const response = candidate.model.includes("StudentGPT")
        ? await withCustomGpuLock(doFetch)
        : await doFetch();

      if (response.ok) {
        const data = (await response.json()) as InvokeResult;
        if (data && Array.isArray(data.choices) && data.choices.length > 0 && data.choices[0]?.message) {
          if (typeof data.choices[0].message.content === "string") {
            data.choices[0].message.content = data.choices[0].message.content
              .replace(/<think>[\s\S]*?<\/think>/gi, "")
              .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
              .trim();
          }
          if (isStructuredJson) {
            const rawStr = typeof data.choices[0].message.content === "string" ? data.choices[0].message.content : "";
            const parsedCheck = safeParseJSON<Record<string, unknown>>(rawStr, {});
            if (!parsedCheck || (typeof parsedCheck === "object" && Object.keys(parsedCheck).length === 0)) {
              console.warn(`Provider ${candidate.name} returned unparseable or empty JSON; trying next candidate...`);
              continue;
            }
            data.choices[0].message.content = JSON.stringify(parsedCheck);
          }
          return data;
        }
        console.warn(`Provider ${candidate.name} returned response without valid choices array.`);
      }

      const errorText = await response.text();
      lastError = `[${candidate.name}] failed: ${response.status} ${response.statusText} – ${errorText}`;
      console.warn(`Provider ${candidate.name} failed with ${response.status}; trying next provider candidate...`);
    } catch (err) {
      if (candidate.model.includes("StudentGPT")) {
        deadCustomUrl = candidate.url;
      }
      lastError = `[${candidate.name}] error: ${(err as Error).message}`;
      console.warn(`Provider ${candidate.name} encountered error; trying next candidate...`);
    }
  }

  console.warn(`All LLM providers failed (${lastError}); generating synthetic fallback response.`);
  return buildFallbackResult(params);
}

function buildFallbackResult(params: InvokeParams): InvokeResult {
  const jsonSchemaName = params.response_format?.type === "json_schema" ? params.response_format.json_schema?.name : (params.responseFormat?.type === "json_schema" ? params.responseFormat.json_schema?.name : "");

  const lastUserMsg = params.messages.filter(m => m.role === "user").pop();
  const rawText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";

  const isStudyNotes =
    jsonSchemaName === "study_notes" ||
    rawText.toLowerCase().includes("study notes") ||
    rawText.toLowerCase().includes("study_notes") ||
    params.messages.some(m => typeof m.content === "string" && (m.content.includes("study notes") || m.content.includes("study_notes")));

  const isRevisionGuide =
    jsonSchemaName === "revision_guide" ||
    rawText.toLowerCase().includes("revision guide") ||
    rawText.toLowerCase().includes("revision_guide") ||
    params.messages.some(m => typeof m.content === "string" && (m.content.includes("revision guide") || m.content.includes("revision_guide")));

  // Extract clean document title
  let docTitle = "Study Material";
  const bookMatch = rawText.match(/Document (?:Name|Title):\s*([^\n\()]+)/i) || rawText.match(/Book:\s*([^\n]+)/i) || rawText.match(/Document:\s*([^\n]+)/i) || rawText.match(/Topic:\s*([^\n]+)/i);
  if (bookMatch && bookMatch[1]) {
    docTitle = bookMatch[1].trim().replace(/\.[^/.]+$/, "");
  }

  let scopeLabel = "";
  const scopeMatch = rawText.match(/Requested [^:]+:\s*([^\n]+)/i);
  if (scopeMatch && scopeMatch[1]) {
    scopeLabel = scopeMatch[1].trim();
  }

  function cleanString(str: string) {
    return str.split(".")[0].split("\n")[0].replace(/['"]/g, "").trim() || "Study Scope";
  }

  const cleanDoc = cleanString(docTitle);
  const topicName = cleanDoc !== "Study Scope" ? cleanDoc : "Comprehensive Study Material";

  // Extract actual extracted text sentences from the PDF body in the prompt
  const sentences: string[] = [];
  const bodyIndex = rawText.indexOf("DOCUMENT CONTENT");
  const bodyStart = bodyIndex !== -1
    ? rawText.slice(bodyIndex + 16)
    : (rawText.indexOf("Book:") !== -1 ? rawText.slice(rawText.indexOf("Book:")) : rawText);
  const cleanedBody = bodyStart
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
    .replace(/\b\d+\s*of\s*\d+\b/gi, "");

  const rawLines = cleanedBody.split("\n").map(l => l.trim()).filter(l => {
    if (l.length < 3) return false;
    if (
      l.startsWith("Book:") ||
      l.startsWith("Document Name:") ||
      l.startsWith("Requested") ||
      l.startsWith("Create") ||
      l.startsWith("Include") ||
      l.toUpperCase().includes("DOCUMENT CONTENT") ||
      l.toUpperCase().includes("FULL DOCUMENT") ||
      l.startsWith("STUDENT QUESTION:")
    ) return false;
    if (/^\d+$/.test(l)) return false;
    return true;
  });

  for (const line of rawLines) {
    const parts = line.split(/(?<=[.!?])\s+/).map(p => p.trim()).filter(p => p.length >= 3);
    if (parts.length > 0) sentences.push(...parts);
    else sentences.push(line);
  }

  const realSentences = Array.from(new Set(sentences)).filter(s => !s.includes("--") && !/\b\d+\s*of\s*\d+\b/i.test(s));

  function getBullets(start: number, count: number, fallbackPrefix: string) {
    const subset = realSentences.slice(start, start + count);
    if (subset.length > 0) {
      return subset;
    }
    return [
      `${fallbackPrefix}: Core principles and baseline concepts of ${topicName}`,
      `${fallbackPrefix}: Primary structural analysis and technical operational details`,
      `${fallbackPrefix}: Practical applications and summary insights`
    ];
  }

  const overviewText = realSentences.length > 0
    ? `Comprehensive study notes for ${topicName}. ${realSentences[0]}`
    : `Comprehensive study notes covering core concepts, primary mechanisms, and practical applications for ${topicName}.`;

  let fallbackText = "";

  if (isStudyNotes) {
    // Extract authentic parts/headings from the document body in the prompt
    const headingRegex = /(?:^|\n|\.\s+|\|\s+|\b)((?:P\s*A\s*R\s*T|Part|Chapter|CHAPTER|Section|SECTION)\s*\d+[:·\-–\.]?\s*[^\n\.\(\)]+|Summary and Quick Reference|Key [tT]ake-aways|Common mistakes to avoid|Problem\s+\d+[:·\-–]?\s*[^\n\.\(\)]+)/gi;
    const matches = [...cleanedBody.matchAll(headingRegex)];
    const extractedSections: Array<{ heading: string; explanation: string; bullets: string[] }> = [];

    if (matches.length >= 2) {
      for (let i = 0; i < matches.length; i++) {
        let rawHeading = matches[i][1].trim().replace(/^[\.\s|]+/, "");
        rawHeading = rawHeading.replace(/\s+/g, " ");
        if (rawHeading.length > 70) rawHeading = rawHeading.slice(0, 65) + "…";

        const startIndex = matches[i].index! + matches[i][0].indexOf(matches[i][1]) + matches[i][1].length;
        const endIndex = i + 1 < matches.length ? matches[i + 1].index! : cleanedBody.length;
        const sectionBody = cleanedBody.slice(startIndex, endIndex).trim().replace(/\s+/g, " ");

        const sentencesInBody = sectionBody
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 15 && !s.includes("Student Notes") && !/^\d+$/.test(s));

        if (sentencesInBody.length > 0) {
          extractedSections.push({
            heading: rawHeading,
            explanation: sentencesInBody[0].slice(0, 350),
            bullets: (sentencesInBody.slice(1, 8).length ? sentencesInBody.slice(1, 8) : [sentencesInBody[0]]).map(b => b.slice(0, 280))
          });
        }
      }
    }

    if (extractedSections.length < 3) {
      const paragraphs = cleanedBody.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 40);
      for (let i = 0; i < Math.min(paragraphs.length, 6); i++) {
        const p = paragraphs[i].replace(/\s+/g, " ");
        const sentencesInP = p.split(/(?<=[.!?])\s+/).filter(s => s.length > 15);
        extractedSections.push({
          heading: `${i + 1}. ${sentencesInP[0]?.slice(0, 50) || `Topic ${i + 1}`}…`,
          explanation: sentencesInP[0] || p.slice(0, 200),
          bullets: (sentencesInP.slice(1, 6).length ? sentencesInP.slice(1, 6) : [p.slice(0, 200)]).map(b => b.slice(0, 250))
        });
      }
    }

    fallbackText = JSON.stringify({
      overview: overviewText,
      sections: extractedSections.length >= 2 ? extractedSections : [
        {
          heading: `1. Foundations of ${topicName}`,
          explanation: realSentences[0] || `Core definitions and principles extracted from ${topicName}.`,
          bullets: realSentences.slice(1, 5).length ? realSentences.slice(1, 5) : [`Key theoretical mechanism for ${topicName}`]
        },
        {
          heading: `2. Analysis & Technical Mechanics`,
          explanation: realSentences[5] || `Detailed mechanisms and mathematical formulations.`,
          bullets: realSentences.slice(6, 10).length ? realSentences.slice(6, 10) : [`Analytical breakdown of ${topicName}`]
        }
      ],
      revisionReminders: [
        realSentences[2] || `Review key terms and core definitions for ${topicName}`,
        realSentences[5] || `Test active recall on primary structural sections`,
        realSentences[8] || `Summarize central concepts in your own words`
      ]
    });
  } else if (jsonSchemaName === "revision_guide") {
    fallbackText = JSON.stringify({
      oneLineSummary: realSentences[0] || `High-yield synthesis of ${topicName} covering core definitions, principles, and key takeaways.`,
      overview: `High-yield comprehensive revision guide for ${topicName}. ${realSentences.slice(0, 3).join(" ") || "Structured for active recall and concept mastery."}`,
      keyDefinitions: realSentences.slice(0, 4).map((s, idx) => ({
        term: `${topicName} — Concept ${idx + 1}`,
        definition: s,
        memoryTip: `Focus on the core mechanism described in ${topicName}.`
      })),
      formulaBank: [],
      blocks: [
        {
          title: `Block 1: Foundational Principles of ${topicName}`,
          focus: realSentences[1] || `Master fundamental terminology and baseline models in ${topicName}`,
          coreSummary: realSentences.slice(0, 3).join(" ") || `${topicName} establishes foundational concepts governed by formal theoretical relations.`,
          keyFormula: "",
          keyTakeaways: getBullets(0, 4, topicName),
          commonMistakes: [
            `Review all definitions and boundary conditions directly from ${topicName}.`
          ],
          mnemonic: `Connect each definition in ${topicName} to its practical application.`
        },
        {
          title: `Block 2: Core Mechanisms & Analysis in ${topicName}`,
          focus: realSentences[4] || `Analyze primary workflows and operational rules`,
          coreSummary: realSentences.slice(3, 6).join(" ") || `Detailed breakdown of the primary mechanisms and analytical methods in ${topicName}.`,
          keyFormula: "",
          keyTakeaways: getBullets(4, 4, topicName),
          commonMistakes: [
            `Avoid skipping intermediate steps when analyzing problems in ${topicName}.`
          ],
          mnemonic: `Verify every step against the core principles of ${topicName}.`
        }
      ],
      selfCheck: [
        `Can I define the primary concepts of ${topicName} from memory?`,
        `Can I explain the main mechanisms and workflows covered in ${topicName}?`,
        `Can I summarize the key takeaways of ${topicName} in my own words?`
      ]
    });
  } else {
    fallbackText = `### Academic Overview & Guidance\n\nStudentGPT study guide for **${topicName}**.\n\n${realSentences[0] || ""}\n\n### Core Source Concepts\n\n1. ${realSentences[1] || "Understand primary definitions and domain principles."}\n2. ${realSentences[2] || "Analyze operational boundaries and system limits."}\n3. ${realSentences[3] || "Practice explaining key ideas in your own words."}`;
  }

  return {
    id: `fallback-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: "studentgpt-fallback-engine",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: fallbackText,
        },
        finish_reason: "stop",
      },
    ],
  };
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

  console.warn(`All stream providers failed (${lastError}); serving fallback stream response.`);
  const fallback = buildFallbackResult(params);
  const textContent = typeof fallback.choices[0].message.content === "string" 
    ? fallback.choices[0].message.content 
    : JSON.stringify(fallback.choices[0].message.content);

  const encoder = new TextEncoder();
  const chunks = [
    `data: ${JSON.stringify({ id: fallback.id, object: "chat.completion.chunk", created: fallback.created, model: fallback.model, choices: [{ index: 0, delta: { role: "assistant", content: textContent }, finish_reason: null }] })}\n\n`,
    `data: ${JSON.stringify({ id: fallback.id, object: "chat.completion.chunk", created: fallback.created, model: fallback.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`,
    `data: [DONE]\n\n`
  ];

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
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

function sanitizeLatexAndNewlinesInJSON(input: string): string {
  // Walk character by character: inside JSON strings ("..."), escape raw newlines/tabs and LaTeX backslashes
  let out = "";
  let inString = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (!inString) {
      if (ch === '"') {
        inString = true;
      }
      out += ch;
      i++;
      continue;
    }

    // Inside a JSON string
    if (ch === '"') {
      inString = false;
      out += ch;
      i++;
      continue;
    }
    if (ch === "\n") {
      out += "\\n";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      i++;
      continue;
    }
    if (ch === "\\") {
      const next = input[i + 1] || "";
      const rest = input.slice(i + 1, i + 12);
      // If followed by a common LaTeX command starting with f, t, b, n, r (e.g. \frac, \tau, \times, \text, \theta, \beta, \bar, \begin, \nabla, \neq, \nu, \rho, \right)
      if (/^(frac|forall|tau|times|text|theta|tan|to\b|beta|bar|begin|bf\b|bm\b|nabla|neq|nu\b|not\b|rho|right|rightarrow|Rightarrow)/.test(rest)) {
        out += "\\\\";
        i++;
        continue;
      }
      // Valid JSON escapes: ", \, /, b, f, n, r, t, uXXXX
      if (next === '"' || next === "\\" || next === "/" || next === "b" || next === "f" || next === "n" || next === "r" || next === "t" || (next === "u" && /^[0-9a-fA-F]{4}/.test(input.slice(i + 2, i + 6)))) {
        out += ch + next;
        i += 2;
        continue;
      }
      // Any other backslash (e.g. \vec, \pi, \epsilon, \sigma, \Delta, \int, \sum, \hat, \cdot, \approx) -> double it
      out += "\\\\";
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

export function repairTruncatedJSON(jsonStr: string): string | null {
  let str = sanitizeLatexAndNewlinesInJSON(jsonStr.trim());
  if (!str.startsWith("{") && !str.startsWith("[")) return null;

  // Strip trailing odd backslash before closing string
  str = str.replace(/\\+$/, "");

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
  str = str.replace(/,\s*("[^"]*")\s*$/, "");
  str = str.replace(/\{\s*("[^"]*")\s*$/, '{$1: ""');

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

  const sanitized = sanitizeLatexAndNewlinesInJSON(cleaned);

  try {
    return JSON.parse(sanitized) as T;
  } catch {
    const firstBrace = sanitized.indexOf("{");
    const lastBrace = sanitized.lastIndexOf("}");
    const firstBracket = sanitized.indexOf("[");
    const lastBracket = sanitized.lastIndexOf("]");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(sanitized.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        // Fallthrough to repair
      }
    }

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(sanitized.slice(firstBracket, lastBracket + 1)) as T;
      } catch {
        // Fallthrough to repair
      }
    }

    if (firstBrace !== -1) {
      const fragment = sanitized.slice(firstBrace);
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


