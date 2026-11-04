import { OpenAIProvider } from "@openai/agents";

export const MODEL_ALIASES = Object.freeze({
  "gpt-6.1-sol": "deepseek-v4-pro",
  "gpt-6-luna": "deepseek-flash",
});

export function deepseekKey(env = process.env) {
  if (env.DEEPSEEK_API_KEY?.trim()) return env.DEEPSEEK_API_KEY.trim();
  if (env.OPENAI_BASE_URL === "https://api.deepseek.com" &&
      env.OPENAI_API_KEY?.trim()) return env.OPENAI_API_KEY.trim();
  return null;
}

export function asStatelessRequest(request) {
  const settings = request.modelSettings ?? {};
  const providerData = { ...(settings.providerData ?? {}) };
  for (const field of ["prompt_cache_options", "prompt_cache_key",
    "prompt_cache_breakpoint", "comparison_response_id"])
    delete providerData[field];
  return {
    ...request,
    previousResponseId: undefined,
    conversationId: undefined,
    modelSettings: { ...settings, store: false, providerData },
  };
}

export function createDeepseekProvider({
  env = process.env,
  createProvider = (options) => new OpenAIProvider(options),
} = {}) {
  let upstream;
  function sdk() {
    if (upstream) return upstream;
    const apiKey = deepseekKey(env);
    if (!apiKey) throw new Error("DeepSeek key not configured for the MCP service.");
    upstream = createProvider({
      apiKey, baseURL: "https://api.deepseek.com", useResponses: true,
    });
    return upstream;
  }
  return {
    async getModel(name) {
      const modelName = MODEL_ALIASES[name] ?? name;
      if (modelName !== "deepseek-v4-pro" && modelName !== "deepseek-flash")
        throw new Error("Unsupported model for DeepSeek adapter.");
      const model = await sdk().getModel(modelName);
      return {
        getResponse: (request) => model.getResponse(asStatelessRequest(request)),
        getStreamedResponse: (request) =>
          model.getStreamedResponse(asStatelessRequest(request)),
      };
    },
  };
}
