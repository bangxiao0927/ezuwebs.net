import { applyAgentEvent, createSessionState } from "@ezu/core";
import { centerWorkspacePanels, rightWorkbenchPanels } from "@ezu/ui";
import { type AgentEvent } from "@ezu/protocol";

export interface WebAppShellConfig {
  projectName: string;
  runtimeType: "browser" | "remote";
}

export interface WebAppBootstrap {
  config: WebAppShellConfig;
  initialEvents: AgentEvent[];
  sessionId: string;
  projectId: string;
}

export interface WorkbenchViewModel {
  chatMessages: Array<{ id: string; role: string; content: string }>;
  plan: WebAppEventState["plan"];
  actions: WebAppEventState["actions"];
  pendingInteraction: WebAppEventState["pendingInteraction"];
  files: string[];
  previews: WebAppEventState["runtime"]["openPorts"];
}

export interface WebAppEventState {
  messages: ReturnType<typeof createSessionState>["messages"];
  plan: ReturnType<typeof createSessionState>["plan"];
  actions: ReturnType<typeof createSessionState>["actions"];
  pendingInteraction: ReturnType<typeof createSessionState>["pendingInteraction"];
  runtime: ReturnType<typeof createSessionState>["runtime"];
}

export function reduceWorkbenchEvents(
  input: Pick<WebAppBootstrap, "initialEvents" | "projectId" | "sessionId">,
): WebAppEventState {
  const session = input.initialEvents.reduce(
    (currentSession, event) => applyAgentEvent(currentSession, event),
    createSessionState({
      id: input.sessionId,
      projectId: input.projectId,
    }),
  );

  return {
    messages: session.messages,
    plan: session.plan,
    actions: session.actions,
    pendingInteraction: session.pendingInteraction,
    runtime: session.runtime,
  };
}

export function createWorkbenchViewModel(input: WebAppBootstrap): WorkbenchViewModel {
  const state = reduceWorkbenchEvents(input);

  return {
    chatMessages: state.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    })),
    plan: state.plan,
    actions: state.actions,
    pendingInteraction: state.pendingInteraction,
    files: state.runtime.files,
    previews: state.runtime.openPorts,
  };
}

export function createWebAppShell(input: WebAppBootstrap) {
  return {
    topBar: {
      projectName: input.config.projectName,
      runtimeType: input.config.runtimeType,
    },
    centerPanels: centerWorkspacePanels,
    rightPanels: rightWorkbenchPanels,
    initialEvents: input.initialEvents,
    workbench: createWorkbenchViewModel(input),
  };
}
