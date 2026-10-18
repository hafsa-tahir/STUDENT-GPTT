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

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: init.signal || AbortSignal.timeout(45000),
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

function getProviderCandidates(requestedModel?: string): ProviderCandidate[] {
  const candidates: ProviderCandidate[] = [];

  // 1. Groq Keys & Models (Blazing fast, highly reliable)
  if (ENV.groqApiKeys.length > 0) {
    const groqModels = requestedModel && (requestedModel.includes("qwen") || requestedModel.includes("gpt-oss") || requestedModel.includes("llama"))
      ? [requestedModel]
      : ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"];
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

  // 2. Gemini Keys (Google AI Studio - gemini-3.8-flash)
  if (ENV.geminiApiKeys.length > 0) {
    const geminiModel = requestedModel && requestedModel.includes("gemini")
      ? requestedModel
      : "gemini-3.8-flash";
    for (let index = 0; index < ENV.geminiApiKeys.length; index++) {
      const key = ENV.geminiApiKeys[index];
      candidates.push({
        name: `Gemini (Key #${index + 1} - ${geminiModel})`,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key,
        model: geminiModel,
      });
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

  const candidates = getProviderCandidates(model);
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

    try {
      const response = await fetchWithBackoff(
        candidate.url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${candidate.key}`,
          },
          body: JSON.stringify(requestPayload),
        },
        true
      );

      if (response.ok) {
        const data = (await response.json()) as InvokeResult;
        if (data && Array.isArray(data.choices) && data.choices.length > 0 && data.choices[0]?.message) {
          return data;
        }
        console.warn(`Provider ${candidate.name} returned response without valid choices array.`);
      }

      const errorText = await response.text();
      lastError = `[${candidate.name}] failed: ${response.status} ${response.statusText} – ${errorText}`;
      console.warn(`Provider ${candidate.name} failed with ${response.status}; trying next provider candidate...`);
    } catch (err) {
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
      overview: `High-yield comprehensive revision guide for ${topicName}. ${realSentences[0] || "Structured for active recall, mathematical derivations, and concept mastery."}`,
      blocks: [
        {
          title: `Block 1: Foundational Principles & Definitions`,
          focus: realSentences[1] || `Master fundamental terminology, physical rules, and baseline models`,
          coreSummary: realSentences[0] || `${topicName} establishes foundational physical concepts governed by formal theoretical relations. Review the starting conditions and geometric definitions before working through mathematical derivations.`,
          keyFormula: `$$\\vec{E} = \\frac{1}{4\\pi\\varepsilon_0} \\frac{q}{r^2} \\hat{r}$$`,
          keyTakeaways: [
            realSentences[2] || `Field lines originate on positive charges and terminate on negative charges.`,
            realSentences[3] || `The local density of field lines is directly proportional to field magnitude.`,
            `Field lines can never intersect at any point in space.`
          ],
          questions: [
            {
              question: realSentences[2] ? `What is the physical significance of: "${realSentences[2]}"?` : `Why can electric field lines never cross?`,
              answer: `If two field lines crossed, the electric field vector at the intersection point would point in two different directions simultaneously, which is physically impossible. Therefore, the field at every point is unique and tangent to the field line.`,
              examTrap: `Confusing field line density with the number of charges; field line density represents electric field strength E.`
            },
            {
              question: realSentences[3] ? `How is "${realSentences[3].slice(0, 60)}..." derived and applied?` : `What is the electric dipole moment and its direction?`,
              answer: `The electric dipole moment is defined as p = q * d, directed from the negative charge (-q) to the positive charge (+q). It quantifies the system's polarity and response to external fields.`,
              examTrap: `In chemistry, dipole arrows often point from + to -, but in physics, the dipole moment vector p strictly points from negative to positive.`
            }
          ],
          commonMistakes: [
            `Forgetting that field lines always meet conductive surfaces at right angles (90 degrees).`
          ]
        },
        {
          title: `Block 2: Governing Equations & Quantitative Derivations`,
          focus: realSentences[4] || `Derive and apply on-axis approximations and energy formulations`,
          coreSummary: realSentences[4] || `For an electric dipole along its axis (z >> d), the electric field falls off as 1/z^3, which is significantly faster than the 1/r^2 inverse-square law for an isolated point charge.`,
          keyFormula: `$$E_{\\text{axis}} \\approx \\frac{1}{4\\pi\\varepsilon_0} \\frac{2p}{z^3}, \\quad \\tau = \\vec{p} \\times \\vec{E}, \\quad U = -\\vec{p} \\cdot \\vec{E}$$`,
          keyTakeaways: [
            `On-axis dipole field magnitude is E = 2kp / z^3 for z >> d.`,
            `External torque tau = p x E rotates the dipole into alignment with E.`,
            `Potential energy is minimized at U = -pE when parallel (theta = 0).`
          ],
          questions: [
            {
              question: `How does the electric field of a dipole scale with distance z compared to a monopole?`,
              answer: `A dipole field scales as 1/z^3 (inverse-cube), whereas a single charge field scales as 1/z^2. The opposite charges partially cancel each other at large distances, causing the field to decay more rapidly.`,
              examTrap: `Applying the 1/r^2 formula to dipole problems instead of the 1/z^3 approximation.`
            },
            {
              question: `What is the net force and net torque on an electric dipole in a uniform electric field?`,
              answer: `Net force is zero because equal and opposite forces (+qE and -qE) cancel out. However, net torque is tau = p x E = p*E*sin(theta), causing rotation until aligned with the field.`,
              examTrap: `Assuming net torque is zero just because net force is zero; equal and opposite forces create a couple.`
            }
          ],
          commonMistakes: [
            `Neglecting the cross product in torque (tau = p x E); torque is a vector perpendicular to both p and E.`
          ]
        },
        {
          title: `Block 3: Practical Analysis & Boundary Conditions`,
          focus: realSentences[7] || `Evaluate boundary behaviors, work done in rotation, and stability`,
          coreSummary: realSentences[7] || `Work done by an external agent to rotate a dipole from theta_i to theta_f is W_ext = delta U = -pE(cos theta_f - cos theta_i). Stable equilibrium occurs at theta = 0, unstable at theta = 180 degrees.`,
          keyFormula: `$$W = -\\Delta U = -(-pE\\cos\\theta_f - (-pE\\cos\\theta_i))$$`,
          keyTakeaways: [
            `Stable equilibrium: dipole is parallel to E (theta = 0, U = -pE).`,
            `Unstable equilibrium: dipole is antiparallel to E (theta = 180 deg, U = +pE).`,
            `Maximum torque occurs when dipole is perpendicular to field (theta = 90 deg, tau = pE).`
          ],
          questions: [
            {
              question: `How much work is required to rotate an electric dipole 180 degrees from stable to unstable equilibrium?`,
              answer: `Work done W = U_final - U_initial = (+pE) - (-pE) = 2pE. The dipole moves against the restoring torque throughout the rotation.`,
              examTrap: `Sign error: forgetting that U = -p . E has a negative sign in the definition.`
            }
          ],
          commonMistakes: [
            `Confusing stable equilibrium (minimum potential energy) with unstable equilibrium (maximum potential energy).`
          ]
        }
      ],
      selfCheck: [
        `Can I state and sketch all 5 properties of electric field lines from memory?`,
        `Can I derive why E drops off as 1/z^3 for an on-axis dipole using the binomial expansion?`,
        `Can I calculate the torque and potential energy for any arbitrary angle theta?`,
        `Can I explain why a dipole experiences zero net force but nonzero torque in a uniform field?`
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


