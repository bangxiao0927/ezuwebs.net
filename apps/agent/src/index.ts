import {
  createExecutor,
  createSessionState,
  createSessionStore,
  createTimelineAction,
} from "@ezu/core";
import { createModelGateway } from "@ezu/model-gateway";
import { type AgentEvent } from "@ezu/protocol";
import { createBrowserRuntimeStub } from "@ezu/runtime-browser";

export interface AgentAppOptions {
  sessionId: string;
  projectId: string;
}

export async function bootstrapAgentApp(options: AgentAppOptions): Promise<AgentEvent[]> {
  const sessionStore = createSessionStore();
  const session = createSessionState({
    id: options.sessionId,
    projectId: options.projectId,
  });

  sessionStore.upsert(session);

  const gateway = createModelGateway();
  const runtime = createBrowserRuntimeStub();
  const executor = createExecutor({ runtime, sessionStore });

  const plannedAction = createTimelineAction({
    source: "planner",
    action: {
      type: "interaction.confirm",
      title: "Review initial workspace structure",
      summary: "Confirm the generated monorepo layout before wiring real runtime and UI.",
    },
  });

  const executed = await executor.enqueue(plannedAction);

  return [
    {
      type: "message.delta",
      messageId: "bootstrap",
      text: `Planner profile: ${gateway.getProfile().planning.model}`,
    },
    {
      type: "action.created",
      action: executed,
    },
  ];
}
