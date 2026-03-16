/* ---------- Provider Interface ---------- */

export interface AiProvider {
  solve(image: Buffer, systemPrompt: string): Promise<AiSolveResponse>;
  check(image: Buffer, systemPrompt: string): Promise<AiCheckResponse>;
  explain(
    image: Buffer,
    context: AiExplainContext,
    systemPrompt: string,
  ): Promise<AiExplainResponse>;
}

export type AiExplainContext = {
  previousSteps: { text: string; explanation: string }[];
  step: string;
  question: string;
};

/* ---------- Response Types ---------- */

export type AiSolveResponse = {
  steps: { text: string; explanation: string }[];
  proof?: string;
};

export type AiCheckResponse = {
  correct: boolean;
  steps: {
    studentStep: string;
    isCorrect: boolean;
    correction?: string;
    rule?: string;
  }[];
  hint: string;
};

export type AiExplainResponse = {
  explanation: string;
  rule?: string;
  additionalSteps?: { text: string; explanation: string }[];
};

/* ---------- Canvas Shape Types ---------- */

export interface AiStepShape {
  id: string;
  type: "ai-step";
  x: number;
  y: number;
  color: string;
  source: "ai";
  props: {
    text: string;
    explanation: string;
    stepIndex: number;
    groupId: string;
  };
}

export interface AiCorrectionShape {
  id: string;
  type: "ai-correction";
  x: number;
  y: number;
  color: string;
  source: "ai";
  props: {
    text: string;
    isCorrect: boolean;
    correction?: string;
    rule?: string;
    hint?: string;
    stepIndex: number;
    groupId: string;
  };
}
