import type { AiProvider, AiSolveResponse, AiCheckResponse, AiExplainResponse } from "./types";

export function getAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER;
  const apiKey = process.env.AI_API_KEY;

  if (!provider || !apiKey) {
    throw new Error("AI_PROVIDER and AI_API_KEY must be configured");
  }

  switch (provider) {
    case "claude": {
      const { ClaudeAdapter } = require("./claude-adapter");
      return new ClaudeAdapter(apiKey);
    }
    case "openai": {
      const { OpenAiAdapter } = require("./openai-adapter");
      return new OpenAiAdapter(apiKey);
    }
    default:
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
  }
}

export function validateSolveResponse(data: unknown): AiSolveResponse {
  const obj = data as Record<string, unknown>;
  if (!obj || !Array.isArray(obj.steps) || obj.steps.length === 0) {
    throw new Error("Invalid solve response: must have non-empty steps array");
  }
  for (const step of obj.steps) {
    if (typeof step.text !== "string" || typeof step.explanation !== "string") {
      throw new Error("Invalid solve response: each step must have text and explanation");
    }
  }
  return obj as unknown as AiSolveResponse;
}

export function validateCheckResponse(data: unknown): AiCheckResponse {
  const obj = data as Record<string, unknown>;
  if (!obj || typeof obj.correct !== "boolean" || !Array.isArray(obj.steps) || typeof obj.hint !== "string") {
    throw new Error("Invalid check response: must have correct, steps, and hint");
  }
  return obj as unknown as AiCheckResponse;
}

export function validateExplainResponse(data: unknown): AiExplainResponse {
  const obj = data as Record<string, unknown>;
  if (!obj || typeof obj.explanation !== "string") {
    throw new Error("Invalid explain response: must have explanation");
  }
  return obj as unknown as AiExplainResponse;
}
