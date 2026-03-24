import { type AgentEvent } from "@ezu/protocol";

export type ModelTask = "planning" | "coding" | "review" | "summary" | "title";

export interface ModelRoute {
  model: string;
  temperature: number;
}

export interface ModelProfile {
  planning: ModelRoute;
  coding: ModelRoute;
  review: ModelRoute;
  summary: ModelRoute;
  title: ModelRoute;
}

export interface PlannerInput {
  prompt: string;
}

export interface CoderInput {
  prompt: string;
}

export interface SummaryInput {
  content: string;
}

export interface ModelGateway {
  getProfile(): ModelProfile;
  streamPlan(input: PlannerInput): AsyncIterable<AgentEvent>;
  streamCode(input: CoderInput): AsyncIterable<AgentEvent>;
  summarizeProject(input: SummaryInput): Promise<string>;
}

export const defaultModelProfile: ModelProfile = {
  planning: { model: "gpt-5.4", temperature: 0.2 },
  coding: { model: "gpt-5.3-codex", temperature: 0.1 },
  review: { model: "gpt-5.4", temperature: 0.1 },
  summary: { model: "gpt-5-mini", temperature: 0.3 },
  title: { model: "gpt-5-mini", temperature: 0.4 },
};

export function createModelGateway(profile: ModelProfile = defaultModelProfile): ModelGateway {
  return {
    getProfile() {
      return profile;
    },
    async *streamPlan(input) {
      yield {
        type: "message.delta",
        messageId: "planner",
        text: input.prompt,
      };
      yield {
        type: "message.completed",
        messageId: "planner",
      };
    },
    async *streamCode(input) {
      yield {
        type: "message.delta",
        messageId: "coder",
        text: input.prompt,
      };
      yield {
        type: "message.completed",
        messageId: "coder",
      };
    },
    async summarizeProject(input) {
      return input.content.slice(0, 140);
    },
  };
}
