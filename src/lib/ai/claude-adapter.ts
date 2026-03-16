import Anthropic from "@anthropic-ai/sdk";
import type {
  AiProvider,
  AiSolveResponse,
  AiCheckResponse,
  AiExplainResponse,
  AiExplainContext,
} from "./types";
import { validateSolveResponse, validateCheckResponse, validateExplainResponse } from "./provider";

export class ClaudeAdapter implements AiProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async solve(image: Buffer, systemPrompt: string): Promise<AiSolveResponse> {
    const text = await this.callVision(image, systemPrompt);
    return validateSolveResponse(JSON.parse(text));
  }

  async check(image: Buffer, systemPrompt: string): Promise<AiCheckResponse> {
    const text = await this.callVision(image, systemPrompt);
    return validateCheckResponse(JSON.parse(text));
  }

  async explain(
    image: Buffer,
    context: AiExplainContext,
    systemPrompt: string,
  ): Promise<AiExplainResponse> {
    const text = await this.callVision(image, systemPrompt);
    return validateExplainResponse(JSON.parse(text));
  }

  private async callVision(image: Buffer, systemPrompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: image.toString("base64"),
              },
            },
            {
              type: "text",
              text: "Analysiere dieses Bild und antworte im angegebenen JSON-Format.",
            },
          ],
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Extract JSON from response (may be wrapped in markdown code block)
    const text = block.text.trim();
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    return jsonMatch ? jsonMatch[1].trim() : text;
  }
}
