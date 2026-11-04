import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asStatelessRequest, createDeepseekProvider, deepseekKey, MODEL_ALIASES,
} from "../src/provider.mjs";

test("won't confuse an OpenAI key with a DeepSeek key", () => {
  assert.equal(deepseekKey({ OPENAI_API_KEY: "openai-key" }), null);
  assert.equal(deepseekKey({
    OPENAI_API_KEY: "secret",
    OPENAI_BASE_URL: "https://api.deepseek.com",
  }), "secret");
  assert.equal(deepseekKey({ DEEPSEEK_API_KEY: "deepseek" }), "deepseek");
});

test("maps Pomerado model roles to valid DeepSeek models", () => {
  assert.equal(MODEL_ALIASES["gpt-6.1-sol"], "deepseek-v4-pro");
  assert.equal(MODEL_ALIASES["gpt-6-luna"], "deepseek-flash");
});

test("MCP can initialize without a key, but model requests fail closed", async () => {
  const provider = createDeepseekProvider({ env: {} });
  await assert.rejects(provider.getModel("gpt-6.1-sol"), /not configured/);
});

test("all delegated responses use stateless DeepSeek payloads", async () => {
  const calls = [];
  const models = [];
  const provider = createDeepseekProvider({
    env: { DEEPSEEK_API_KEY: "synthetic" },
    createProvider(opts) {
      assert.equal(opts.baseURL, "https://api.deepseek.com");
      assert.equal(opts.useResponses, true);
      return {
        async getModel(name) {
          models.push(name);
          return {
            async getResponse(request) { calls.push(request); return {}; },
            async *getStreamedResponse(request) {
              calls.push(request); yield {};
            },
          };
        },
      };
    },
  });
  const model = await provider.getModel("gpt-6.1-sol");
  const request = {
    input: [{ role: "user", content: "hello" }],
    previousResponseId: "old-id",
    modelSettings: {
      store: true,
      providerData: { prompt_cache_key: "old-cache", supported: 1 },
    },
  };
  await model.getResponse(request);
  for await (const _ of model.getStreamedResponse(request)) {}
  assert.deepEqual(models, ["deepseek-v4-pro"]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].previousResponseId, undefined);
  assert.equal(calls[0].modelSettings.store, false);
  assert.equal(calls[0].modelSettings.providerData.prompt_cache_key, undefined);
  assert.equal(calls[0].modelSettings.providerData.supported, 1);
  assert.equal(request.modelSettings.providerData.prompt_cache_key, "old-cache");
  await assert.rejects(provider.getModel("unsupported-openai-only"), /Unsupported/);
});

test("does not mutate original inputs", () => {
  const input = { modelSettings: { providerData: { prompt_cache_options: {} } } };
  asStatelessRequest(input);
  assert.deepEqual(input.modelSettings.providerData, { prompt_cache_options: {} });
});
