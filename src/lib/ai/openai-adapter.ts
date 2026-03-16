import OpenAI from "openai";
import type {
  AiProvider,
  AiSolveResponse,
  AiCheckResponse,
  AiExplainResponse,
  AiExplainContext,
} from "./types";
import { validateSolveResponse, validateCheckResponse, validateExplainResponse } from "./provider";

export class OpenAiAdapter implements AiProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
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
    const response = await this.client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${image.toString("base64")}`,
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

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("No text response from OpenAI");
    }
    return text.trim();
  }
}
