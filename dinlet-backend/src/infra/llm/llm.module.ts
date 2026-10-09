import { Global, Module } from "@nestjs/common";

import { LlmService } from "#/infra/llm/llm.service.js";
import { AnthropicProvider } from "#/infra/llm/providers/anthropic.provider.js";
import { GeminiProvider } from "#/infra/llm/providers/gemini.provider.js";
import { MistralProvider } from "#/infra/llm/providers/mistral.provider.js";

/** LLM sağlayıcı zinciri (Pro planda akıcı anlatım). */
@Global()
@Module({
  providers: [GeminiProvider, MistralProvider, AnthropicProvider, LlmService],
  exports: [LlmService],
})
export class LlmModule {}
